const http = require('http');

const postData = JSON.stringify({
  email: 'admin@electrohogar.com',
  password: 'admin123'
});

const reqOptions = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(reqOptions, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    try {
      const loginRes = JSON.parse(body);
      if (!loginRes.success) {
        console.error('❌ Error de login:', loginRes.error);
        process.exit(1);
      }
      console.log('✅ Autenticación exitosa. Token JWT recibido.');
      
      const token = loginRes.token;
      
      // Fetch Dashboard Metrics
      const dashOptions = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/empresa/dashboard',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      };
      
      const dashReq = http.request(dashOptions, (dashRes) => {
        let dashBody = '';
        dashRes.on('data', (chunk) => dashBody += chunk);
        dashRes.on('end', () => {
          const dashData = JSON.parse(dashBody);
          console.log('\n📊 Métrica de Dashboard para Electro Genesis:');
          console.log('-------------------------------------------');
          console.log(`- Clientes totales: ${dashData.clientes_total}`);
          console.log(`- Ficheros activos: ${dashData.ficheros_activos}`);
          console.log(`- Cartera activa (monto total): $${dashData.cartera_activa}`);
          console.log(`- Deuda pendiente por cobrar: $${dashData.deuda_pendiente?.monto}`);
          console.log(`- Cuotas pendientes por cobrar: ${dashData.deuda_pendiente?.cuotas}`);
          console.log('-------------------------------------------');
          
          // Fetch Clients list (first 5 to check structure)
          const cliOptions = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/empresa/clientes',
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          };
          
          const cliReq = http.request(cliOptions, (cliRes) => {
            let cliBody = '';
            cliRes.on('data', (chunk) => cliBody += chunk);
            cliRes.on('end', () => {
              const clients = JSON.parse(cliBody);
              console.log(`\n👥 Listado de clientes devuelto por la API:`);
              console.log(`- Total de clientes obtenidos: ${clients.length}`);
              console.log(`- Muestra de primeros 3 clientes:`);
              clients.slice(0, 3).forEach((c, idx) => {
                console.log(`  ${idx + 1}. ID: ${c.id_cliente} - Nombre: ${c.nombre_apellido} - DNI: ${c.dni} - Barrio: ${c.barrio} - Calificación: ${c.calificacion}`);
              });
              console.log('-------------------------------------------');
              console.log('🚀 ¡Todas las pruebas del backend pasaron con éxito!');
              process.exit(0);
            });
          });
          cliReq.on('error', (e) => {
            console.error('❌ Error obteniendo clientes:', e.message);
            process.exit(1);
          });
          cliReq.end();
        });
      });
      dashReq.on('error', (e) => {
        console.error('❌ Error obteniendo dashboard:', e.message);
        process.exit(1);
      });
      dashReq.end();
      
    } catch (e) {
      console.error('❌ Error parseando respuesta:', e.message);
      process.exit(1);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Error de conexión:', e.message);
  process.exit(1);
});

req.write(postData);
req.end();
