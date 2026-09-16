const https = require('https');

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  for (let attempt = 1; attempt <= 20; attempt++) {
    try {
      console.log(`[Intento ${attempt}/20] Verificando y aplicando corrección a Fichero 575...`);
      
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

      // PUT Fichero 575
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

      // Check cuotas
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

      const c1 = cuotas.find(c => c.nro_cuota === 1);
      const c4 = cuotas.find(c => c.nro_cuota === 4);
      
      console.log(`Cuota 1 monto: ${c1?.monto}, Cuota 4 notas: ${c4?.notas}`);

      if (parseFloat(c1?.monto) === 173000 && (!c4?.notas || !c4.notas.includes('SALDO_A_FAVOR_GENERADO'))) {
        console.log('✅ Despliegue listo y Fichero 575 completamente reparado!');
        console.log('Detalle Cuotas 1 a 4:', JSON.stringify(cuotas.slice(0, 4), null, 2));
        return;
      }

    } catch (e) {
      console.log('Error en intento:', e.message);
    }
    await wait(6000);
  }
}

run();
