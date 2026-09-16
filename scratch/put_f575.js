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

    console.log('Login exitoso.');

    // Update Fichero 575 via PUT
    const putData = JSON.stringify({
      producto_nombre: 'SMART 60" BGH',
      cantidad_cuotas: 12,
      valor_cuota: 173000,
      frecuencia_pago: 'MENSUAL',
      fecha_entrega: '2026-06-20',
      vendedor: 'LUIS ROMERO',
      encargado_zona: 'LUIS ROMERO',
      saldo_favor: 0
    });

    const updateRes = await new Promise((resolve, reject) => {
      const req = https.request('https://hit-saas-auditpro-1.onrender.com/api/empresa/ficheros/575', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(putData)
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(body)); } catch (e) { resolve(body); }
        });
      });
      req.on('error', reject);
      req.write(putData);
      req.end();
    });

    console.log('Resultado PUT Fichero 575:', updateRes);

  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
