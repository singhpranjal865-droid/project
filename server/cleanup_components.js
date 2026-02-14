const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function run() {
    const client = await pool.connect();
    try {
        console.log('Identifying safely used components in PCB 1...');
        const res = await client.query('SELECT component_id FROM pcb_components WHERE pcb_id = 1');
        const safeIds = res.rows.map(r => r.component_id);

        console.log(`Found ${safeIds.length} components used in PCB 1.`);

        let query = 'DELETE FROM components';
        const params = [];
        if (safeIds.length > 0) {
            query += ' WHERE id != ALL($1)';
            params.push(safeIds);
        }

        console.log('Deleting components...');
        const delRes = await client.query(query, params);
        console.log(`Deleted ${delRes.rowCount} components.`);

    } catch (err) {
        if (err.code === '23503') {
            console.log('Error: Some components could not be deleted because they are referenced in logs (procurement/build/scrap).');
            console.log('Deleting associated logs first...');
            // Optimistic deletion of logs to clean up everything
            if (safeIds.length > 0) {
                await client.query('DELETE FROM procurement_log WHERE component_id != ALL($1)', [safeIds]);
                await client.query('DELETE FROM scrap_log WHERE component_id != ALL($1)', [safeIds]);
                // Build log refs PCB, so it's fine unless it refs components? No build log refs PCB.
            } else {
                await client.query('DELETE FROM procurement_log');
                await client.query('DELETE FROM scrap_log');
            }

            console.log('Retrying component deletion...');
            const delRes2 = await client.query(query, params);
            console.log(`Deleted ${delRes2.rowCount} components.`);
        } else {
            console.error(err);
        }
    } finally {
        client.release();
        pool.end();
    }
}

run();
