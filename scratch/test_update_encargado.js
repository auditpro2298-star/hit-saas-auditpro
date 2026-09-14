const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'backend', 'hit_saas.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('--- Probando actualización de encargado en cliente y ficheros ---');

db.serialize(() => {
    const id_cliente = 6;
    const nuevoEncargado = 'Coco';
    const id_empresa = 1;

    db.run(
        `UPDATE clientes SET encargado_zona = ? WHERE id_cliente = ? AND id_empresa = ?`,
        [nuevoEncargado, id_cliente, id_empresa],
        function(err) {
            if (err) console.error('Error actualizando cliente:', err);
            else console.log(`Cliente ${id_cliente} actualizado. Cambios: ${this.changes}`);
        }
    );

    db.run(
        `UPDATE ficheros SET encargado_zona = ? WHERE id_cliente = ? AND id_empresa = ? AND (estado = 'ACTIVO' OR estado = 'MOROSO')`,
        [nuevoEncargado, id_cliente, id_empresa],
        function(err) {
            if (err) console.error('Error actualizando ficheros:', err);
            else console.log(`Ficheros del cliente ${id_cliente} actualizados. Cambios: ${this.changes}`);
        }
    );

    db.get(`SELECT id_cliente, nombre_apellido, encargado_zona FROM clientes WHERE id_cliente = ?`, [id_cliente], (err, row) => {
        console.log('Cliente verificado:', row);
        db.close();
    });
});
