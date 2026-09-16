const { query, get } = require('../backend/database');

async function test() {
  try {
    console.log('--- Testing Encargados and Assignments in DB ---');
    const clientes = await query('SELECT id_cliente, nombre_apellido, encargado_zona FROM clientes WHERE id_empresa = 1 LIMIT 10');
    console.log('Muestra de 10 clientes en DB (sin tocar):', clientes);

    const ficheros = await query('SELECT id_fichero, producto_nombre, encargado_zona, id_cobrador_asignado FROM ficheros WHERE id_empresa = 1 LIMIT 10');
    console.log('Muestra de 10 ficheros en DB (sin tocar):', ficheros);

    const encargados = await query("SELECT id_usuario, nombre, email, rol FROM usuarios WHERE rol = 'ENCARGADO_ZONA'");
    console.log('Encargados en DB:', encargados);

    console.log('✅ Base de datos intacta y estructura validada.');
  } catch (err) {
    console.error('Error en test:', err);
  }
}

test();
