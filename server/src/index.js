const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
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

// Initialize database and start server
async function initDB() {
    try {
        const schemaSQL = fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8');
        await pool.query(schemaSQL);
        console.log('Database schema initialized');

        const seedSQL = fs.readFileSync(path.join(__dirname, '../db/seed.sql'), 'utf8');
        await pool.query(seedSQL);
        console.log('Database seeded');
    } catch (err) {
        console.error('Database initialization error:', err.message);
        console.log('Make sure PostgreSQL is running and the database exists.');
        console.log('Create the database with: CREATE DATABASE pcb_inventory;');
    }
}

initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`PCB Inventory Server running on http://localhost:${PORT}`);
    });
});

module.exports = app;
