const { query } = require('../backend/database');

async function test() {
  try {
    const users = await query("SELECT id_usuario, id_empresa, nombre, email, rol, activo, zona_asignada FROM usuarios");
    console.log('Todos los usuarios:', users);
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
