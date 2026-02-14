const http = require('http');

const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/analytics/overview',
    method: 'GET',
    headers: {
        'Content-Type': 'application/json'
        // Note: This endpoint might fail if no token provided, but it should return 401 or 403, NOT hang.
        // If it hangs, then we have a problem.
    }
};

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
        console.log(`BODY: ${chunk}`);
    });
    res.on('end', () => {
        console.log('No more data in response.');
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.end();
