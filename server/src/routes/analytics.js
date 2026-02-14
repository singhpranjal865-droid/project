const express = require('express');
const pool = require('../db');

const router = express.Router();

// Simple in-memory cache for analytics (10s TTL)
let analyticsCache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 10000; // 10 seconds

// Call this from other routes when data changes to bust cache
function invalidateAnalyticsCache() {
  analyticsCache = null;
  cacheTimestamp = 0;
}

// GET /api/analytics/overview - aggregated analytics with parallel queries + caching
router.get('/overview', async (req, res) => {
  try {
    // Serve from cache if fresh
    if (analyticsCache && (Date.now() - cacheTimestamp) < CACHE_TTL) {
      res.set('X-Cache', 'HIT');
      return res.json(analyticsCache);
    }

    // ---- Run 3 parallel query groups instead of 11 serial queries ----

    const [summaryResults, listResults, trendResults] = await Promise.all([
      // Group 1: Summary counts (single query with subselects)
      pool.query(`
                SELECT
                    (SELECT COUNT(*) FROM components)::int AS total_components,
                    (SELECT COUNT(*) FROM pcbs)::int AS total_pcbs,
                    (SELECT COALESCE(SUM(quantity_built), 0) FROM build_log)::int AS total_builds,
                    (SELECT COALESCE(SUM(working_stock), 0) FROM components)::int AS total_working,
                    (SELECT COALESCE(SUM(scrap_stock), 0) FROM components)::int AS total_scrap
            `),

      // Group 2: All list-based queries in parallel
      Promise.all([
        // Low stock components
        pool.query(`
                    SELECT c.*, COALESCE(req.total_requirement, 0) as total_requirement
                    FROM components c
                    LEFT JOIN (
                        SELECT pc.component_id,
                            SUM(pc.quantity_per_pcb * CASE WHEN p.preorder_quantity > 0 THEN p.preorder_quantity ELSE 1 END) as total_requirement
                        FROM pcb_components pc JOIN pcbs p ON p.id = pc.pcb_id
                        GROUP BY pc.component_id
                    ) req ON req.component_id = c.id
                    WHERE c.working_stock < 0.2 * COALESCE(req.total_requirement, 0)
                    AND COALESCE(req.total_requirement, 0) > 0
                    ORDER BY c.working_stock ASC
                `),
        // Most used components
        pool.query(`
                    SELECT c.id, c.name, c.part_number, COUNT(pc.pcb_id) as usage_count,
                           c.working_stock, c.scrap_stock
                    FROM components c
                    JOIN pcb_components pc ON pc.component_id = c.id
                    GROUP BY c.id, c.name, c.part_number, c.working_stock, c.scrap_stock
                    ORDER BY usage_count DESC LIMIT 10
                `),
        // Least used components
        pool.query(`
                    SELECT c.id, c.name, c.part_number, COUNT(pc.pcb_id) as usage_count,
                           c.working_stock, c.scrap_stock
                    FROM components c
                    LEFT JOIN pcb_components pc ON pc.component_id = c.id
                    GROUP BY c.id, c.name, c.part_number, c.working_stock, c.scrap_stock
                    ORDER BY usage_count ASC LIMIT 10
                `),
        // Most low-stock hitting
        pool.query(`
                    SELECT id, name, part_number, low_stock_count, working_stock
                    FROM components WHERE low_stock_count > 0
                    ORDER BY low_stock_count DESC LIMIT 10
                `),
        // Most procured
        pool.query(`
                    SELECT id, name, part_number, procurement_count, working_stock
                    FROM components WHERE procurement_count > 0
                    ORDER BY procurement_count DESC LIMIT 10
                `),
        // Stock distribution
        pool.query(`
                    SELECT name, working_stock, scrap_stock
                    FROM components ORDER BY working_stock DESC LIMIT 15
                `)
      ]),

      // Group 3: Time-series and aggregation queries in parallel
      Promise.all([
        // Recent builds
        pool.query(`
                    SELECT bl.*, p.name as pcb_name
                    FROM build_log bl JOIN pcbs p ON p.id = bl.pcb_id
                    ORDER BY bl.built_at DESC LIMIT 10
                `),
        // Consumption trend (30 days)
        pool.query(`
                    SELECT bl.built_at::date as date, SUM(bl.quantity_built) as builds
                    FROM build_log bl
                    WHERE bl.built_at >= CURRENT_DATE - INTERVAL '30 days'
                    GROUP BY bl.built_at::date ORDER BY date ASC
                `),
        // Most scrapped
        pool.query(`
                    SELECT c.name, SUM(sl.quantity) as total_scrapped
                    FROM scrap_log sl JOIN components c ON c.id = sl.component_id
                    GROUP BY c.name ORDER BY total_scrapped DESC LIMIT 10
                `),
        // Scrap reasons
        pool.query(`
                    SELECT reason, COUNT(*) as count, SUM(quantity) as total_qty
                    FROM scrap_log GROUP BY reason
                `)
      ])
    ]);

    // Destructure results
    const summary = summaryResults.rows[0];
    const [lowStock, mostUsed, leastUsed, mostLowStock, mostProcured, stockDistribution] = listResults;
    const [recentBuilds, consumptionTrend, mostScrapped, scrapReasons] = trendResults;

    const result = {
      summary: {
        total_components: summary.total_components,
        total_pcbs: summary.total_pcbs,
        total_builds: summary.total_builds,
        total_working_stock: summary.total_working,
        total_scrap_stock: summary.total_scrap,
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
    };

    // Store in cache
    analyticsCache = result;
    cacheTimestamp = Date.now();

    res.set('X-Cache', 'MISS');
    res.json(result);
  } catch (err) {
    console.error('Analytics overview error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
module.exports.invalidateAnalyticsCache = invalidateAnalyticsCache;
