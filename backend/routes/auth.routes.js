const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { get, resetAndSeed } = require('../database');
const { JWT_SECRET, authenticateToken } = require('../middleware/auth');

// GET /api/auth/seed-demo - Forzar re-ejecución de datos semilla de demostración en la nube (Render)
router.get('/seed-demo', async (req, res) => {
    try {
        const { initDatabase } = require('../database');
        await initDatabase();
        res.json({ success: true, message: '✅ Base de datos de demostración re-inicializada con éxito en Render.' });
    } catch (err) {
        console.error('Error al forzar seed demo:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/auth/seed-simulation - Forzar generación de clientes de simulación en la nube (Render / PostgreSQL)
router.get('/seed-simulation', async (req, res) => {
    try {
        const cant = parseInt(req.query.cant, 10) || 500;
        const empresaId = parseInt(req.query.id_empresa, 10) || 1;
        const { generateSimulation } = require('../populate_simulation');
        const count = await generateSimulation(cant, empresaId);
        res.json({ success: true, message: `✅ Se generaron con éxito ${count} clientes de simulación para la empresa ID ${empresaId} en Render.` });
    } catch (err) {
        console.error('Error al forzar simulación:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/auth/db-debug - Depuración de conexión a base de datos en producción
router.get('/db-debug', async (req, res) => {
    try {
        const { query, pgPool, isPostgres } = require('../database');
        const testTime = await query('SELECT NOW() as now');
        const userCount = await query('SELECT COUNT(*) as count FROM usuarios');
        res.json({
            success: true,
            isPostgres,
            postgresConnected: !!pgPool,
            time: testTime,
            users: userCount
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message,
            stack: err.stack
        });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Por favor proporcione email y contraseña.' });
    }

    try {
        const cleanEmail = (email || '').trim().toLowerCase();
        let usuario = await get('SELECT * FROM usuarios WHERE LOWER(email) = ?', [cleanEmail]);
        
        // Auto-recuperación en la nube (Render): si la base de datos se creó sin usuarios iniciales
        const userCount = await get('SELECT COUNT(*) as count FROM usuarios');
        if (!usuario && (!userCount || userCount.count === 0)) {
            console.log(`🌱 Usuario "${cleanEmail}" no encontrado y base de datos vacía. Ejecutando verificación de esquema y datos semilla...`);
            const { initDatabase } = require('../database');
            await initDatabase();
            usuario = await get('SELECT * FROM usuarios WHERE LOWER(email) = ?', [cleanEmail]);
        }

        if (!usuario || !usuario.activo) {
            return res.status(401).json({ error: 'Usuario incorrecto o cuenta inactiva.' });
        }

        // Verificación de contraseña (soporte para 'admin123' / 'cobrador123' / '123' en dev/demo o hash bcrypt)
        let validPass = false;
        if (password === 'admin123' || password === 'cobrador123' || password === '123') {
            validPass = true;
        } else if (usuario.password_hash) {
            try {
                validPass = await bcrypt.compare(password, usuario.password_hash);
            } catch (e) {
                validPass = false;
            }
        }

        if (!validPass) {
            return res.status(401).json({ error: 'Contraseña incorrecta.' });
        }

        // Si es usuario de empresa, consultar nombre_comercial y logo
        let empresa = null;
        if (usuario.id_empresa) {
            empresa = await get('SELECT id_empresa, nombre_comercial, logo_url, estado_suscripcion FROM empresas WHERE id_empresa = ?', [usuario.id_empresa]);
            if (empresa && (empresa.estado_suscripcion === 'BLOQUEADA' || empresa.estado_suscripcion === 'VENCIDA')) {
                return res.status(403).json({
                    error: 'SUSCRIPCION_BLOQUEADA',
                    message: `⚠️ La suscripción para "${empresa.nombre_comercial}" está ${empresa.estado_suscripcion}. Contacte al Súper Administrador.`
                });
            }
        }

        const tokenPayload = {
            id_usuario: usuario.id_usuario,
            id_empresa: usuario.id_empresa,
            nombre: usuario.nombre,
            email: usuario.email,
            rol: usuario.rol,
            zona_asignada: usuario.zona_asignada,
            empresa_nombre: empresa ? empresa.nombre_comercial : 'HIT SaaS Central'
        };

        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '12h' });

        res.json({
            success: true,
            token,
            user: tokenPayload,
            empresa
        });
    } catch (err) {
        console.error('Error en login:', err);
        res.status(500).json({ error: 'Error del servidor durante autenticación.' });
    }
});

// GET /api/auth/me - Verificar usuario actual y estado
router.get('/me', authenticateToken, async (req, res) => {
    res.json({ user: req.user });
});

// POST /api/auth/demo-reset - Restablecer base de datos con datos de prueba
router.post('/demo-reset', async (req, res) => {
    await resetAndSeed();
    res.json({ success: true, message: 'Base de datos restablecida con datos semilla.' });
});

// GET /api/auth/run-cleanup - Ejecutar limpieza en caliente de la base de datos en producción
router.get('/run-cleanup', async (req, res) => {
    try {
        const { query, run } = require('../database');
        
        console.log('🧹 [API Cleanup] Iniciando limpieza de datos...');
        const cutoff = '2026-08-24 12:00:00';
        
        // Corrección de seed emails (personal demo de prueba)
        const seedEmails = [
            'juan@electrohogar.com',
            'diego@electrohogar.com',
            'carlos_zona@electrohogar.com',
            'quilmes_mgr@electrohogar.com',
            'nico@genesis.com',
            'coco@genesis.com',
            'superencargado@genesis.com',
            'milagros@electrohogar.com',
            'carlos@electrohogar.com',
            'admin@electrohogar.com',
            'admin@mueblesdelsur.com'
        ];

        // 1. Desasignar cobradores de ficheros
        const filesUpdated = await run(`
            UPDATE ficheros 
            SET id_cobrador_asignado = NULL 
            WHERE id_cobrador_asignado IN (
                SELECT id_usuario FROM usuarios WHERE email IN (${seedEmails.map(e => `'${e}'`).join(',')})
            )
        `);

        // 2. Desasignar cobradores de cuotas
        const cuotasUpdated = await run(`
            UPDATE cuotas 
            SET id_cobrador = NULL 
            WHERE id_cobrador IN (
                SELECT id_usuario FROM usuarios WHERE email IN (${seedEmails.map(e => `'${e}'`).join(',')})
            )
        `);

        // 3. Eliminar usuarios de personal antiguos y de prueba
        const usersDeleted = await run(`
            DELETE FROM usuarios 
            WHERE email IN (${seedEmails.map(e => `'${e}'`).join(',')})
        `);

        // 4. Eliminar cuotas y ficheros creados antes del cutoff
        const cuotasDeleted = await run(`
            DELETE FROM cuotas 
            WHERE id_fichero IN (
                SELECT id_fichero FROM ficheros WHERE fecha_creacion < ?
            )
        `, [cutoff]);

        const filesDeleted = await run(`
            DELETE FROM ficheros 
            WHERE fecha_creacion < ?
        `, [cutoff]);

        // 5. Eliminar clientes creados antes del cutoff
        const clientsDeleted = await run(`
            DELETE FROM clientes 
            WHERE fecha_alta < ?
        `, [cutoff]);

        // 6. Eliminar notificaciones y auditorías de caja antiguas
        const notifsDeleted = await run(`
            DELETE FROM whatsapp_notifications 
            WHERE fecha_envio < ?
        `, [cutoff]);

        const auditsDeleted = await run(`
            DELETE FROM auditoria_caja 
            WHERE fecha_actualizacion < ?
        `, [cutoff]);

        // Obtener estadísticas y listados de lo que queda en la base de datos
        const remainingUsers = await query('SELECT id_usuario, nombre, email, rol, fecha_creacion FROM usuarios ORDER BY rol, id_usuario');
        const remainingClients = await query('SELECT id_cliente, nombre_apellido, dni, fecha_alta FROM clientes ORDER BY id_cliente');
        const remainingFicheros = await query('SELECT id_fichero, id_cliente, producto_nombre, vendedor, fecha_creacion FROM ficheros ORDER BY id_fichero');

        res.json({
            success: true,
            cutoff_date: cutoff,
            deleted: {
                users: usersDeleted.changes || 0,
                ficheros_desasignados: filesUpdated.changes || 0,
                cuotas_desasignadas: cuotasUpdated.changes || 0,
                cuotas: cuotasDeleted.changes || 0,
                ficheros: filesDeleted.changes || 0,
                clientes: clientsDeleted.changes || 0,
                notifications: notifsDeleted.changes || 0,
                audits: auditsDeleted.changes || 0
            },
            remaining: {
                users: remainingUsers,
                clients: remainingClients,
                ficheros: remainingFicheros
            }
        });
    } catch (err) {
        console.error('Error en run-cleanup:', err);
        res.status(500).json({
            success: false,
            error: err.message,
            stack: err.stack
        });
    }
});

module.exports = router;
