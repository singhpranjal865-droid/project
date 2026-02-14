const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

async function run() {
    try {
        // 1. Create Excel file
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Components');
        sheet.addRow(['Name', 'Part Number', 'Stock']); // Header
        sheet.addRow(['Test Component Verify', 'VERIFY-999', 500]); // Data

        const filename = path.join(__dirname, 'verify.xlsx');
        await workbook.xlsx.writeFile(filename);
        console.log('Created verify.xlsx');

        // 2. Login
        console.log('Logging in...');
        const loginRes = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'admin123' })
        });

        if (!loginRes.ok) throw new Error(`Login failed: ${loginRes.status}`);
        const { token } = await loginRes.json();
        console.log('Logged in, token received.');

        // 3. Upload
        console.log('Uploading file...');
        const fileBuffer = fs.readFileSync(filename);
        const blob = new Blob([fileBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

        const formData = new FormData();
        formData.append('file', blob, 'verify.xlsx');

        const uploadRes = await fetch('http://localhost:5000/api/excel/import', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        if (uploadRes.ok) {
            console.log('✅ Upload SUCCESS:', await uploadRes.json());
        } else {
            console.error('❌ Upload FAILED:', uploadRes.status, await uploadRes.text());
        }

    } catch (err) {
        console.error('Error:', err);
    }
}

run();
