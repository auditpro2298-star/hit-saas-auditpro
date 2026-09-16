const { run, query } = require('../backend/database');

async function main() {
    try {
        await run("ALTER TABLE empresas ADD COLUMN rubro VARCHAR(100) DEFAULT 'Gestión de Casa de Cuotas'");
        console.log('✅ Columna rubro agregada a empresas.');
    } catch (err) {
        console.log('ℹ️ Columna rubro ya existe o error:', err.message);
    }
    const emps = await query('SELECT id_empresa, nombre_comercial, rubro FROM empresas');
    console.log('Empresas:', emps);
    process.exit(0);
}

main();
