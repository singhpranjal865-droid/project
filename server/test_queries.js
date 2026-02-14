const pool = require('./src/db');

async function test() {
    try {
        console.log('Testing most scrapped...');
        const mostScrapped = await pool.query(`
            SELECT c.name, SUM(sl.quantity) as total_scrapped
            FROM scrap_log sl
            JOIN components c ON c.id = sl.component_id
            GROUP BY c.name
            ORDER BY total_scrapped DESC
            LIMIT 10
        `);
        console.log('Most Scrapped:', mostScrapped.rows);

        console.log('Testing scrap reasons...');
        const scrapReasons = await pool.query(`
          SELECT reason, COUNT(*) as count, SUM(quantity) as total_qty
          FROM scrap_log
          GROUP BY reason
        `);
        console.log('Scrap Reasons:', scrapReasons.rows);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        pool.end();
    }
}

test();
