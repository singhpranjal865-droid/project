const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/pcbs - list all with component details
router.get('/', async (req, res) => {
    try {
        const pcbs = await pool.query('SELECT * FROM pcbs ORDER BY name ASC');

        // Get components for each PCB
        const pcbsWithComponents = await Promise.all(pcbs.rows.map(async (pcb) => {
            const components = await pool.query(`
        SELECT c.id, c.name, c.part_number, c.working_stock, c.scrap_stock, pc.quantity_per_pcb
        FROM pcb_components pc
        JOIN components c ON c.id = pc.component_id
        WHERE pc.pcb_id = $1
        ORDER BY c.name
      `, [pcb.id]);
            return { ...pcb, components: components.rows };
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
            [name, preorder_type || null, preorder_quantity || 0]
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
                            [comp.name, comp.part_number, comp.working_stock || 0]
                        );
                        componentId = newComp.rows[0].id;
                    }
                } else {
                    continue;
                }

                await client.query(
                    `INSERT INTO pcb_components (pcb_id, component_id, quantity_per_pcb) 
           VALUES ($1, $2, $3) ON CONFLICT (pcb_id, component_id) DO UPDATE SET quantity_per_pcb = $3`,
                    [pcb.id, componentId, comp.quantity_per_pcb || 1]
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

        const pcbResult = await client.query(
            `UPDATE pcbs SET name = COALESCE($1, name), preorder_type = $2, preorder_quantity = COALESCE($3, preorder_quantity),
       updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *`,
            [name, preorder_type || null, preorder_quantity, req.params.id]
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
                            [comp.name, comp.part_number, comp.working_stock || 0]
                        );
                        componentId = newComp.rows[0].id;
                    }
                } else {
                    continue;
                }

                await client.query(
                    `INSERT INTO pcb_components (pcb_id, component_id, quantity_per_pcb) VALUES ($1, $2, $3)
           ON CONFLICT (pcb_id, component_id) DO UPDATE SET quantity_per_pcb = $3`,
                    [req.params.id, componentId, comp.quantity_per_pcb || 1]
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
        const buildQty = quantity || 1;

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

        // Deduct stock for each component
        const deductions = [];
        for (const comp of pcbComps.rows) {
            const deductQty = comp.quantity_per_pcb * buildQty;
            await client.query(
                'UPDATE components SET working_stock = working_stock - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [deductQty, comp.component_id]
            );

            // Check if component is now low stock and update counter
            const updated = await client.query('SELECT * FROM components WHERE id = $1', [comp.component_id]);
            const updComp = updated.rows[0];

            // Calculate total requirement
            const reqResult = await client.query(`
        SELECT COALESCE(SUM(pc2.quantity_per_pcb * CASE WHEN p.preorder_quantity > 0 THEN p.preorder_quantity ELSE 1 END), 0) as total_req
        FROM pcb_components pc2 JOIN pcbs p ON p.id = pc2.pcb_id WHERE pc2.component_id = $1
      `, [comp.component_id]);
            const totalReq = parseInt(reqResult.rows[0].total_req);

            if (totalReq > 0 && updComp.working_stock < 0.2 * totalReq) {
                await client.query(
                    'UPDATE components SET low_stock_count = low_stock_count + 1 WHERE id = $1',
                    [comp.component_id]
                );
            }

            deductions.push({
                component: comp.name,
                deducted: deductQty,
                remaining: updComp.working_stock
            });
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
