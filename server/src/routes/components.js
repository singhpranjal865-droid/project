const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

const router = express.Router();

// GET /api/components - list all with pagination
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;

        // Get total count first
        const countResult = await pool.query('SELECT COUNT(*) FROM components');
        const total = parseInt(countResult.rows[0].count);

        const result = await pool.query(`
            SELECT c.*,
                COALESCE(req.total_requirement, 0) as total_requirement,
                COALESCE(usage.pcb_count, 0) as pcb_count
            FROM components c
            LEFT JOIN (
                SELECT pc.component_id,
                    SUM(pc.quantity_per_pcb * CASE WHEN p.preorder_quantity > 0 THEN p.preorder_quantity ELSE 1 END) as total_requirement
                FROM pcb_components pc JOIN pcbs p ON p.id = pc.pcb_id
                GROUP BY pc.component_id
            ) req ON req.component_id = c.id
            LEFT JOIN (
                SELECT component_id, COUNT(DISTINCT pcb_id) as pcb_count
                FROM pcb_components
                GROUP BY component_id
            ) usage ON usage.component_id = c.id
            ORDER BY c.name ASC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

        const components = result.rows.map(c => {
            const totalReq = parseInt(c.total_requirement);
            return {
                ...c,
                total_requirement: totalReq,
                pcb_count: parseInt(c.pcb_count),
                low_stock: totalReq > 0 && c.working_stock < 0.2 * totalReq
            };
        });

        res.set('Cache-Control', 'public, max-age=5, stale-while-revalidate=10');
        res.json({
            data: components,
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error('Get components error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/components/:id
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM components WHERE id = $1', [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Component not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Get component error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/components/:id/analytics
router.get('/:id/analytics', async (req, res) => {
    try {
        const { id } = req.params;

        const [compRes, pcbRes, procRes, scrapRes, consumptionRes] = await Promise.all([
            pool.query('SELECT * FROM components WHERE id = $1', [id]),
            pool.query(`
                SELECT p.id, p.name, pc.quantity_per_pcb, p.preorder_type, p.preorder_quantity
                FROM pcbs p JOIN pcb_components pc ON pc.pcb_id = p.id
                WHERE pc.component_id = $1
            `, [id]),
            pool.query('SELECT * FROM procurement_log WHERE component_id = $1 ORDER BY procured_at DESC LIMIT 50', [id]),
            pool.query('SELECT * FROM scrap_log WHERE component_id = $1 ORDER BY created_at DESC LIMIT 50', [id]),
            pool.query(`
                SELECT bl.built_at::date as date, SUM(bl.quantity_built * pc.quantity_per_pcb) as consumed
                FROM build_log bl
                JOIN pcb_components pc ON pc.pcb_id = bl.pcb_id
                WHERE pc.component_id = $1 AND bl.built_at >= CURRENT_DATE - INTERVAL '6 months'
                GROUP BY bl.built_at::date ORDER BY date ASC
            `, [id])
        ]);

        if (compRes.rows.length === 0) return res.status(404).json({ error: 'Component not found' });

        const component = compRes.rows[0];
        // Calculate dynamic fields
        const totalReq = pcbRes.rows.reduce((sum, p) => sum + (p.quantity_per_pcb * (p.preorder_quantity || 1)), 0);
        component.total_requirement = totalReq;
        component.low_stock = totalReq > 0 && component.working_stock < 0.2 * totalReq;

        res.json({
            component,
            pcbs: pcbRes.rows,
            procurement_history: procRes.rows,
            scrap_history: scrapRes.rows,
            consumption_history: consumptionRes.rows
        });
    } catch (err) {
        console.error('Component analytics error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/components - create new component (protected)
router.post('/', authenticateToken, validate(schemas.componentCreate), async (req, res) => {
    try {
        const { name, part_number, working_stock, scrap_stock, monthly_requirement } = req.body;

        const result = await pool.query(
            'INSERT INTO components (name, part_number, working_stock, scrap_stock, monthly_requirement) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [name, part_number, working_stock, scrap_stock, monthly_requirement]
        );
        res.json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') { // unique_violation
            return res.status(400).json({ error: 'Part number or name already exists' });
        }
        console.error('Create component error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/components/:id - update component (protected)
router.put('/:id', authenticateToken, validate(schemas.componentUpdate), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, part_number, working_stock, scrap_stock, monthly_requirement } = req.body;

        const result = await pool.query(
            'UPDATE components SET name = COALESCE($1, name), part_number = COALESCE($2, part_number), working_stock = COALESCE($3, working_stock), scrap_stock = COALESCE($4, scrap_stock), monthly_requirement = COALESCE($5, monthly_requirement), updated_at = CURRENT_TIMESTAMP WHERE id = $6 RETURNING *',
            [name, part_number, working_stock, scrap_stock, monthly_requirement, id]
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Component not found' });
        res.json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ error: 'Part number or name matches another component' });
        }
        console.error('Update component error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/components/:id (protected)
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM components WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Component not found' });
        res.json({ message: 'Component deleted' });
    } catch (err) {
        console.error('Delete component error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/components/:id/scrap - move stock to scrap (protected)
router.post('/:id/scrap', authenticateToken, validate(schemas.componentScrap), async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { quantity, reason } = req.body;

        await client.query('BEGIN');

        // Check stock
        const check = await client.query('SELECT working_stock FROM components WHERE id = $1 FOR UPDATE', [id]);
        if (check.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Component not found' });
        }

        if (check.rows[0].working_stock < quantity) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Insufficient working stock' });
        }

        // Move stock
        await client.query(
            'UPDATE components SET working_stock = working_stock - $1, scrap_stock = scrap_stock + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [quantity, id]
        );

        // Log
        await client.query(
            'INSERT INTO scrap_log (component_id, quantity, reason) VALUES ($1, $2, $3)',
            [id, quantity, reason]
        );

        await client.query('COMMIT');
        res.json({ message: ` moved ${quantity} units to scrap` });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Scrap error:', err);
        res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});

module.exports = router;
