const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'backend', 'hit_saas.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('--- Probando pago directo por transferencia en SQLite ---');

db.serialize(() => {
    // Buscar un fichero activo
    db.get(`SELECT id_fichero, producto_nombre, valor_cuota, id_cliente FROM ficheros WHERE estado = 'ACTIVO' LIMIT 1`, (err, f) => {
        if (err || !f) {
            console.log('No se encontro fichero activo o error:', err);
            db.close();
            return;
        }

        console.log('Fichero encontrado:', f);

        // Buscar proxima cuota pendiente
        db.get(`SELECT id_cuota, nro_cuota, monto, estado FROM cuotas WHERE id_fichero = ? AND estado != 'PAGADO' ORDER BY nro_cuota ASC LIMIT 1`, [f.id_fichero], (err, q) => {
            if (err || !q) {
                console.log('No se encontro cuota pendiente:', err);
                db.close();
                return;
            }

            console.log('Cuota a pagar:', q);

            const localDateTime = new Date().toLocaleString('sv', { timeZone: 'America/Argentina/Buenos_Aires' });
            const cobrado = q.monto;

            db.run(`
                UPDATE cuotas SET 
                    estado = 'PAGADO',
                    fecha_pago = ?,
                    medio_pago = 'TRANSFERENCIA',
                    comprobante_img_url = NULL,
                    id_cobrador = 13,
                    nombre_cobrador = 'Encargado: Santi Encargado',
                    notas = 'Prueba transferencia directa',
                    monto = ?
                WHERE id_cuota = ?
            `, [localDateTime, cobrado, q.id_cuota], function(err) {
                if (err) console.error('Error actualizando cuota:', err);
                else {
                    console.log(`Cuota ${q.id_cuota} (Nro ${q.nro_cuota}) marcada como PAGADA por TRANSFERENCIA.`);
                    
                    // Verificar cuota actualizada
                    db.get(`SELECT * FROM cuotas WHERE id_cuota = ?`, [q.id_cuota], (err, row) => {
                        console.log('Cuota verificada en DB:', row);
                        db.close();
                    });
                }
            });
        });
    });
});
