const express = require('express');
const pool = require('../db');

const router = express.Router();

// GET /api/analytics/overview - aggregated analytics
router.get('/overview', async (req, res) => {
  try {
    // Total counts
    const totalComponents = await pool.query('SELECT COUNT(*) as count FROM components');
    const totalPcbs = await pool.query('SELECT COUNT(*) as count FROM pcbs');
    const totalBuilds = await pool.query('SELECT COALESCE(SUM(quantity_built), 0) as count FROM build_log');

    // Working vs scrap totals
    const stockTotals = await pool.query(`
      SELECT COALESCE(SUM(working_stock), 0) as total_working,
             COALESCE(SUM(scrap_stock), 0) as total_scrap
      FROM components
    `);

    // Low stock components
    const lowStock = await pool.query(`
            SELECT c.*, 
                COALESCE(req.total_requirement, 0) as total_requirement
            FROM components c
            LEFT JOIN (
                SELECT pc.component_id,
                       SUM(pc.quantity_per_pcb * CASE WHEN p.preorder_quantity > 0 THEN p.preorder_quantity ELSE 1 END) as total_requirement
                FROM pcb_components pc
                JOIN pcbs p ON p.id = pc.pcb_id
                GROUP BY pc.component_id
            ) req ON req.component_id = c.id
            WHERE c.working_stock < 0.2 * COALESCE(req.total_requirement, 0)
            AND COALESCE(req.total_requirement, 0) > 0
            ORDER BY c.working_stock ASC
        `);

    // Most used components (by number of PCBs they appear in)
    const mostUsed = await pool.query(`
      SELECT c.id, c.name, c.part_number, COUNT(pc.pcb_id) as usage_count,
             c.working_stock, c.scrap_stock
      FROM components c
      JOIN pcb_components pc ON pc.component_id = c.id
      GROUP BY c.id, c.name, c.part_number, c.working_stock, c.scrap_stock
      ORDER BY usage_count DESC
      LIMIT 10
    `);

    // Least used components (components not used in any PCB or used the least)
    const leastUsed = await pool.query(`
      SELECT c.id, c.name, c.part_number, COUNT(pc.pcb_id) as usage_count,
             c.working_stock, c.scrap_stock
      FROM components c
      LEFT JOIN pcb_components pc ON pc.component_id = c.id
      GROUP BY c.id, c.name, c.part_number, c.working_stock, c.scrap_stock
      ORDER BY usage_count ASC
      LIMIT 10
    `);

    // Most low-stock hitting components
    const mostLowStock = await pool.query(`
      SELECT id, name, part_number, low_stock_count, working_stock
      FROM components
      WHERE low_stock_count > 0
      ORDER BY low_stock_count DESC
      LIMIT 10
    `);

    // Most procured components
    const mostProcured = await pool.query(`
      SELECT id, name, part_number, procurement_count, working_stock
      FROM components
      WHERE procurement_count > 0
      ORDER BY procurement_count DESC
      LIMIT 10
    `);

    // Recent builds
    const recentBuilds = await pool.query(`
      SELECT bl.*, p.name as pcb_name
      FROM build_log bl
      JOIN pcbs p ON p.id = bl.pcb_id
      ORDER BY bl.built_at DESC
      LIMIT 10
    `);

    // Component stock distribution (for pie chart)
    const stockDistribution = await pool.query(`
      SELECT name, working_stock, scrap_stock FROM components ORDER BY working_stock DESC LIMIT 15
    `);

    // Consumption over time (last 30 days)
    const consumptionTrend = await pool.query(`
      SELECT bl.built_at::date as date, SUM(bl.quantity_built) as builds
      FROM build_log bl
      WHERE bl.built_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY bl.built_at::date
      ORDER BY date ASC
    `);

    // Most scrapped components
    const mostScrapped = await pool.query(`
      SELECT c.name, SUM(sl.quantity) as total_scrapped
      FROM scrap_log sl
      JOIN components c ON c.id = sl.component_id
      GROUP BY c.name
      ORDER BY total_scrapped DESC
      LIMIT 10
    `);

    // Scrap reasons
    const scrapReasons = await pool.query(`
      SELECT reason, COUNT(*) as count, SUM(quantity) as total_qty
      FROM scrap_log
      GROUP BY reason
    `);

    res.json({
      summary: {
        total_components: parseInt(totalComponents.rows[0].count),
        total_pcbs: parseInt(totalPcbs.rows[0].count),
        total_builds: parseInt(totalBuilds.rows[0].count),
        total_working_stock: parseInt(stockTotals.rows[0].total_working),
        total_scrap_stock: parseInt(stockTotals.rows[0].total_scrap),
        low_stock_count: lowStock.rows.length
      },
      low_stock_components: lowStock.rows,
      most_used_components: mostUsed.rows,
      least_used_components: leastUsed.rows,
      most_low_stock: mostLowStock.rows,
      most_procured: mostProcured.rows,
      recent_builds: recentBuilds.rows,
      stock_distribution: stockDistribution.rows,
      consumption_trend: consumptionTrend.rows,
      most_scrapped: mostScrapped.rows,
      scrap_reasons: scrapReasons.rows
    });
  } catch (err) {
    console.error('Analytics overview error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
