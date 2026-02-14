const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/procurement/restock - restock a component (protected)
router.post('/restock', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        const { component_id, quantity } = req.body;
        if (!component_id || !quantity || quantity <= 0) {
            return res.status(400).json({ error: 'Valid component_id and quantity required' });
        }

        await client.query('BEGIN');

        const comp = await client.query('SELECT * FROM components WHERE id = $1 FOR UPDATE', [component_id]);
        if (comp.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Component not found' });
        }

        const previousStock = comp.rows[0].working_stock;
        const newStock = previousStock + quantity;

        await client.query(
            'UPDATE components SET working_stock = $1, procurement_count = procurement_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [newStock, component_id]
        );

        await client.query(
            'INSERT INTO procurement_log (component_id, quantity_added, previous_stock, new_stock) VALUES ($1, $2, $3, $4)',
            [component_id, quantity, previousStock, newStock]
        );

        await client.query('COMMIT');

        const updated = await pool.query('SELECT * FROM components WHERE id = $1', [component_id]);
        res.json({
            message: `Restocked ${quantity} units`,
            component: updated.rows[0],
            previous_stock: previousStock,
            new_stock: newStock
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Restock error:', err);
        res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});

// GET /api/procurement/log - get procurement history
router.get('/log', async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT pl.*, c.name as component_name, c.part_number
      FROM procurement_log pl
      JOIN components c ON c.id = pl.component_id
      ORDER BY pl.procured_at DESC
      LIMIT 100
    `);
        res.json(result.rows);
    } catch (err) {
        console.error('Procurement log error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/procurement/scrap-log - get scrap history
router.get('/scrap-log', async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT sl.*, c.name as component_name, c.part_number
      FROM scrap_log sl
      JOIN components c ON c.id = sl.component_id
      ORDER BY sl.created_at DESC
      LIMIT 100
    `);
        res.json(result.rows);
    } catch (err) {
        console.error('Scrap log error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
