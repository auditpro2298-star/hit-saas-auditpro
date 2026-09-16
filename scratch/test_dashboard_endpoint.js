const http = require('http');

function request(options, data) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(body || '{}') }));
        });
        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function test() {
    // 1. Login as admin@hogar.com
    const loginRes = await request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, { email: 'admin@hogar.com', password: 'admin123' });

    console.log('Login status:', loginRes.status);
    console.log('User:', loginRes.data.user);
    const token = loginRes.data.token;

    // 2. Fetch dashboard
    const dashRes = await request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/empresa/dashboard',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
    });

    console.log('Dashboard status:', dashRes.status);
    console.log('Dashboard data:', JSON.stringify(dashRes.data, null, 2));
}

test().catch(console.error);
