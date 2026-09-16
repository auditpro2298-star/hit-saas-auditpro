const https = require('https');

async function test() {
  try {
    const loginData = JSON.stringify({ email: 'admin@genesis.com', password: 'admin123' });
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

    // Get ficheros
    const ficheros = await new Promise((resolve, reject) => {
      const req = https.request('https://hit-saas-auditpro-1.onrender.com/api/empresa/ficheros', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
        });
      });
      req.on('error', reject);
      req.end();
    });

    const f575 = ficheros.find(f => f.id_fichero === 575 || f.id === 575);
    console.log('Fichero 575 encontrado:', f575);

    // Get cuotas
    const cuotas = await new Promise((resolve, reject) => {
      const req = https.request('https://hit-saas-auditpro-1.onrender.com/api/empresa/ficheros/575/cuotas', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
        });
      });
      req.on('error', reject);
      req.end();
    });

    console.log('Cuotas 1-4 de 575:', cuotas.slice(0, 4));

  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
