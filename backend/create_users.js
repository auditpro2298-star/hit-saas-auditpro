const { run, query } = require('./database');
const bcrypt = require('bcryptjs');

const sellers = [
    { nombre: "Lucas Giménez", email: "lucas.gimenez@electrohogar.com", tel: "+54 9 11 9901-0001", zona: "Flores" },
    { nombre: "Sofía Rodríguez", email: "sofia.rodriguez@electrohogar.com", tel: "+54 9 11 9901-0002", zona: "Caballito" },
    { nombre: "Mateo Romero", email: "mateo.romero@electrohogar.com", tel: "+54 9 11 9901-0003", zona: "Almagro" },
    { nombre: "Valentina Herrera", email: "valentina.herrera@electrohogar.com", tel: "+54 9 11 9901-0004", zona: "Palermo" },
    { nombre: "Joaquín Díaz", email: "joaquin.diaz@electrohogar.com", tel: "+54 9 11 9901-0005", zona: "Belgrano" },
    { nombre: "Camila Silva", email: "camila.silva@electrohogar.com", tel: "+54 9 11 9901-0006", zona: "Villa Urquiza" },
    { nombre: "Nicolás Castro", email: "nicolas.castro@electrohogar.com", tel: "+54 9 11 9901-0007", zona: "Saavedra" },
    { nombre: "Martina Ortiz", email: "martina.ortiz@electrohogar.com", tel: "+54 9 11 9901-0008", zona: "Devoto" },
    { nombre: "Benjamín Álvarez", email: "benjamin.alvarez@electrohogar.com", tel: "+54 9 11 9901-0009", zona: "Liniers" },
    { nombre: "Delfina Bianchi", email: "delfina.bianchi@electrohogar.com", tel: "+54 9 11 9901-0010", zona: "Mataderos" }
];

const managers = [
    { nombre: "Fernando Medina", email: "fernando.medina@electrohogar.com", tel: "+54 9 11 9902-0001", zona: "Zona Norte" },
    { nombre: "Mariana Ponce", email: "mariana.ponce@electrohogar.com", tel: "+54 9 11 9902-0002", zona: "Zona Oeste" },
    { nombre: "Gustavo Juárez", email: "gustavo.juarez@electrohogar.com", tel: "+54 9 11 9902-0003", zona: "Zona Sur" },
    { nombre: "Gabriela Soria", email: "gabriela.soria@electrohogar.com", tel: "+54 9 11 9902-0004", zona: "Zona Este" },
    { nombre: "Alejandro Torres", email: "alejandro.torres@electrohogar.com", tel: "+54 9 11 9902-0005", zona: "Capital Federal" }
];

const collectors = [
    { nombre: "Cristian Domínguez", email: "cristian.dominguez@electrohogar.com", tel: "+54 9 11 9903-0001", zona: "Zona 1 - Norte" },
    { nombre: "Natalia Cardozo", email: "natalia.cardozo@electrohogar.com", tel: "+54 9 11 9903-0002", zona: "Zona 2 - Oeste" },
    { nombre: "Rodrigo Acuña", email: "rodrigo.acuna@electrohogar.com", tel: "+54 9 11 9903-0003", zona: "Zona 3 - Sur" }
];

async function main() {
    console.log("🌱 Iniciando creación de usuarios (Vendedores, Encargados y Cobradores)...");
    
    const id_empresa = 1; // Electro Genesis por defecto

    const sellerHash = bcrypt.hashSync('vendedor123', 10);
    const managerHash = bcrypt.hashSync('admin123', 10);
    const collectorHash = bcrypt.hashSync('cobrador123', 10);

    let sellersAdded = 0;
    let managersAdded = 0;
    let collectorsAdded = 0;

    // 1. Crear Vendedores
    for (const v of sellers) {
        try {
            const res = await run(
                "INSERT OR IGNORE INTO usuarios (id_empresa, nombre, email, password_hash, rol, telefono, zona_asignada, activo) VALUES (?, ?, ?, ?, 'VENDEDOR', ?, ?, 1)",
                [id_empresa, v.nombre, v.email, sellerHash, v.tel, v.zona]
            );
            if (res.changes > 0) {
                sellersAdded++;
                console.log(`✅ Vendedor creado: ${v.nombre} (${v.email})`);
            } else {
                console.log(`⚠️ Vendedor ya existía: ${v.nombre} (${v.email})`);
            }
        } catch (e) {
            console.error(`❌ Error al crear vendedor ${v.nombre}:`, e.message);
        }
    }

    // 2. Crear Encargados
    for (const m of managers) {
        try {
            const res = await run(
                "INSERT OR IGNORE INTO usuarios (id_empresa, nombre, email, password_hash, rol, telefono, zona_asignada, activo) VALUES (?, ?, ?, ?, 'ENCARGADO_ZONA', ?, ?, 1)",
                [id_empresa, m.nombre, m.email, managerHash, m.tel, m.zona]
            );
            if (res.changes > 0) {
                managersAdded++;
                console.log(`✅ Encargado de Cobro creado: ${m.nombre} (${m.email})`);
            } else {
                console.log(`⚠️ Encargado de Cobro ya existía: ${m.nombre} (${m.email})`);
            }
        } catch (e) {
            console.error(`❌ Error al crear encargado ${m.nombre}:`, e.message);
        }
    }

    // 3. Crear Cobradores
    for (const c of collectors) {
        try {
            const res = await run(
                "INSERT OR IGNORE INTO usuarios (id_empresa, nombre, email, password_hash, rol, telefono, zona_asignada, activo) VALUES (?, ?, ?, ?, 'COBRADOR', ?, ?, 1)",
                [id_empresa, c.nombre, c.email, collectorHash, c.tel, c.zona]
            );
            if (res.changes > 0) {
                collectorsAdded++;
                console.log(`✅ Cobrador creado: ${c.nombre} (${c.email})`);
            } else {
                console.log(`⚠️ Cobrador ya existía: ${c.nombre} (${c.email})`);
            }
        } catch (e) {
            console.error(`❌ Error al crear cobrador ${c.nombre}:`, e.message);
        }
    }

    console.log(`\n🎉 Proceso finalizado.`);
    console.log(`- Vendedores creados: ${sellersAdded}/${sellers.length}`);
    console.log(`- Encargados creados: ${managersAdded}/${managers.length}`);
    console.log(`- Cobradores creados: ${collectorsAdded}/${collectors.length}`);
    
    process.exit(0);
}

main().catch(err => {
    console.error("❌ Error general:", err);
    process.exit(1);
});
