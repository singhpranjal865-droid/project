const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Helper: calculate total requirement for a component
async function getComponentRequirement(componentId) {
    const result = await pool.query(`
    SELECT COALESCE(SUM(
      pc.quantity_per_pcb * CASE 
        WHEN p.preorder_quantity > 0 THEN p.preorder_quantity 
        ELSE 1 
      END
    ), 0) as total_requirement
    FROM pcb_components pc
    JOIN pcbs p ON p.id = pc.pcb_id
    WHERE pc.component_id = $1
  `, [componentId]);
    return parseInt(result.rows[0].total_requirement);
}

// GET /api/components - list all
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT c.*,
        COALESCE((
          SELECT SUM(pc.quantity_per_pcb * CASE WHEN p.preorder_quantity > 0 THEN p.preorder_quantity ELSE 1 END)
          FROM pcb_components pc JOIN pcbs p ON p.id = pc.pcb_id
          WHERE pc.component_id = c.id
        ), 0) as total_requirement,
        COALESCE((
          SELECT COUNT(DISTINCT pc.pcb_id) FROM pcb_components pc WHERE pc.component_id = c.id
        ), 0) as pcb_count
      FROM components c
      ORDER BY c.name ASC
    `);

        const components = result.rows.map(c => {
            const totalReq = parseInt(c.total_requirement);
            return {
                ...c,
                total_requirement: totalReq,
                pcb_count: parseInt(c.pcb_count),
                low_stock: totalReq > 0 && c.working_stock < 0.2 * totalReq
            };
        });

        res.json(components);
    } catch (err) {
        console.error('Get components error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/components/:id
router.get('/:id', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM components WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Component not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Get component error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/components/:id/analytics
router.get('/:id/analytics', async (req, res) => {
    try {
        const comp = await pool.query('SELECT * FROM components WHERE id = $1', [req.params.id]);
        if (comp.rows.length === 0) {
            return res.status(404).json({ error: 'Component not found' });
        }

        const component = comp.rows[0];
        const totalReq = await getComponentRequirement(component.id);

        // PCBs using this component
        const pcbs = await pool.query(`
      SELECT p.id, p.name, pc.quantity_per_pcb, p.preorder_type, p.preorder_quantity
      FROM pcb_components pc
      JOIN pcbs p ON p.id = pc.pcb_id
      WHERE pc.component_id = $1
      ORDER BY p.name
    `, [req.params.id]);

        // Procurement history
        const procurements = await pool.query(`
      SELECT * FROM procurement_log 
      WHERE component_id = $1 
      ORDER BY procured_at DESC LIMIT 20
    `, [req.params.id]);

        // Scrap history
        const scraps = await pool.query(`
      SELECT * FROM scrap_log
      WHERE component_id = $1
      ORDER BY created_at DESC LIMIT 20
    `, [req.params.id]);

        // Build consumption (how many units consumed via builds)
        const consumption = await pool.query(`
      SELECT bl.built_at::date as date, SUM(bl.quantity_built * pc.quantity_per_pcb) as consumed
      FROM build_log bl
      JOIN pcb_components pc ON pc.pcb_id = bl.pcb_id
      WHERE pc.component_id = $1
      GROUP BY bl.built_at::date
      ORDER BY date DESC LIMIT 30
    `, [req.params.id]);

        res.json({
            component: {
                ...component,
                total_requirement: totalReq,
                low_stock: totalReq > 0 && component.working_stock < 0.2 * totalReq
            },
            pcbs: pcbs.rows,
            procurement_history: procurements.rows,
            scrap_history: scraps.rows,
            consumption_history: consumption.rows
        });
    } catch (err) {
        console.error('Component analytics error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/components - create (protected)
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { name, part_number, working_stock, scrap_stock, monthly_requirement } = req.body;
        if (!name || !part_number) {
            return res.status(400).json({ error: 'Name and part number required' });
        }

        const result = await pool.query(
            `INSERT INTO components (name, part_number, working_stock, scrap_stock, monthly_requirement)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [name, part_number, working_stock || 0, scrap_stock || 0, monthly_requirement || 0]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ error: 'Part number already exists' });
        }
        console.error('Create component error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/components/:id - update (protected)
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { name, part_number, working_stock, scrap_stock, monthly_requirement } = req.body;
        const result = await pool.query(
            `UPDATE components 
       SET name = COALESCE($1, name), 
           part_number = COALESCE($2, part_number),
           working_stock = COALESCE($3, working_stock),
           scrap_stock = COALESCE($4, scrap_stock),
           monthly_requirement = COALESCE($5, monthly_requirement),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 RETURNING *`,
            [name, part_number, working_stock, scrap_stock, monthly_requirement, req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Component not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update component error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/components/:id (protected)
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM components WHERE id = $1 RETURNING *', [req.params.id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Component not found' });
        }
        res.json({ message: 'Component deleted', component: result.rows[0] });
    } catch (err) {
        console.error('Delete component error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/components/:id/scrap - move working stock to scrap (protected)
router.post('/:id/scrap', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        const { quantity, reason } = req.body;
        if (!quantity || quantity <= 0) {
            return res.status(400).json({ error: 'Valid quantity required' });
        }

        await client.query('BEGIN');

        const comp = await client.query('SELECT * FROM components WHERE id = $1 FOR UPDATE', [req.params.id]);
        if (comp.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Component not found' });
        }

        const component = comp.rows[0];
        if (component.working_stock < quantity) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Insufficient working stock to scrap' });
        }

        await client.query(
            `UPDATE components SET working_stock = working_stock - $1, scrap_stock = scrap_stock + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
            [quantity, req.params.id]
        );

        await client.query(
            `INSERT INTO scrap_log (component_id, quantity, reason) VALUES ($1, $2, $3)`,
            [req.params.id, quantity, reason || 'No reason specified']
        );

        await client.query('COMMIT');

        const updated = await pool.query('SELECT * FROM components WHERE id = $1', [req.params.id]);
        res.json(updated.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Scrap component error:', err);
        res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});

module.exports = router;
