const https = require('https');

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function verify() {
  for (let attempt = 1; attempt <= 15; attempt++) {
    try {
      console.log(`[Intento ${attempt}/15] Verificando endpoints en Render...`);
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
              else reject(new Error('Login failed'));
            } catch (e) {
              reject(e);
            }
          });
        });
        req.on('error', reject);
        req.write(loginData);
        req.end();
      });

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

      console.log(`✅ Ficheros obtenidos en Render: ${ficheros.length} ficheros listados.`);
      console.log('✅ Render online y respondiendo correctamente.');
      return;
    } catch (e) {
      console.log('Esperando actualización...', e.message);
    }
    await wait(6000);
  }
}

verify();
