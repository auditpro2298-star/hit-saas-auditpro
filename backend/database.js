const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'hit_saas.sqlite');
const SCHEMA_PATH = path.join(__dirname, '..', 'database', 'schema.sql');
const SEED_PATH = path.join(__dirname, '..', 'database', 'seed.sql');

// Conexión y configuración del motor dual (SQLite por defecto para desarrollo, o PostgreSQL si DATABASE_URL está definida)
const isPostgres = !!process.env.DATABASE_URL;

let db;

if (!isPostgres) {
    const isNew = !fs.existsSync(DB_PATH);
    db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
            console.error('❌ Error al conectar con SQLite:', err.message);
        } else {
            console.log('✅ Conectado a la base de datos local SQLite (hit_saas.sqlite)');
            if (isNew) {
                console.log('⚙️ Inicializando esquema y datos semilla por primera vez...');
                initDatabase();
            } else {
                // Asegurar columna orden_visita en caliente para desarrollo
                db.run("ALTER TABLE ficheros ADD COLUMN orden_visita INTEGER DEFAULT 0", (err) => {
                    if (err && !err.message.includes('duplicate column') && !err.message.includes('already exists')) {
                        console.log('ℹ️ Columna orden_visita ya presente o no pudo crearse:', err.message);
                    }
                });
            }
        }
    });
} else {
    // Configuración para producción con `pg` (PostgreSQL) cuando se despliegue en GitHub / Nube
    console.log('🚀 Modo Producción: Listo para conectar con PostgreSQL via DATABASE_URL');
}

// Función auxiliar para ejecutar múltiples sentencias SQL desde un archivo (SQLite)
function executeSqlFile(filePath, callback) {
    if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ Archivo SQL no encontrado: ${filePath}`);
        if (callback) callback();
        return;
    }
    const rawSql = fs.readFileSync(filePath, 'utf8');
    
    // Limpiar comentarios línea por línea (tanto -- como bloques)
    const lines = rawSql.split('\n').map(line => {
        const commentIdx = line.indexOf('--');
        if (commentIdx >= 0) return line.substring(0, commentIdx).trim();
        return line;
    });
    
    const cleanSql = lines.join('\n');
    const statements = cleanSql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

    if (statements.length === 0) {
        if (callback) callback();
        return;
    }

    db.serialize(() => {
        let completed = 0;
        statements.forEach((stmt, index) => {
            db.run(stmt, (err) => {
                if (err && !err.message.includes('already exists')) {
                    console.error(`❌ Error ejecutando SQL en ${path.basename(filePath)}:\nSentencia: ${stmt.substring(0, 100)}...\nError: ${err.message}`);
                }
                completed++;
                if (completed === statements.length && callback) {
                    callback();
                }
            });
        });
    });
}

function initDatabase() {
    executeSqlFile(SCHEMA_PATH, () => {
        console.log('✅ Esquema DDL creado con éxito.');
        executeSqlFile(SEED_PATH, () => {
            console.log('✅ Datos iniciales (Seed Data) cargados con éxito.');
        });
    });
}

// Promisificar queries para un uso moderno async/await en los controladores
function query(sql, params = []) {
    return new Promise((resolve, reject) => {
        if (!isPostgres) {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        } else {
            // Aquí iría `pgPool.query(sql, params)`
            reject(new Error('PostgreSQL driver not initialized in dev mode'));
        }
    });
}

function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        if (!isPostgres) {
            db.run(sql, params, function (err) {
                if (err) reject(err);
                else resolve({ lastID: this.lastID, changes: this.changes });
            });
        } else {
            reject(new Error('PostgreSQL driver not initialized in dev mode'));
        }
    });
}

function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        if (!isPostgres) {
            db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        } else {
            reject(new Error('PostgreSQL driver not initialized in dev mode'));
        }
    });
}

// Permitir reiniciar/reseeder la base de datos vía API local para demos
function resetAndSeed() {
    return new Promise((resolve) => {
        initDatabase();
        resolve({ success: true, message: 'Base de datos re-inicializada con datos de demostración.' });
    });
}

module.exports = {
    db,
    query,
    run,
    get,
    resetAndSeed,
    initDatabase
};
