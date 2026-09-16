const https = require('https');

async function test() {
  try {
    const loginData = JSON.stringify({ email: 'admin@hitsaas.com', password: 'admin123' });
    const token = await new Promise((resolve, reject) => {
      const req = https.request('https://hit-saas-auditpro-1.onrender.com/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(loginData)
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (data.token) resolve(data.token);
            else reject(new Error('Login failed: ' + body));
          } catch (e) {
            reject(e);
          }
        });
      });
      req.on('error', reject);
      req.write(loginData);
      req.end();
    });

    // Get personal / cobradores / encargados
    const [cobradores, encargados] = await Promise.all([
      new Promise((resolve, reject) => {
        const req = https.request('https://hit-saas-auditpro-1.onrender.com/api/empresa/cobradores', {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` }
        }, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => resolve(JSON.parse(body)));
        });
        req.on('error', reject);
        req.end();
      }),
      new Promise((resolve, reject) => {
        const req = https.request('https://hit-saas-auditpro-1.onrender.com/api/empresa/encargados', {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` }
        }, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => resolve(JSON.parse(body)));
        });
        req.on('error', reject);
        req.end();
      })
    ]);

    console.log('Cobradores en Render:', cobradores);
    console.log('Encargados en Render:', encargados);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
