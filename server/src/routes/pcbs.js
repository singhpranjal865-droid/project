const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/pcbs - list all with component details
router.get('/', async (req, res) => {
    try {
        const pcbs = await pool.query('SELECT * FROM pcbs ORDER BY name ASC');

        // Get all PCB-component relationships in a single query instead of N+1
        const allComponents = await pool.query(`
            SELECT pc.pcb_id, c.id, c.name, c.part_number, c.working_stock, c.scrap_stock, pc.quantity_per_pcb
            FROM pcb_components pc
            JOIN components c ON c.id = pc.component_id
            ORDER BY c.name
        `);

        // Group components by PCB ID
        const componentsByPcb = {};
        for (const comp of allComponents.rows) {
            if (!componentsByPcb[comp.pcb_id]) componentsByPcb[comp.pcb_id] = [];
            componentsByPcb[comp.pcb_id].push(comp);
        }

        const pcbsWithComponents = pcbs.rows.map(pcb => ({
            ...pcb,
            components: componentsByPcb[pcb.id] || []
        }));

        res.json(pcbsWithComponents);
    } catch (err) {
        console.error('Get PCBs error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/pcbs/:id
router.get('/:id', async (req, res) => {
    try {
        const pcb = await pool.query('SELECT * FROM pcbs WHERE id = $1', [req.params.id]);
        if (pcb.rows.length === 0) {
            return res.status(404).json({ error: 'PCB not found' });
        }

        const components = await pool.query(`
      SELECT c.id, c.name, c.part_number, c.working_stock, c.scrap_stock, pc.quantity_per_pcb
      FROM pcb_components pc
      JOIN components c ON c.id = pc.component_id
      WHERE pc.pcb_id = $1
      ORDER BY c.name
    `, [req.params.id]);

        // Build history
        const builds = await pool.query(`
      SELECT * FROM build_log WHERE pcb_id = $1 ORDER BY built_at DESC LIMIT 20
    `, [req.params.id]);

        res.json({ ...pcb.rows[0], components: components.rows, build_history: builds.rows });
    } catch (err) {
        console.error('Get PCB error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/pcbs - create PCB with components (protected)
router.post('/', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        const { name, preorder_type, preorder_quantity, components } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'PCB name is required' });
        }

        await client.query('BEGIN');

        // Create PCB
        const pcbResult = await client.query(
            `INSERT INTO pcbs (name, preorder_type, preorder_quantity) VALUES ($1, $2, $3) RETURNING *`,
            [name, preorder_type || null, preorder_quantity ?? 0]
        );
        const pcb = pcbResult.rows[0];

        // Process components
        if (components && components.length > 0) {
            for (const comp of components) {
                let componentId;

                if (comp.id) {
                    // Existing component
                    componentId = comp.id;
                } else if (comp.name && comp.part_number) {
                    // Auto-create component if it doesn't exist
                    const existing = await client.query(
                        'SELECT id FROM components WHERE part_number = $1', [comp.part_number]
                    );
                    if (existing.rows.length > 0) {
                        componentId = existing.rows[0].id;
                    } else {
                        const newComp = await client.query(
                            `INSERT INTO components (name, part_number, working_stock, scrap_stock, monthly_requirement) 
               VALUES ($1, $2, $3, 0, 0) RETURNING id`,
                            [comp.name, comp.part_number, comp.working_stock ?? 0]
                        );
                        componentId = newComp.rows[0].id;
                    }
                } else {
                    continue;
                }

                await client.query(
                    `INSERT INTO pcb_components (pcb_id, component_id, quantity_per_pcb) 
           VALUES ($1, $2, $3) ON CONFLICT (pcb_id, component_id) DO UPDATE SET quantity_per_pcb = $3`,
                    [pcb.id, componentId, comp.quantity_per_pcb ?? 1]
                );
            }
        }

        await client.query('COMMIT');

        // Fetch full PCB with components
        const fullPcb = await pool.query(`
      SELECT c.id, c.name, c.part_number, c.working_stock, c.scrap_stock, pc.quantity_per_pcb
      FROM pcb_components pc
      JOIN components c ON c.id = pc.component_id
      WHERE pc.pcb_id = $1
    `, [pcb.id]);

        res.status(201).json({ ...pcb, components: fullPcb.rows });
    } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23505') {
            return res.status(400).json({ error: 'PCB name already exists' });
        }
        console.error('Create PCB error:', err);
        res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});

// PUT /api/pcbs/:id - update PCB (protected)
router.put('/:id', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        const { name, preorder_type, preorder_quantity, components } = req.body;

        await client.query('BEGIN');

        const effectivePreorderQty = preorder_type ? (preorder_quantity ?? 0) : 0;

        const pcbResult = await client.query(
            `UPDATE pcbs SET name = COALESCE($1, name), preorder_type = $2, preorder_quantity = $3,
       updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *`,
            [name, preorder_type || null, effectivePreorderQty, req.params.id]
        );

        if (pcbResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'PCB not found' });
        }

        // Update components if provided
        if (components) {
            await client.query('DELETE FROM pcb_components WHERE pcb_id = $1', [req.params.id]);

            for (const comp of components) {
                let componentId;

                if (comp.id) {
                    componentId = comp.id;
                } else if (comp.name && comp.part_number) {
                    const existing = await client.query(
                        'SELECT id FROM components WHERE part_number = $1', [comp.part_number]
                    );
                    if (existing.rows.length > 0) {
                        componentId = existing.rows[0].id;
                    } else {
                        const newComp = await client.query(
                            `INSERT INTO components (name, part_number, working_stock, scrap_stock, monthly_requirement) 
               VALUES ($1, $2, $3, 0, 0) RETURNING id`,
                            [comp.name, comp.part_number, comp.working_stock ?? 0]
                        );
                        componentId = newComp.rows[0].id;
                    }
                } else {
                    continue;
                }

                await client.query(
                    `INSERT INTO pcb_components (pcb_id, component_id, quantity_per_pcb) VALUES ($1, $2, $3)
           ON CONFLICT (pcb_id, component_id) DO UPDATE SET quantity_per_pcb = $3`,
                    [req.params.id, componentId, comp.quantity_per_pcb ?? 1]
                );
            }
        }

        await client.query('COMMIT');

        const fullPcb = await pool.query(`
      SELECT c.id, c.name, c.part_number, c.working_stock, c.scrap_stock, pc.quantity_per_pcb
      FROM pcb_components pc JOIN components c ON c.id = pc.component_id
      WHERE pc.pcb_id = $1
    `, [req.params.id]);

        res.json({ ...pcbResult.rows[0], components: fullPcb.rows });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Update PCB error:', err);
        res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});

// DELETE /api/pcbs/:id (protected)
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM pcbs WHERE id = $1 RETURNING *', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'PCB not found' });
        }
        res.json({ message: 'PCB deleted', pcb: result.rows[0] });
    } catch (err) {
        console.error('Delete PCB error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/pcbs/:id/build - build PCBs (deduct components) (protected)
router.post('/:id/build', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        const { quantity } = req.body;
        const buildQty = quantity ?? 1;

        if (buildQty <= 0) {
            return res.status(400).json({ error: 'Build quantity must be positive' });
        }

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

        // Batch deduct stock for ALL components in one UPDATE with RETURNING
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

        // Single CTE to get all total requirements and check low stock at once
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

        // Batch update low_stock_count for all newly low-stock components
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
