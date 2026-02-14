const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

const router = express.Router();

// POST /api/procurement/restock - restock a component (protected)
router.post('/restock', authenticateToken, validate(schemas.restock), async (req, res) => {
    const client = await pool.connect();
    try {
        const { component_id, quantity } = req.body;

        await client.query('BEGIN');

        // Single UPDATE RETURNING replaces SELECT FOR UPDATE + separate UPDATE
        const updateResult = await client.query(`
            UPDATE components
            SET working_stock = working_stock + $1,
                procurement_count = procurement_count + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING *, (working_stock - $1) AS previous_stock
        `, [quantity, component_id]);

        if (updateResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Component not found' });
        }

        const updated = updateResult.rows[0];
        const previousStock = updated.previous_stock;
        const newStock = updated.working_stock;

        await client.query(
            'INSERT INTO procurement_log (component_id, quantity_added, previous_stock, new_stock) VALUES ($1, $2, $3, $4)',
            [component_id, quantity, previousStock, newStock]
        );

        await client.query('COMMIT');

        res.json({
            message: `Restocked ${quantity} units`,
            component: updated,
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

// GET /api/procurement/log - get procurement history with pagination
router.get('/log', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;

        const countResult = await pool.query('SELECT COUNT(*) FROM procurement_log');
        const total = parseInt(countResult.rows[0].count);

        const result = await pool.query(`
            SELECT pl.*, c.name as component_name, c.part_number
            FROM procurement_log pl
            JOIN components c ON c.id = pl.component_id
            ORDER BY pl.procured_at DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

        res.json({
            data: result.rows,
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error('Procurement log error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/procurement/scrap-log - get scrap history with pagination
router.get('/scrap-log', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;

        const countResult = await pool.query('SELECT COUNT(*) FROM scrap_log');
        const total = parseInt(countResult.rows[0].count);

        const result = await pool.query(`
            SELECT sl.*, c.name as component_name, c.part_number
            FROM scrap_log sl
            JOIN components c ON c.id = sl.component_id
            ORDER BY sl.created_at DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

        res.json({
            data: result.rows,
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error('Scrap log error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
