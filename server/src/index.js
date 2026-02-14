const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/components', require('./routes/components'));
app.use('/api/pcbs', require('./routes/pcbs'));
app.use('/api/procurement', require('./routes/procurement'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/excel', require('./routes/excel'));

// Global error handler
app.use((err, req, res, next) => {
    console.error('Global error:', err.stack);
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large (max 10MB)' });
    }
    if (err.message === 'Only .xlsx, .xls, and .xlsm files are allowed') {
        return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Internal Server Error' });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize database
async function initDB() {
    try {
        const schemaSQL = fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8');

        // Strip SQL comment lines, then split into individual statements
        const cleanedSQL = schemaSQL
            .split('\n')
            .filter(line => !line.trim().startsWith('--'))
            .join('\n');

        const statements = cleanedSQL
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        let successCount = 0;
        for (const statement of statements) {
            try {
                await pool.query(statement);
                successCount++;
            } catch (stmtErr) {
                // 42P07 = relation already exists, 42710 = type/object already exists
                if (stmtErr.code === '42P07' || stmtErr.code === '42710') {
                    successCount++;
                    continue;
                }
                // Log the actual failing statement for debugging
                const preview = statement.substring(0, 60).replace(/\s+/g, ' ');
                console.error(`Schema error in "${preview}...": ${stmtErr.message}`);
            }
        }
        console.log(`Database schema initialized (${successCount}/${statements.length} statements ok)`);

        const seedSQL = fs.readFileSync(path.join(__dirname, '../db/seed.sql'), 'utf8');
        await pool.query(seedSQL);
        console.log('Database seed checked');
    } catch (err) {
        console.error('Database initialization error:', err.message);
        console.log('Make sure PostgreSQL is running and the database exists.');
        console.log('Create the database with: CREATE DATABASE pcb_inventory;');
    }
}

// Start server - always start even if DB init has issues (API will return errors for DB operations)
initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`PCB Inventory Server running on http://localhost:${PORT}`);
    }).on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`Port ${PORT} is already in use. Kill the existing process or use a different port.`);
            process.exit(1);
        }
        throw err;
    });
});

module.exports = app;
