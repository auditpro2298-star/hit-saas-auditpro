const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'backend', 'hit_saas.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('--- Probando consulta de clientes enriquecida ---');
const sql = `
    SELECT 
        c.*,
        COALESCE(c.encargado_zona, (SELECT f.encargado_zona FROM ficheros f WHERE f.id_cliente = c.id_cliente AND (f.estado = 'ACTIVO' OR f.estado = 'MOROSO') AND f.encargado_zona IS NOT NULL AND TRIM(f.encargado_zona) != '' ORDER BY f.id_fichero DESC LIMIT 1), 'Sin asignar') as encargado_zona,
        (SELECT COUNT(*) FROM ficheros f WHERE f.id_cliente = c.id_cliente AND f.estado = 'ACTIVO') as ficheros_activos,
        (SELECT COUNT(*) FROM cuotas q JOIN ficheros f ON q.id_fichero = f.id_fichero WHERE f.id_cliente = c.id_cliente AND f.estado = 'ACTIVO' AND (q.estado = 'PENDIENTE' OR q.estado = 'NO_COBRADO')) as cuotas_pendientes,
        (SELECT COUNT(*) FROM cuotas q JOIN ficheros f ON q.id_fichero = f.id_fichero WHERE f.id_cliente = c.id_cliente AND f.estado = 'ACTIVO' AND q.estado = 'PAGADO') as cuotas_pagadas,
        (SELECT COALESCE(SUM(f.cantidad_cuotas), 0) FROM ficheros f WHERE f.id_cliente = c.id_cliente AND f.estado = 'ACTIVO') as cuotas_totales,
        (SELECT COALESCE(SUM(q.monto), 0) FROM cuotas q JOIN ficheros f ON q.id_fichero = f.id_fichero WHERE f.id_cliente = c.id_cliente AND f.estado = 'ACTIVO' AND (q.estado = 'PENDIENTE' OR q.estado = 'NO_COBRADO')) as monto_deuda_pendiente,
        (SELECT COUNT(*) FROM cuotas q JOIN ficheros f ON q.id_fichero = f.id_fichero WHERE f.id_cliente = c.id_cliente AND f.estado = 'ACTIVO' AND q.estado = 'PAGADO' AND strftime('%Y-%m', q.fecha_pago) = strftime('%Y-%m', 'now')) as pagado_este_mes,
        (SELECT MAX(q.fecha_pago) FROM cuotas q JOIN ficheros f ON q.id_fichero = f.id_fichero WHERE f.id_cliente = c.id_cliente AND q.estado = 'PAGADO') as fecha_ultimo_pago
    FROM clientes c
    WHERE c.id_empresa = 1
    ORDER BY c.nombre_apellido ASC
    LIMIT 10
`;

db.all(sql, [], (err, rows) => {
    if (err) {
        console.error('Error en consulta:', err);
    } else {
        console.log(`Clientes obtenidos: ${rows.length}`);
        rows.forEach(r => {
            console.log(`[ID ${r.id_cliente}] ${r.nombre_apellido} | Encargado: ${r.encargado_zona} | Activos: ${r.ficheros_activos} | Pendientes: ${r.cuotas_pendientes} | Pagadas: ${r.cuotas_pagadas} | Pagado mes: ${r.pagado_este_mes}`);
        });
    }
    db.close();
});
