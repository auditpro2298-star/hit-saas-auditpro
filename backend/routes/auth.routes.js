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

module.exports = router;
