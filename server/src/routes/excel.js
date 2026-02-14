const express = require('express');
const multer = require('multer');
const ExcelJS = require('exceljs');
const path = require('path');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const fs = require('fs');

const router = express.Router();

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../uploads'));
    },
    filename: (req, file, cb) => {
        cb(null, `import_${Date.now()}_${file.originalname}`);
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext === '.xlsx' || ext === '.xls' || ext === '.xlsm') {
            cb(null, true);
        } else {
            cb(new Error('Only .xlsx, .xls, and .xlsm files are allowed'));
        }
    },
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// GET /api/excel/export - export components to Excel with charts
router.get('/export', async (req, res) => {
    try {
        const components = await pool.query(`
      SELECT c.*,
        COALESCE((
          SELECT SUM(pc.quantity_per_pcb * CASE WHEN p.preorder_quantity > 0 THEN p.preorder_quantity ELSE 1 END)
          FROM pcb_components pc JOIN pcbs p ON p.id = pc.pcb_id
          WHERE pc.component_id = c.id
        ), 0) as total_requirement,
        COALESCE((SELECT COUNT(DISTINCT pc.pcb_id) FROM pcb_components pc WHERE pc.component_id = c.id), 0) as pcb_count
      FROM components c ORDER BY c.name
    `);

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'PCB Inventory System';
        workbook.created = new Date();

        // ---- Sheet 1: Component Inventory ----
        const sheet1 = workbook.addWorksheet('Component Inventory', {
            properties: { tabColor: { argb: '4472C4' } }
        });

        sheet1.columns = [
            { header: 'ID', key: 'id', width: 8 },
            { header: 'Name', key: 'name', width: 25 },
            { header: 'Part Number', key: 'part_number', width: 20 },
            { header: 'Working Stock', key: 'working_stock', width: 15 },
            { header: 'Scrap Stock', key: 'scrap_stock', width: 15 },
            { header: 'Total Requirement', key: 'total_requirement', width: 18 },
            { header: 'Monthly Requirement', key: 'monthly_requirement', width: 20 },
            { header: 'Low Stock Count', key: 'low_stock_count', width: 16 },
            { header: 'Procurement Count', key: 'procurement_count', width: 18 },
            { header: 'PCBs Using', key: 'pcb_count', width: 12 },
            { header: 'Status', key: 'status', width: 12 }
        ];

        // Style header row
        const headerRow = sheet1.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11 };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4472C4' } };
        headerRow.alignment = { horizontal: 'center' };

        components.rows.forEach(comp => {
            const totalReq = parseInt(comp.total_requirement);
            const isLowStock = totalReq > 0 && comp.working_stock < 0.2 * totalReq;
            const row = sheet1.addRow({
                ...comp,
                total_requirement: totalReq,
                pcb_count: parseInt(comp.pcb_count),
                status: isLowStock ? 'LOW STOCK' : 'OK'
            });

            if (isLowStock) {
                row.getCell('status').font = { bold: true, color: { argb: 'FF0000' } };
                row.getCell('status').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0' } };
            } else {
                row.getCell('status').font = { color: { argb: '008000' } };
            }
        });

        // ---- Sheet 2: Analytics Summary ----
        const sheet2 = workbook.addWorksheet('Analytics', {
            properties: { tabColor: { argb: 'ED7D31' } }
        });

        // Summary section
        sheet2.getCell('A1').value = 'PCB Inventory Analytics';
        sheet2.getCell('A1').font = { bold: true, size: 16, color: { argb: '4472C4' } };
        sheet2.mergeCells('A1:D1');

        const totalWorking = components.rows.reduce((sum, c) => sum + c.working_stock, 0);
        const totalScrap = components.rows.reduce((sum, c) => sum + c.scrap_stock, 0);

        sheet2.getCell('A3').value = 'Total Components:';
        sheet2.getCell('B3').value = components.rows.length;
        sheet2.getCell('A4').value = 'Total Working Stock:';
        sheet2.getCell('B4').value = totalWorking;
        sheet2.getCell('A5').value = 'Total Scrap Stock:';
        sheet2.getCell('B5').value = totalScrap;
        sheet2.getCell('A3').font = { bold: true };
        sheet2.getCell('A4').font = { bold: true };
        sheet2.getCell('A5').font = { bold: true };

        // Working vs Scrap table for chart reference
        sheet2.getCell('A8').value = 'Stock Condition';
        sheet2.getCell('B8').value = 'Quantity';
        sheet2.getCell('A8').font = { bold: true };
        sheet2.getCell('B8').font = { bold: true };
        sheet2.getCell('A9').value = 'Working';
        sheet2.getCell('B9').value = totalWorking;
        sheet2.getCell('A10').value = 'Scrap';
        sheet2.getCell('B10').value = totalScrap;

        // Top components by stock
        sheet2.getCell('A13').value = 'Top Components by Working Stock';
        sheet2.getCell('A13').font = { bold: true, size: 12 };
        sheet2.getCell('A14').value = 'Component';
        sheet2.getCell('B14').value = 'Working Stock';
        sheet2.getCell('C14').value = 'Scrap Stock';
        sheet2.getCell('A14').font = { bold: true };
        sheet2.getCell('B14').font = { bold: true };
        sheet2.getCell('C14').font = { bold: true };

        const sorted = [...components.rows].sort((a, b) => b.working_stock - a.working_stock).slice(0, 10);
        sorted.forEach((comp, i) => {
            sheet2.getCell(`A${15 + i}`).value = comp.name;
            sheet2.getCell(`B${15 + i}`).value = comp.working_stock;
            sheet2.getCell(`C${15 + i}`).value = comp.scrap_stock;
        });

        sheet2.getColumn('A').width = 30;
        sheet2.getColumn('B').width = 18;
        sheet2.getColumn('C').width = 18;
        sheet2.getColumn('D').width = 18;

        // ---- Sheet 3: Procurement History ----
        const procLogs = await pool.query(`
      SELECT pl.*, c.name as component_name, c.part_number
      FROM procurement_log pl JOIN components c ON c.id = pl.component_id
      ORDER BY pl.procured_at DESC LIMIT 200
    `);

        const sheet3 = workbook.addWorksheet('Procurement Log', {
            properties: { tabColor: { argb: '70AD47' } }
        });

        sheet3.columns = [
            { header: 'ID', key: 'id', width: 8 },
            { header: 'Component', key: 'component_name', width: 25 },
            { header: 'Part Number', key: 'part_number', width: 20 },
            { header: 'Qty Added', key: 'quantity_added', width: 12 },
            { header: 'Previous Stock', key: 'previous_stock', width: 15 },
            { header: 'New Stock', key: 'new_stock', width: 12 },
            { header: 'Date', key: 'procured_at', width: 20 }
        ];

        const hRow3 = sheet3.getRow(1);
        hRow3.font = { bold: true, color: { argb: 'FFFFFF' } };
        hRow3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '70AD47' } };

        procLogs.rows.forEach(log => sheet3.addRow(log));

        // Set response headers for download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=pcb_inventory_${new Date().toISOString().split('T')[0]}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('Excel export error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/excel/upload - upload file only
router.post('/upload', authenticateToken, upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    res.json({ message: 'File uploaded successfully', filename: req.file.filename });
});

// POST /api/excel/process/:filename - process uploaded file into inventory
router.post('/process/:filename', authenticateToken, async (req, res) => {
    const filename = req.params.filename;
    // Security check
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ error: 'Invalid filename' });
    }

    const filepath = path.join(__dirname, '../../uploads', filename);

    if (!fs.existsSync(filepath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    const client = await pool.connect();
    try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filepath); // Read from stored file
        const results = { created: 0, updated: 0, errors: [] };

        // Try to find the main data sheet - look for sheets with component-like data
        for (const worksheet of workbook.worksheets) {
            const headerRow = worksheet.getRow(1);
            const headers = [];
            headerRow.eachCell((cell, colNumber) => {
                headers.push({ col: colNumber, value: String(cell.value || '').toLowerCase().trim() });
            });

            // Map columns intelligently
            const colMap = {};
            headers.forEach(h => {
                if (h.value.includes('name') && !h.value.includes('part')) colMap.name = h.col;
                if (h.value.includes('part') && (h.value.includes('number') || h.value.includes('no') || h.value.includes('#'))) colMap.part_number = h.col;
                if (h.value.includes('part_number') || h.value === 'partnumber') colMap.part_number = h.col;
                if ((h.value.includes('working') && h.value.includes('stock')) || h.value === 'stock' || h.value === 'quantity' || h.value === 'qty') colMap.working_stock = h.col;
                if (h.value.includes('scrap')) colMap.scrap_stock = h.col;
                if (h.value.includes('monthly') || h.value.includes('requirement')) colMap.monthly_requirement = h.col;
            });

            // Need at least name or part_number
            if (!colMap.name && !colMap.part_number) continue;

            await client.query('BEGIN');

            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return; // Skip header
                // Collect data in this loop, process after
            });

            // Process rows
            for (let i = 2; i <= worksheet.rowCount; i++) {
                const row = worksheet.getRow(i);
                try {
                    const name = colMap.name ? String(row.getCell(colMap.name).value || '').trim() : '';
                    const partNumber = colMap.part_number ? String(row.getCell(colMap.part_number).value || '').trim() : '';
                    const workingStock = colMap.working_stock ? parseInt(row.getCell(colMap.working_stock).value) || 0 : 0;
                    const scrapStock = colMap.scrap_stock ? parseInt(row.getCell(colMap.scrap_stock).value) || 0 : 0;
                    const monthlyReq = colMap.monthly_requirement ? parseInt(row.getCell(colMap.monthly_requirement).value) || 0 : 0;

                    if (!name && !partNumber) continue;

                    const finalPartNumber = partNumber || `PART-${Date.now()}-${i}`;
                    const finalName = name || finalPartNumber;

                    // Upsert component
                    const existing = await client.query('SELECT id FROM components WHERE part_number = $1', [finalPartNumber]);

                    if (existing.rows.length > 0) {
                        await client.query(
                            `UPDATE components SET name = $1, working_stock = $2, scrap_stock = $3, monthly_requirement = $4, updated_at = CURRENT_TIMESTAMP, source_file = $6 WHERE part_number = $5`,
                            [finalName, workingStock, scrapStock, monthlyReq, finalPartNumber, req.file.filename]
                        );
                        results.updated++;
                    } else {
                        await client.query(
                            `INSERT INTO components (name, part_number, working_stock, scrap_stock, monthly_requirement, source_file) VALUES ($1, $2, $3, $4, $5, $6)`,
                            [finalName, finalPartNumber, workingStock, scrapStock, monthlyReq, req.file.filename]
                        );
                        results.created++;
                    }
                } catch (rowErr) {
                    results.errors.push(`Row ${i}: ${rowErr.message}`);
                }
            }

            await client.query('COMMIT');
            break; // Only process first valid sheet
        }

        res.json({
            message: `Import complete: ${results.created} created, ${results.updated} updated`,
            ...results
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Excel import error:', err);
        res.status(500).json({ error: 'Import failed: ' + err.message });
    } finally {
        client.release();
    }
});

// GET /api/excel/files - list uploaded files
router.get('/files', authenticateToken, (req, res) => {
    const uploadsDir = path.join(__dirname, '../../uploads');
    fs.readdir(uploadsDir, (err, files) => {
        if (err) {
            console.error('List files error:', err);
            return res.status(500).json({ error: 'Failed to list files' });
        }

        const fileList = files
            .filter(file => ['.xlsx', '.xls', '.xlsm'].includes(path.extname(file).toLowerCase()))
            .map(file => {
                const stats = fs.statSync(path.join(uploadsDir, file));
                return {
                    name: file,
                    size: stats.size,
                    created_at: stats.birthtime,
                    imported: file.startsWith('import_') // Just a flag if it was uploaded via app
                };
            })
            .sort((a, b) => b.created_at - a.created_at);

        res.json(fileList);
    });
});

// DELETE /api/excel/files/:filename - delete a file
router.delete('/files/:filename', authenticateToken, (req, res) => {
    const filename = req.params.filename;
    // Basic security check to prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ error: 'Invalid filename' });
    }

    const filepath = path.join(__dirname, '../../uploads', filename);

    if (!fs.existsSync(filepath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    fs.unlink(filepath, (err) => {
        if (err) {
            console.error('Delete file error:', err);
            return res.status(500).json({ error: 'Failed to delete file' });
        }
        res.json({ message: 'File deleted successfully' });
    });
});

// DELETE /api/excel/files/:filename/data - delete components linked to file
router.delete('/files/:filename/data', authenticateToken, async (req, res) => {
    const filename = req.params.filename;
    // Security check
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ error: 'Invalid filename' });
    }

    try {
        const result = await pool.query('DELETE FROM components WHERE source_file = $1', [filename]);
        res.json({ message: `Deleted ${result.rowCount} components imported from this file` });
    } catch (err) {
        console.error('Delete data error:', err);
        if (err.code === '23503') { // Foreign key constraint (e.g. used in build_log or pcb_components)
            return res.status(400).json({ error: 'Cannot delete components: they are used in PCBs or Logs. Delete those first.' });
        }
        res.status(500).json({ error: 'Failed to delete data' });
    }
});

// GET /api/excel/files/:filename/view - parse and return file content
router.get('/files/:filename/view', authenticateToken, async (req, res) => {
    const filename = req.params.filename;
    // Security check
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ error: 'Invalid filename' });
    }

    const filepath = path.join(__dirname, '../../uploads', filename);
    if (!fs.existsSync(filepath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filepath);

        const result = {
            filename: filename,
            sheets: []
        };

        workbook.eachSheet((sheet) => {
            const sheetData = {
                id: sheet.id,
                name: sheet.name,
                rows: [],
                images: []
            };

            // Parse rows
            sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
                const rowValues = [];
                // row.values returns an array, index 0 is sometimes empty or undefined depending on ExcelJS version
                // Safer to iterate cells or use values directly. 
                // row.values is 1-based usually (index 0 is null)
                if (Array.isArray(row.values)) {
                    // Filter out the first null if present and map rich text
                    rowValues.push(...row.values.slice(1).map(val => {
                        if (val && typeof val === 'object' && val.richText) {
                            return val.richText.map(rt => rt.text).join('');
                        }
                        if (val && typeof val === 'object' && val.text) { // Hyperlink
                            return val.text;
                        }
                        return val;
                    }));
                }
                sheetData.rows.push(rowValues);
            });

            // Parse images
            if (sheet.getImages) {
                const images = sheet.getImages();
                images.forEach(img => {
                    // Try to get image media
                    try {
                        const media = workbook.getImage(img.imageId);
                        if (media) {
                            sheetData.images.push({
                                type: media.type,
                                extension: media.extension,
                                base64: media.buffer.toString('base64'),
                                range: img.range // Top-left position
                            });
                        }
                    } catch (e) {
                        console.warn('Could not retrieve image', img.imageId, e.message);
                    }
                });
            }

            result.sheets.push(sheetData);
        });

        res.json(result);

    } catch (err) {
        console.error('Error parsing excel file:', err);
        res.status(500).json({ error: 'Failed to parse file: ' + err.message });
    }
});

module.exports = router;
