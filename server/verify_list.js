const fs = require('fs');

async function run() {
    try {
        console.log('Logging in...');
        const loginRes = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'admin123' })
        });

        if (!loginRes.ok) throw new Error(`Login failed: ${loginRes.status}`);
        const { token } = await loginRes.json();
        console.log('Logged in.');

        console.log('Fetching files...');
        const filesRes = await fetch('http://localhost:5000/api/excel/files', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (filesRes.ok) {
            const files = await filesRes.json();
            console.log('Files found:', files);
        } else {
            console.error('Failed to fetch files:', filesRes.status, await filesRes.text());
        }

    } catch (err) {
        console.error('Error:', err);
    }
}

run();
