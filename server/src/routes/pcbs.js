const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

const router = express.Router();

// GET /api/pcbs - list all with pagination
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;

        const countResult = await pool.query('SELECT COUNT(*) FROM pcbs');
        const total = parseInt(countResult.rows[0].count);

        // Fetch PCBs with pagination
        const pcbResult = await pool.query(
            'SELECT * FROM pcbs ORDER BY name ASC LIMIT $1 OFFSET $2',
            [limit, offset]
        );
        const pcbs = pcbResult.rows;

        // Populate components for the fetched PCBs (single batch query)
        if (pcbs.length > 0) {
            const pcbIds = pcbs.map(p => p.id);
            const compResult = await pool.query(`
                SELECT pc.pcb_id, pc.component_id, pc.quantity_per_pcb, c.name, c.part_number
                FROM pcb_components pc
                JOIN components c ON c.id = pc.component_id
                WHERE pc.pcb_id = ANY($1::int[])
            `, [pcbIds]);

            const compMap = {};
            compResult.rows.forEach(r => {
                if (!compMap[r.pcb_id]) compMap[r.pcb_id] = [];
                compMap[r.pcb_id].push({
                    id: r.component_id,
                    name: r.name,
                    part_number: r.part_number,
                    quantity_per_pcb: r.quantity_per_pcb
                });
            });

            pcbs.forEach(p => {
                p.components = compMap[p.id] || [];
            });
        }

        res.json({
            data: pcbs,
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error('Get PCBs error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/pcbs/:id - get single PCB details
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const pcbResult = await pool.query('SELECT * FROM pcbs WHERE id = $1', [id]);
        if (pcbResult.rows.length === 0) return res.status(404).json({ error: 'PCB not found' });

        const pcb = pcbResult.rows[0];

        // Get components
        const compResult = await pool.query(`
            SELECT c.id, c.name, c.part_number, c.working_stock, c.scrap_stock, pc.quantity_per_pcb
            FROM pcb_components pc
            JOIN components c ON c.id = pc.component_id
            WHERE pc.pcb_id = $1
        `, [id]);
        pcb.components = compResult.rows;

        // Get build history
        const historyResult = await pool.query(
            'SELECT * FROM build_log WHERE pcb_id = $1 ORDER BY built_at DESC LIMIT 50',
            [id]
        );
        pcb.build_history = historyResult.rows;

        res.json(pcb);
    } catch (err) {
        console.error('Get PCB detail error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/pcbs - create (protected) with validation
router.post('/', authenticateToken, validate(schemas.pcbCreate), async (req, res) => {
    const client = await pool.connect();
    try {
        const { name, preorder_type, preorder_quantity, components } = req.body;

        await client.query('BEGIN');

        // Create PCB
        const pcbResult = await client.query(
            'INSERT INTO pcbs (name, preorder_type, preorder_quantity) VALUES ($1, $2, $3) RETURNING *',
            [name, preorder_type, preorder_quantity]
        );
        const pcb = pcbResult.rows[0];

        // Process components
        for (const comp of components) {
            let compId = comp.id;

            // Create new component if ID not provided
            if (!compId) {
                const newComp = await client.query(
                    'INSERT INTO components (name, part_number) VALUES ($1, $2) RETURNING id',
                    [comp.name, comp.part_number]
                );
                compId = newComp.rows[0].id;
            }

            // Link to PCB
            await client.query(
                'INSERT INTO pcb_components (pcb_id, component_id, quantity_per_pcb) VALUES ($1, $2, $3)',
                [pcb.id, compId, comp.quantity_per_pcb]
            );
        }

        await client.query('COMMIT');
        res.status(201).json(pcb);
    } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23505') return res.status(400).json({ error: 'PCB name already exists' });
        console.error('Create PCB error:', err);
        res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});

// DELETE /api/pcbs/:id (protected)
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM pcbs WHERE id = $1 RETURNING id', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'PCB not found' });
        res.json({ message: 'PCB deleted' });
    } catch (err) {
        console.error('Delete PCB error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/pcbs/:id/build - build PCBs (protected) with validation
router.post('/:id/build', authenticateToken, validate(schemas.pcbBuild), async (req, res) => {
    const client = await pool.connect();
    try {
        const { quantity } = req.body;
        const buildQty = quantity ?? 1;

        if (buildQty <= 0) return res.status(400).json({ error: 'Build quantity must be positive' });

        await client.query('BEGIN');

        // Get PCB components
        const pcbComps = await client.query(`
            SELECT pc.component_id, pc.quantity_per_pcb, c.name, c.working_stock
            FROM pcb_components pc
            JOIN components c ON c.id = pc.component_id
            WHERE pc.pcb_id = $1
        `, [req.params.id]);

        if (pcbComps.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'PCB has no components defined' });
        }

        // Check if all components have sufficient stock
        const insufficient = [];
        for (const comp of pcbComps.rows) {
            const needed = comp.quantity_per_pcb * buildQty;
            if (comp.working_stock < needed) {
                insufficient.push({
                    name: comp.name,
                    available: comp.working_stock,
                    needed: needed
                });
            }
        }

        if (insufficient.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                error: 'Insufficient stock for build',
                insufficient
            });
        }

        // Batch deduct stock
        const componentIds = pcbComps.rows.map(c => c.component_id);
        const deductValues = pcbComps.rows
            .map(c => `(${c.component_id}, ${c.quantity_per_pcb * buildQty})`)
            .join(',');

        const deductResult = await client.query(`
            UPDATE components c
            SET working_stock = c.working_stock - v.deduct_qty,
                updated_at = CURRENT_TIMESTAMP
            FROM (VALUES ${deductValues}) AS v(comp_id, deduct_qty)
            WHERE c.id = v.comp_id
            RETURNING c.id, c.working_stock AS remaining
        `);

        // Build deductions response
        const remainingMap = {};
        for (const row of deductResult.rows) {
            remainingMap[row.id] = row.remaining;
        }
        const deductions = pcbComps.rows.map(c => ({
            component: c.name,
            deducted: c.quantity_per_pcb * buildQty,
            remaining: remainingMap[c.component_id] ?? 0
        }));

        // Single CTE to check for low stock
        const lowStockCheck = await client.query(`
            WITH req AS (
                SELECT pc.component_id,
                    SUM(pc.quantity_per_pcb * CASE WHEN p.preorder_quantity > 0 THEN p.preorder_quantity ELSE 1 END) AS total_req
                FROM pcb_components pc JOIN pcbs p ON p.id = pc.pcb_id
                WHERE pc.component_id = ANY($1::int[])
                GROUP BY pc.component_id
            )
            SELECT c.id FROM components c
            JOIN req r ON r.component_id = c.id
            WHERE r.total_req > 0 AND c.working_stock < 0.2 * r.total_req
        `, [componentIds]);

        // Batch update low_stock_count
        if (lowStockCheck.rows.length > 0) {
            const lowIds = lowStockCheck.rows.map(r => r.id);
            await client.query(`
                UPDATE components SET low_stock_count = low_stock_count + 1
                WHERE id = ANY($1::int[])
            `, [lowIds]);
        }

        // Log build
        await client.query(
            'INSERT INTO build_log (pcb_id, quantity_built) VALUES ($1, $2)',
            [req.params.id, buildQty]
        );

        await client.query('COMMIT');

        res.json({
            message: `Successfully built ${buildQty} PCB(s)`,
            deductions
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Build PCB error:', err);
        res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});

module.exports = router;
