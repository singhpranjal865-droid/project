const { Pool } = require('pg');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
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
        console.log('Adding source_file column...');
        await client.query('ALTER TABLE components ADD COLUMN IF NOT EXISTS source_file VARCHAR(255)');

        const uploadsDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            console.log('No uploads directory.');
            return;
        }

        const files = fs.readdirSync(uploadsDir).filter(f => f.startsWith('import_') && (f.endsWith('.xlsx') || f.endsWith('.xls') || f.endsWith('.xlsm')));

        console.log(`Found ${files.length} files to process for backfill.`);

        for (const file of files) {
            console.log(`Processing ${file}...`);
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(path.join(uploadsDir, file));

            let updatedCount = 0;
            const partNumbers = [];

            workbook.eachSheet(sheet => {
                // Find Part Number column
                let partNoCol = null;
                const headerRow = sheet.getRow(1);
                headerRow.eachCell((cell, colNumber) => {
                    const val = String(cell.value).toLowerCase().trim();
                    if (val.includes('part') && (val.includes('no') || val.includes('number') || val.includes('code'))) {
                        partNoCol = colNumber;
                    }
                });

                if (!partNoCol) {
                    console.log(`  - No "Part Number" column found in sheet ${sheet.name}, skipping sheet.`);
                    return;
                }

                sheet.eachRow((row, rowNumber) => {
                    if (rowNumber === 1) return;
                    const partNumber = row.getCell(partNoCol).text; // .text handles rich text or links
                    if (partNumber) {
                        partNumbers.push(partNumber.trim());
                    }
                });
            });

            if (partNumbers.length > 0) {
                // Update DB
                // We update components that match these part numbers AND don't have a source_file yet (or overwrite?)
                // Overwrite is better to fix previous mess.
                // But wait, if multiple files have same part number, the latest one "wins" usually in import.
                // But here I'm iterating files... order matters.
                // fs.readdir returns files usually in name order or arbitrary.
                // My filenames include timestamp `import_TIMESTAMP_...`.
                // So alphabetical order of filenames IS chronological!
                // So verify logic holds: Process oldest to newest, updating source_file.

                // Batch update?
                // UPDATE components SET source_file = $1 WHERE part_number = ANY($2)
                const res = await client.query('UPDATE components SET source_file = $1 WHERE part_number = ANY($2)', [file, partNumbers]);
                console.log(`  - Linked ${res.rowCount} components to ${file}`);
            }
        }

    } catch (err) {
        console.error('Migration error:', err);
    } finally {
        client.release();
        pool.end();
    }
}

run();
