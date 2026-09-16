const { query } = require('../backend/database');

async function test() {
  const tables = await query("SELECT name FROM sqlite_master WHERE type='table'");
  console.log('Tablas en SQLite:', tables.map(t => t.name));
}

test();
