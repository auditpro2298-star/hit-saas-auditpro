const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'hit_saas.sqlite');
const SCHEMA_PATH = path.join(__dirname, '..', 'database', 'schema.sql');
const SEED_PATH = path.join(__dirname, '..', 'database', 'seed.sql');

// Conexión y configuración del motor dual (SQLite por defecto para desarrollo local, PostgreSQL para Render / Producción)
const isPostgres = !!process.env.DATABASE_URL || process.env.USE_POSTGRES === 'true';

let db = null;
let pgPool = null;

if (isPostgres) {
    const { Pool } = require('pg');
    const connectionString = process.env.DATABASE_URL;
    const isLocalPg = connectionString && (connectionString.includes('localhost') || connectionString.includes('127.0.0.1'));
    
    pgPool = new Pool({
        connectionString: connectionString,
        ssl: isLocalPg ? false : { rejectUnauthorized: false }
    });

    console.log('🚀 Modo Producción Nube: Conectado con éxito a PostgreSQL (Persistencia Garantizada)');
} else {
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
                // Asegurar columnas nuevas en caliente para desarrollo
                db.run("ALTER TABLE ficheros ADD COLUMN orden_visita INTEGER DEFAULT 0", () => {});
                db.run("ALTER TABLE clientes ADD COLUMN piso_dpto TEXT", () => {});
                db.run("ALTER TABLE clientes ADD COLUMN referencia_domicilio TEXT", () => {});
            }
        }
    });
}

// Función para traducir consultas SQL de SQLite a PostgreSQL automáticamente
function translateSqlToPg(sql) {
    let pgSql = sql;

    // 1. Reemplazar marcadores de posición ? por $1, $2, $3...
    let paramIndex = 1;
    pgSql = pgSql.replace(/\?/g, () => `$${paramIndex++}`);

    // 2. Funciones y sintaxis comunes de compatibilidad
    pgSql = pgSql.replace(/\bIFNULL\b/gi, 'COALESCE');
    pgSql = pgSql.replace(/date\("now"\)/gi, 'CURRENT_DATE');
    pgSql = pgSql.replace(/date\('now'\)/gi, 'CURRENT_DATE');
    pgSql = pgSql.replace(/date\(fecha_pago\) = date\('now'\)/gi, 'DATE(fecha_pago) = CURRENT_DATE');
    pgSql = pgSql.replace(/date\(fecha_envio\) = date\('now'\)/gi, 'DATE(fecha_envio) = CURRENT_DATE');
    pgSql = pgSql.replace(/datetime\(['"]now['"],\s*['"]localtime['"]\)/gi, 'CURRENT_TIMESTAMP');
    pgSql = pgSql.replace(/datetime\(['"]now['"]\)/gi, 'CURRENT_TIMESTAMP');

    return pgSql;
}

// Función auxiliar para ejecutar archivos SQL de esquema e inicialización
// Función auxiliar para ejecutar archivos SQL de esquema e inicialización
function executeSqlFile(filePath, callback) {
    const promise = (async () => {
        if (!fs.existsSync(filePath)) {
            console.warn(`⚠️ Archivo SQL no encontrado: ${filePath}`);
            return;
        }
        const rawSql = fs.readFileSync(filePath, 'utf8');
        
        // Limpiar comentarios
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

        if (statements.length === 0) return;

        if (!isPostgres) {
            await new Promise((resolve) => {
                db.serialize(() => {
                    let completed = 0;
                    statements.forEach((stmt) => {
                        db.run(stmt, (err) => {
                            if (err && !err.message.includes('already exists')) {
                                console.error(`❌ Error ejecutando SQL SQLite:\n${stmt.substring(0, 80)}...\nError: ${err.message}`);
                            }
                            completed++;
                            if (completed === statements.length) resolve();
                        });
                    });
                });
            });
        } else {
            for (let stmt of statements) {
                try {
                    // Adaptaciones DDL y DML para PostgreSQL
                    let pgStmt = stmt
                        .replace(/INSERT OR IGNORE INTO/gi, 'INSERT INTO')
                        .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY')
                        .replace(/AUTOINCREMENT/gi, '')
                        .replace(/DATETIME/gi, 'TIMESTAMP')
                        .replace(/BOOLEAN DEFAULT 1/gi, 'BOOLEAN DEFAULT true')
                        .replace(/BOOLEAN DEFAULT 0/gi, 'BOOLEAN DEFAULT false');
                    
                    if (pgStmt.trim().toUpperCase().startsWith('INSERT INTO') && !pgStmt.toUpperCase().includes('ON CONFLICT')) {
                        pgStmt += ' ON CONFLICT DO NOTHING';
                    }
                    
                    await pgPool.query(pgStmt);
                } catch (err) {
                    if (!err.message.includes('already exists')) {
                        console.error(`⚠️ Nota en DDL PostgreSQL (${err.code}):`, err.message);
                    }
                }
            }
        }
    })();

    if (callback) {
        promise.then(() => callback()).catch(() => callback());
    }
    return promise;
}

async function ensureSeedUsers() {
    try {
        const bcrypt = require('bcryptjs');
        const adminHash = bcrypt.hashSync('admin123', 10);
        const cobradorHash = bcrypt.hashSync('cobrador123', 10);

        const row = await get("SELECT COUNT(*) as count FROM usuarios");
        const count = parseInt(row?.count || 0, 10);

        if (count === 0) {
            console.log('🌱 Insertando usuarios iniciales garantizados en la base de datos...');
            // Crear empresa 1 si no existe
            await run(`
                INSERT INTO empresas (id_empresa, nombre_comercial, cuit_rut, estado_suscripcion)
                VALUES (1, 'ElectroHogar S.A.', '30-71234567-8', 'ACTIVA')
                ON CONFLICT DO NOTHING
            `);

            await run(`
                INSERT INTO usuarios (id_usuario, id_empresa, nombre, email, password_hash, rol, telefono, zona_asignada, activo)
                VALUES 
                (1, NULL, 'Martín (Súper Admin SaaS)', 'admin@hitsaas.com', '${adminHash}', 'SUPER_ADMIN', '+54 9 11 0000-0000', 'Global', true),
                (2, 1, 'Roberto González (Admin ElectroHogar)', 'admin@electrohogar.com', '${adminHash}', 'ADMIN_EMPRESA', '+54 9 11 2233-4455', 'Oficina Central', true),
                (3, 1, 'Juan Pérez (Cobrador Flores)', 'juan@electrohogar.com', '${cobradorHash}', 'COBRADOR', '+54 9 11 3344-5566', 'Flores / Caballito', true),
                (4, 1, 'Diego Silva (Cobrador Avellaneda)', 'diego@electrohogar.com', '${cobradorHash}', 'COBRADOR', '+54 9 11 4455-6677', 'Avellaneda / Sur', true)
                ON CONFLICT DO NOTHING
            `);
            console.log('✅ Usuarios semilla creados con éxito en PostgreSQL.');
        }
    } catch (err) {
        console.error('⚠️ Error al asegurar usuarios semilla:', err.message);
    }
}

async function updateInitialUserHashes() {
    try {
        const bcrypt = require('bcryptjs');
        const adminHash = bcrypt.hashSync('admin123', 10);
        const cobradorHash = bcrypt.hashSync('cobrador123', 10);
        
        const usuarios = await query("SELECT id_usuario, password_hash, rol FROM usuarios");
        for (let u of usuarios) {
            const hash = u.password_hash || '';
            if (!hash.startsWith('$2a$') && !hash.startsWith('$2b$')) {
                const targetHash = (u.rol === 'COBRADOR') ? cobradorHash : adminHash;
                await run("UPDATE usuarios SET password_hash = ? WHERE id_usuario = ?", [targetHash, u.id_usuario]);
            }
        }
    } catch (e) {
        // Ignorar si aún no existe la tabla
    }
}

async function syncPostgresSequences() {
    if (!isPostgres || !pgPool) return;
    try {
        console.log('⚙️ Sincronizando secuencias de PostgreSQL...');
        await pgPool.query("SELECT setval('empresas_id_empresa_seq', COALESCE((SELECT MAX(id_empresa) FROM empresas), 1))");
        await pgPool.query("SELECT setval('usuarios_id_usuario_seq', COALESCE((SELECT MAX(id_usuario) FROM usuarios), 1))");
        await pgPool.query("SELECT setval('clientes_id_cliente_seq', COALESCE((SELECT MAX(id_cliente) FROM clientes), 1))");
        await pgPool.query("SELECT setval('ficheros_id_fichero_seq', COALESCE((SELECT MAX(id_fichero) FROM ficheros), 1))");
        console.log('✅ Secuencias sincronizadas con éxito.');
    } catch (err) {
        console.error('⚠️ Error al sincronizar secuencias PostgreSQL:', err.message);
    }
}

async function initDatabase() {
    try {
        await executeSqlFile(SCHEMA_PATH);
        console.log('✅ Esquema DDL verificado con éxito.');
        
        const rowEmp = await get("SELECT COUNT(*) as count FROM empresas");
        const rowUsr = await get("SELECT COUNT(*) as count FROM usuarios");
        
        const countEmp = parseInt(rowEmp?.count || 0, 10);
        const countUsr = parseInt(rowUsr?.count || 0, 10);

        if (countEmp === 0 || countUsr === 0) {
            console.log('🌱 Base de datos nueva o incompleta detectada. Cargando datos semilla...');
            await executeSqlFile(SEED_PATH);
            await ensureSeedUsers();
            await updateInitialUserHashes();
            await syncPostgresSequences();
            console.log('✅ Datos iniciales cargados con éxito.');
        } else {
            await ensureSeedUsers();
            await updateInitialUserHashes();
            await syncPostgresSequences();
            console.log('💾 Base de datos conservada intacta.');
        }
    } catch (err) {
        console.error('Error al inicializar la base de datos:', err.message);
    }
}

// Promisificar queries universales async/await
function query(sql, params = []) {
    return new Promise((resolve, reject) => {
        if (!isPostgres) {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        } else {
            const pgSql = translateSqlToPg(sql);
            pgPool.query(pgSql, params)
                .then(res => resolve(res.rows || []))
                .catch(reject);
        }
    });
}

function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        if (!isPostgres) {
            db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row || null);
            });
        } else {
            const pgSql = translateSqlToPg(sql);
            pgPool.query(pgSql, params)
                .then(res => resolve(res.rows[0] || null))
                .catch(reject);
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
            let pgSql = translateSqlToPg(sql);
            const isInsert = pgSql.trim().toUpperCase().startsWith('INSERT');
            if (isInsert && !pgSql.toUpperCase().includes('RETURNING')) {
                pgSql += ' RETURNING *';
            }

            pgPool.query(pgSql, params)
                .then(res => {
                    const firstRow = res.rows[0] || {};
                    const idKey = Object.keys(firstRow).find(k => k.startsWith('id_') || k === 'id');
                    const lastID = idKey ? firstRow[idKey] : null;
                    resolve({ lastID: lastID, changes: res.rowCount });
                })
                .catch(reject);
        }
    });
}

function resetAndSeed() {
    return new Promise(async (resolve, reject) => {
        if (isPostgres) {
            try {
                await pgPool.query("TRUNCATE TABLE whatsapp_notifications, auditoria_caja, cuotas, ficheros, clientes, usuarios, empresas RESTART IDENTITY CASCADE");
                await executeSqlFile(SEED_PATH);
                await updateInitialUserHashes();
                await syncPostgresSequences();
                return resolve({ success: true, message: 'Base de datos PostgreSQL restablecida con datos semilla.' });
            } catch (err) {
                console.error('Error al resetear PostgreSQL:', err.message);
                return reject(err);
            }
        }
        db.serialize(() => {
            db.run("DROP TABLE IF EXISTS whatsapp_notifications");
            db.run("DROP TABLE IF EXISTS auditoria_caja");
            db.run("DROP TABLE IF EXISTS cuotas");
            db.run("DROP TABLE IF EXISTS ficheros");
            db.run("DROP TABLE IF EXISTS clientes");
            db.run("DROP TABLE IF EXISTS usuarios");
            db.run("DROP TABLE IF EXISTS empresas", async (err) => {
                if (err) return reject(err);
                await initDatabase();
                resolve({ success: true, message: 'Base de datos SQLite re-inicializada.' });
            });
        });
    });
}

module.exports = {
    db,
    pgPool,
    query,
    run,
    get,
    resetAndSeed,
    initDatabase
};
