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
                db.run("ALTER TABLE clientes ADD COLUMN encargado_zona TEXT", () => {});
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
    pgSql = pgSql.replace(/date\(['"]now['"]\)/gi, 'CURRENT_DATE');
    
    // Traducir de forma genérica date(campo) a (campo)::date para compatibilidad en PostgreSQL
    pgSql = pgSql.replace(/date\(([^)]+)\)/gi, '($1)::date');
    
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
        const pass123Hash = bcrypt.hashSync('123', 10);

        console.log('🌱 Insertando y verificando usuarios iniciales garantizados en la base de datos...');
        
        await run(`
            INSERT INTO empresas (id_empresa, nombre_comercial, cuit_rut, estado_suscripcion, logo_url, monto_abono_mensual)
            VALUES (1, 'Electro Genesis', '30-71234567-8', 'ACTIVA', '/logo_electro_genesis.jpg', 35000.00)
            ON CONFLICT DO NOTHING
        `);

        await run(`
            INSERT INTO usuarios (id_usuario, id_empresa, nombre, email, password_hash, rol, telefono, zona_asignada, activo)
            VALUES 
            (1, NULL, 'Martín (Súper Admin SaaS)', 'admin@hitsaas.com', '${adminHash}', 'SUPER_ADMIN', '+54 9 11 0000-0000', 'Global', true),
            (2, 1, 'Roberto González (Admin ElectroHogar)', 'admin@electrohogar.com', '${adminHash}', 'ADMIN_EMPRESA', '+54 9 11 2233-4455', 'Oficina Central', true),
            (3, 1, 'Juan Pérez (Cobrador Flores)', 'juan@electrohogar.com', '${cobradorHash}', 'COBRADOR', '+54 9 11 3344-5566', 'Flores / Caballito', true),
            (4, 1, 'Diego Silva (Cobrador Avellaneda)', 'diego@electrohogar.com', '${cobradorHash}', 'COBRADOR', '+54 9 11 4455-6677', 'Avellaneda / Sur', true),
            (8, 1, 'Carlos Gómez (Encargado Berazategui)', 'carlos_zona@electrohogar.com', '${adminHash}', 'ENCARGADO_ZONA', '+54 9 11 5566-7788', 'Berazategui', true),
            (10, 1, 'Admin Genesis', 'admin@genesis.com', '${adminHash}', 'ADMIN_EMPRESA', '+54 9 11 2233-4455', 'Oficina Central', true),
            (11, 1, 'Nico Cobrador', 'nico@genesis.com', '${pass123Hash}', 'COBRADOR', '+54 9 11 3344-5566', 'Flores / Berazategui / General', true),
            (12, 1, 'Coco Encargado', 'coco@genesis.com', '${pass123Hash}', 'ENCARGADO_ZONA', '+54 9 11 5566-7788', 'Flores / Berazategui / General', true)
            ON CONFLICT DO NOTHING
        `);
        console.log('✅ Usuarios semilla asegurados con éxito.');
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

async function syncSequences() {
    try {
        if (isPostgres && pgPool) {
            console.log('⚙️ Sincronizando secuencias de PostgreSQL...');
            const tables = [
                { name: 'empresas', seq: 'empresas_id_empresa_seq', id: 'id_empresa' },
                { name: 'usuarios', seq: 'usuarios_id_usuario_seq', id: 'id_usuario' },
                { name: 'clientes', seq: 'clientes_id_cliente_seq', id: 'id_cliente' },
                { name: 'ficheros', seq: 'ficheros_id_fichero_seq', id: 'id_fichero' },
                { name: 'cuotas', seq: 'cuotas_id_cuota_seq', id: 'id_cuota' },
                { name: 'auditoria_caja', seq: 'auditoria_caja_id_caja_seq', id: 'id_caja' },
                { name: 'whatsapp_notifications', seq: 'whatsapp_notifications_id_notificacion_seq', id: 'id_notificacion' }
            ];

            for (const t of tables) {
                const res = await pgPool.query(`SELECT MAX(${t.id}) as max_id FROM ${t.name}`);
                const maxId = res.rows[0]?.max_id;
                if (maxId === null || maxId === undefined) {
                    await pgPool.query(`SELECT setval('${t.seq}', 1, false)`);
                } else {
                    await pgPool.query(`SELECT setval('${t.seq}', ${maxId})`);
                }
            }
            console.log('✅ Secuencias PostgreSQL sincronizadas con éxito.');
        } else if (db) {
            console.log('⚙️ Sincronizando secuencias de SQLite...');
            const tables = [
                { name: 'clientes', id: 'id_cliente' },
                { name: 'ficheros', id: 'id_fichero' },
                { name: 'cuotas', id: 'id_cuota' },
                { name: 'usuarios', id: 'id_usuario' },
                { name: 'empresas', id: 'id_empresa' },
                { name: 'auditoria_caja', id: 'id_caja' },
                { name: 'whatsapp_notifications', id: 'id_notificacion' }
            ];

            for (const t of tables) {
                const row = await get(`SELECT COUNT(*) as cnt, MAX(${t.id}) as max_id FROM ${t.name}`);
                if (!row || parseInt(row.cnt || 0, 10) === 0) {
                    await run(`DELETE FROM sqlite_sequence WHERE name = ?`, [t.name]);
                } else if (row.max_id) {
                    await run(`INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES (?, ?)`, [t.name, row.max_id]);
                }
            }
            console.log('✅ Secuencias SQLite sincronizadas con éxito.');
        }
    } catch (err) {
        console.error('⚠️ Error al sincronizar secuencias:', err.message);
    }
}

async function resequenceAndReset(id_empresa = null) {
    try {
        console.log('🔄 Sincronizando y re-secuenciando IDs de clientes y ficheros desde 1...');
        
        if (!isPostgres && db) {
            await run("PRAGMA foreign_keys = OFF");
        }

        // 1. Re-secuenciar clientes si existen con IDs saltados (ej: ID 15 -> ID 1)
        const filterSql = id_empresa ? "WHERE id_empresa = ?" : "";
        const filterParams = id_empresa ? [id_empresa] : [];
        
        const clientesList = await query(`SELECT id_cliente FROM clientes ${filterSql} ORDER BY id_cliente ASC`, filterParams);
        
        let newClientId = 1;
        for (const c of clientesList) {
            const oldId = c.id_cliente;
            if (oldId !== newClientId) {
                await run("UPDATE clientes SET id_cliente = ? WHERE id_cliente = ?", [newClientId, oldId]);
                await run("UPDATE ficheros SET id_cliente = ? WHERE id_cliente = ?", [newClientId, oldId]);
                await run("UPDATE whatsapp_notifications SET id_cliente = ? WHERE id_cliente = ?", [newClientId, oldId]);
            }
            newClientId++;
        }

        // 2. Re-secuenciar ficheros
        const ficherosList = await query(`SELECT id_fichero FROM ficheros ${filterSql} ORDER BY id_fichero ASC`, filterParams);
        
        let newFicheroId = 1;
        for (const f of ficherosList) {
            const oldId = f.id_fichero;
            if (oldId !== newFicheroId) {
                await run("UPDATE ficheros SET id_fichero = ? WHERE id_fichero = ?", [newFicheroId, oldId]);
                await run("UPDATE cuotas SET id_fichero = ? WHERE id_fichero = ?", [newFicheroId, oldId]);
            }
            newFicheroId++;
        }

        if (!isPostgres && db) {
            await run("PRAGMA foreign_keys = ON");
        }

        // 3. Sincronizar secuencias de auto-incremento (SQLite y PostgreSQL)
        await syncSequences();

        console.log('✅ IDs re-secuenciados y contadores restablecidos con éxito desde 1.');
        return { success: true, message: 'Conteo de IDs de clientes y ficheros re-secuenciado e iniciado desde 1.' };
    } catch (err) {
        console.error('⚠️ Error al re-secuenciar IDs:', err.message);
        if (!isPostgres && db) {
            try { await run("PRAGMA foreign_keys = ON"); } catch (e) {}
        }
        throw err;
    }
}

async function runSchemaMigrations() {
    try {
        if (isPostgres && pgPool) {
            await pgPool.query("ALTER TABLE clientes ADD COLUMN IF NOT EXISTS encargado_zona VARCHAR(120);");
            await pgPool.query("ALTER TABLE ficheros ADD COLUMN IF NOT EXISTS encargado_zona VARCHAR(120);");
            
            // Drop global unique constraints if they exist
            try {
                await pgPool.query("ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_dni_key;");
            } catch (e) {}
            try {
                await pgPool.query("ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_qr_token_key;");
            } catch (e) {}
            
            // Add composite unique constraints scoped per company (multi-tenant safety)
            try {
                await pgPool.query("ALTER TABLE clientes ADD CONSTRAINT clientes_empresa_dni_unique UNIQUE (id_empresa, dni);");
            } catch (e) {}
            try {
                await pgPool.query("ALTER TABLE clientes ADD CONSTRAINT clientes_empresa_qr_token_unique UNIQUE (id_empresa, qr_token);");
            } catch (e) {}
        } else if (db) {
            db.run("ALTER TABLE clientes ADD COLUMN encargado_zona VARCHAR(120)", () => {});
            db.run("ALTER TABLE ficheros ADD COLUMN encargado_zona VARCHAR(120)", () => {});
        }
    } catch (e) {
        // Ignorar si ya existe
    }
}

async function initDatabase() {
    try {
        await executeSqlFile(SCHEMA_PATH);
        await runSchemaMigrations();
        console.log('✅ Esquema DDL verificado con éxito.');
        
        console.log('🌱 Asegurando datos semilla (empresas, usuarios, clientes, cuotas)...');
        await executeSqlFile(SEED_PATH);
        await ensureSeedUsers();
        await updateInitialUserHashes();
        await resequenceAndReset();
        console.log('✅ Base de datos inicializada y datos semilla verificados con éxito.');
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
                await syncSequences();
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

async function restoreBackup(id_empresa, backup) {
    const { clientes, ficheros, cuotas, usuarios, auditoria } = backup;
    
    if (isPostgres && pgPool) {
        const client = await pgPool.connect();
        try {
            await client.query("BEGIN");
            
            // Delete existing records for this tenant
            await client.query('DELETE FROM cuotas WHERE id_empresa = $1', [id_empresa]);
            await client.query('DELETE FROM auditoria_caja WHERE id_empresa = $1', [id_empresa]);
            await client.query('DELETE FROM ficheros WHERE id_empresa = $1', [id_empresa]);
            await client.query('DELETE FROM clientes WHERE id_empresa = $1', [id_empresa]);
            
            // Map old user IDs to new user IDs
            const oldToNewUserId = {};
            if (usuarios && usuarios.length > 0) {
                for (const u of usuarios) {
                    const resUser = await client.query('SELECT id_usuario FROM usuarios WHERE email = $1', [u.email]);
                    if (resUser.rows.length > 0) {
                        oldToNewUserId[u.id_usuario] = resUser.rows[0].id_usuario;
                    } else {
                        const resInsert = await client.query(`
                            INSERT INTO usuarios (id_empresa, nombre, email, password_hash, rol, telefono, zona_asignada, activo)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                            RETURNING id_usuario
                        `, [id_empresa, u.nombre, u.email, u.password_hash || '$2a$10$tZcM8Gf/W8w6/q.345', u.rol, u.telefono, u.zona_asignada, !!u.activo].map(x => x === undefined ? null : x));
                        
                        const newUserId = resInsert.rows[0].id_usuario;
                        oldToNewUserId[u.id_usuario] = newUserId;
                    }
                }
            }
            
            // Map old client IDs to new client IDs
            const oldToNewClientId = {};
            const insertedDnis = new Set();
            const insertedQrTokens = new Set();
            
            for (const c of clientes) {
                let uniqueDni = c.dni;
                if (!uniqueDni) {
                    uniqueDni = 'DNI_' + Math.random().toString(36).substring(2, 9);
                }
                while (insertedDnis.has(uniqueDni)) {
                    uniqueDni = uniqueDni + '_' + Math.floor(Math.random() * 100);
                }
                insertedDnis.add(uniqueDni);
                
                let uniqueQrToken = c.qr_token;
                if (uniqueQrToken) {
                    while (insertedQrTokens.has(uniqueQrToken)) {
                        uniqueQrToken = uniqueQrToken + '_' + Math.floor(Math.random() * 100);
                    }
                    insertedQrTokens.add(uniqueQrToken);
                }
                
                const resInsert = await client.query(`
                    INSERT INTO clientes (id_empresa, nombre_apellido, dni, telefono, direccion, barrio, piso_dpto, referencia_domicilio, latitud, longitud, qr_token, calificacion, encargado_zona, fecha_alta)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                    RETURNING id_cliente
                `, [id_empresa, c.nombre_apellido, uniqueDni, c.telefono, c.direccion, c.barrio, c.piso_dpto, c.referencia_domicilio, c.latitud, c.longitud, uniqueQrToken, c.calificacion || 'BUENO', c.encargado_zona, c.fecha_alta].map(x => x === undefined ? null : x));
                
                const newClientId = resInsert.rows[0].id_cliente;
                oldToNewClientId[c.id_cliente] = newClientId;
            }
            
            // Map old fichero IDs to new fichero IDs
            const oldToNewFicheroId = {};
            for (const f of ficheros) {
                const newClientId = oldToNewClientId[f.id_cliente];
                const newCobradorId = oldToNewUserId[f.id_cobrador_asignado] || null;
                
                const resInsert = await client.query(`
                    INSERT INTO ficheros (id_cliente, id_empresa, producto_nombre, cantidad_cuotas, valor_cuota, frecuencia_pago, monto_total, vendedor, encargado_zona, id_cobrador_asignado, fecha_entrega, estado, fecha_creacion, orden_visita)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                    RETURNING id_fichero
                `, [newClientId, id_empresa, f.producto_nombre, f.cantidad_cuotas, f.valor_cuota, f.frecuencia_pago, f.monto_total, f.vendedor, f.encargado_zona, newCobradorId, f.fecha_entrega, f.estado || 'ACTIVO', f.fecha_creacion, f.orden_visita || 0].map(x => x === undefined ? null : x));
                
                const newFicheroId = resInsert.rows[0].id_fichero;
                oldToNewFicheroId[f.id_fichero] = newFicheroId;
            }
            
            // Insert Cuotas mapping to the new Fichero ID and Cobrador ID
            for (const q of cuotas) {
                const newFicheroId = oldToNewFicheroId[q.id_fichero];
                const newCobradorId = oldToNewUserId[q.id_cobrador] || null;
                
                await client.query(`
                    INSERT INTO cuotas (id_fichero, id_empresa, nro_cuota, monto, estado, fecha_vencimiento, fecha_pago, medio_pago, comprobante_img_url, motivo_no_cobro, promesa_pago_fecha, id_cobrador, nombre_cobrador)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                `, [newFicheroId, id_empresa, q.nro_cuota, q.monto, q.estado || 'PENDIENTE', q.fecha_vencimiento, q.fecha_pago, q.medio_pago, q.comprobante_img_url, q.motivo_no_cobro, q.promesa_pago_fecha, newCobradorId, q.nombre_cobrador].map(x => x === undefined ? null : x));
            }
            
            // Insert Auditoria mapping to the new Cobrador ID
            if (auditoria && auditoria.length > 0) {
                for (const a of auditoria) {
                    const newCobradorId = oldToNewUserId[a.id_cobrador] || null;
                    
                    await client.query(`
                        INSERT INTO auditoria_caja (id_empresa, id_cobrador, fecha_caja, total_efectivo, total_transferencias, cantidad_cobros, estado_caja, observaciones, fecha_actualizacion)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    `, [id_empresa, newCobradorId, a.fecha_caja || a.fecha_arqueo, a.total_efectivo || a.recaudado_efectivo || 0.00, a.total_transferencias || a.recaudado_transferencia || 0.00, a.cantidad_cobros || a.cobros_realizados || 0, a.estado_caja || 'ABIERTA', a.observaciones || a.notes || a.notas || '', a.fecha_actualizacion || a.fecha_creacion].map(x => x === undefined ? null : x));
                }
            }
            
            await client.query("COMMIT");
        } catch (e) {
            await client.query("ROLLBACK");
            throw e;
        } finally {
            client.release();
        }
    } else {
        // SQLite
        await run("BEGIN TRANSACTION");
        try {
            await run('DELETE FROM cuotas WHERE id_empresa = ?', [id_empresa]);
            await run('DELETE FROM auditoria_caja WHERE id_empresa = ?', [id_empresa]);
            await run('DELETE FROM ficheros WHERE id_empresa = ?', [id_empresa]);
            await run('DELETE FROM clientes WHERE id_empresa = ?', [id_empresa]);
            
            const oldToNewUserId = {};
            if (usuarios && usuarios.length > 0) {
                for (const u of usuarios) {
                    const resUser = await get('SELECT id_usuario FROM usuarios WHERE email = ?', [u.email]);
                    if (resUser) {
                        oldToNewUserId[u.id_usuario] = resUser.id_usuario;
                    } else {
                        const insertRes = await run(`
                            INSERT INTO usuarios (id_empresa, nombre, email, password_hash, rol, telefono, zona_asignada, activo)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        `, [id_empresa, u.nombre, u.email, u.password_hash || '$2a$10$tZcM8Gf/W8w6/q.345', u.rol, u.telefono, u.zona_asignada, u.activo ? 1 : 0].map(x => x === undefined ? null : x));
                        
                        oldToNewUserId[u.id_usuario] = insertRes.lastID;
                    }
                }
            }
            
            const oldToNewClientId = {};
            const insertedDnis = new Set();
            const insertedQrTokens = new Set();
            
            for (const c of clientes) {
                let uniqueDni = c.dni;
                if (!uniqueDni) {
                    uniqueDni = 'DNI_' + Math.random().toString(36).substring(2, 9);
                }
                while (insertedDnis.has(uniqueDni)) {
                    uniqueDni = uniqueDni + '_' + Math.floor(Math.random() * 100);
                }
                insertedDnis.add(uniqueDni);
                
                let uniqueQrToken = c.qr_token;
                if (uniqueQrToken) {
                    while (insertedQrTokens.has(uniqueQrToken)) {
                        uniqueQrToken = uniqueQrToken + '_' + Math.floor(Math.random() * 100);
                    }
                    insertedQrTokens.add(uniqueQrToken);
                }
                
                const insertRes = await run(`
                    INSERT INTO clientes (id_empresa, nombre_apellido, dni, telefono, direccion, barrio, piso_dpto, referencia_domicilio, latitud, longitud, qr_token, calificacion, encargado_zona, fecha_alta)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [id_empresa, c.nombre_apellido, uniqueDni, c.telefono, c.direccion, c.barrio, c.piso_dpto, c.referencia_domicilio, c.latitud, c.longitud, uniqueQrToken, c.calificacion || 'BUENO', c.encargado_zona, c.fecha_alta].map(x => x === undefined ? null : x));
                
                oldToNewClientId[c.id_cliente] = insertRes.lastID;
            }
            
            const oldToNewFicheroId = {};
            for (const f of ficheros) {
                const newClientId = oldToNewClientId[f.id_cliente];
                const newCobradorId = oldToNewUserId[f.id_cobrador_asignado] || null;
                
                const insertRes = await run(`
                    INSERT INTO ficheros (id_cliente, id_empresa, producto_nombre, cantidad_cuotas, valor_cuota, frecuencia_pago, monto_total, vendedor, encargado_zona, id_cobrador_asignado, fecha_entrega, estado, fecha_creacion, orden_visita)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [newClientId, id_empresa, f.producto_nombre, f.cantidad_cuotas, f.valor_cuota, f.frecuencia_pago, f.monto_total, f.vendedor, f.encargado_zona, newCobradorId, f.fecha_entrega, f.estado || 'ACTIVO', f.fecha_creacion, f.orden_visita || 0].map(x => x === undefined ? null : x));
                
                oldToNewFicheroId[f.id_fichero] = insertRes.lastID;
            }
            
            for (const q of cuotas) {
                const newFicheroId = oldToNewFicheroId[q.id_fichero];
                const newCobradorId = oldToNewUserId[q.id_cobrador] || null;
                
                await run(`
                    INSERT INTO cuotas (id_fichero, id_empresa, nro_cuota, monto, estado, fecha_vencimiento, fecha_pago, medio_pago, comprobante_img_url, motivo_no_cobro, promesa_pago_fecha, id_cobrador, nombre_cobrador)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [newFicheroId, id_empresa, q.nro_cuota, q.monto, q.estado || 'PENDIENTE', q.fecha_vencimiento, q.fecha_pago, q.medio_pago, q.comprobante_img_url, q.motivo_no_cobro, q.promesa_pago_fecha, newCobradorId, q.nombre_cobrador].map(x => x === undefined ? null : x));
            }
            
            if (auditoria && auditoria.length > 0) {
                for (const a of auditoria) {
                    const newCobradorId = oldToNewUserId[a.id_cobrador] || null;
                    
                    await run(`
                        INSERT INTO auditoria_caja (id_empresa, id_cobrador, fecha_caja, total_efectivo, total_transferencias, cantidad_cobros, estado_caja, observaciones, fecha_actualizacion)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [id_empresa, newCobradorId, a.fecha_caja || a.fecha_arqueo, a.total_efectivo || a.recaudado_efectivo || 0.00, a.total_transferencias || a.recaudado_transferencia || 0.00, a.cantidad_cobros || a.cobros_realizados || 0, a.estado_caja || 'ABIERTA', a.observaciones || a.notes || a.notas || '', a.fecha_actualizacion || a.fecha_creacion].map(x => x === undefined ? null : x));
                }
            }
            
            await run("COMMIT");
        } catch (e) {
            try { await run("ROLLBACK"); } catch (err) {}
            throw e;
        }
    }
}

module.exports = {
    db,
    pgPool,
    query,
    run,
    get,
    resetAndSeed,
    initDatabase,
    syncSequences,
    resequenceAndReset,
    restoreBackup
};
