const express = require('express');
const router = express.Router();
const { query, run, get } = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Todos los endpoints requieren autenticación y rol SUPER_ADMIN
router.use(authenticateToken, requireRole(['SUPER_ADMIN']));

// GET /api/superadmin/metrics - Métricas Globales SaaS
router.get('/metrics', async (req, res) => {
    try {
        const tenantsCount = await get('SELECT COUNT(*) as total, SUM(CASE WHEN estado_suscripcion = "ACTIVA" THEN 1 ELSE 0 END) as activas, SUM(CASE WHEN estado_suscripcion = "BLOQUEADA" THEN 1 ELSE 0 END) as bloqueadas FROM empresas');
        const mrrResult = await get('SELECT SUM(monto_abono_mensual) as mrr FROM empresas WHERE estado_suscripcion = "ACTIVA"');
        const totalCobrado = await get('SELECT SUM(monto) as total_recaudado, COUNT(*) as cuotas_cobradas FROM cuotas WHERE estado = "PAGADO"');
        const usuariosCount = await get('SELECT COUNT(*) as total_usuarios FROM usuarios');

        res.json({
            tenants: {
                total: tenantsCount.total || 0,
                activas: tenantsCount.activas || 0,
                bloqueadas: tenantsCount.bloqueadas || 0
            },
            mrr: mrrResult.mrr || 0,
            operaciones: {
                total_recaudado: totalCobrado.total_recaudado || 0,
                cuotas_cobradas: totalCobrado.cuotas_cobradas || 0
            },
            usuarios_total: usuariosCount.total_usuarios || 0
        });
    } catch (err) {
        console.error('Error obteniendo métricas de Súper Admin:', err);
        res.status(500).json({ error: 'Error al calcular métricas globales.' });
    }
});

// GET /api/superadmin/tenants - Listar todos los inquilinos y sus estadísticas
router.get('/tenants', async (req, res) => {
    try {
        const tenants = await query(`
            SELECT e.*, 
                   (SELECT COUNT(*) FROM clientes c WHERE c.id_empresa = e.id_empresa) as total_clientes,
                   (SELECT COUNT(*) FROM ficheros f WHERE f.id_empresa = e.id_empresa) as total_ficheros,
                   (SELECT COUNT(*) FROM usuarios u WHERE u.id_empresa = e.id_empresa AND u.rol = 'COBRADOR') as total_cobradores
            FROM empresas e
            ORDER BY e.fecha_alta DESC
        `);
        res.json(tenants);
    } catch (err) {
        console.error('Error listando empresas:', err);
        res.status(500).json({ error: 'Error al listar empresas.' });
    }
});

// POST /api/superadmin/tenants - Alta de una nueva empresa (Tenant)
router.post('/tenants', async (req, res) => {
    const { nombre_comercial, cuit_rut, monto_abono_mensual, logo_url, admin_nombre, admin_email, admin_password } = req.body;
    if (!nombre_comercial || !cuit_rut || !admin_email || !admin_password) {
        return res.status(400).json({ error: 'Faltan datos obligatorios (nombre comercial, cuit/rut, email y password del admin).' });
    }

    try {
        // Insertar empresa
        const resultEmpresa = await run(
            'INSERT INTO empresas (nombre_comercial, cuit_rut, monto_abono_mensual, logo_url, estado_suscripcion) VALUES (?, ?, ?, ?, "ACTIVA")',
            [nombre_comercial, cuit_rut, monto_abono_mensual || 35000.00, logo_url || 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=150']
        );
        const id_empresa = resultEmpresa.lastID;

        // Hash de contraseña para el nuevo admin de empresa
        const bcrypt = require('bcryptjs');
        const passHash = await bcrypt.hash(admin_password, 10);

        await run(
            'INSERT INTO usuarios (id_empresa, nombre, email, password_hash, rol, zona_asignada) VALUES (?, ?, ?, ?, "ADMIN_EMPRESA", "Central")',
            [id_empresa, admin_nombre || 'Admin Empresa', admin_email, passHash]
        );

        res.status(201).json({
            success: true,
            id_empresa,
            message: `Empresa "${nombre_comercial}" y su usuario administrador creados con éxito.`
        });
    } catch (err) {
        console.error('Error creando empresa:', err);
        res.status(500).json({ error: 'Error al dar de alta la empresa. Verifique que el CUIT/RUT no esté duplicado.' });
    }
});

// PUT /api/superadmin/tenants/:id/status - Cambiar estado de suscripción (Suspender/Activar)
router.put('/tenants/:id/status', async (req, res) => {
    const { id } = req.params;
    const { estado_suscripcion } = req.body; // 'ACTIVA' o 'BLOQUEADA'
    if (!['ACTIVA', 'VENCIDA', 'BLOQUEADA', 'PRUEBA'].includes(estado_suscripcion)) {
        return res.status(400).json({ error: 'Estado de suscripción inválido.' });
    }

    try {
        await run('UPDATE empresas SET estado_suscripcion = ? WHERE id_empresa = ?', [estado_suscripcion, id]);
        const empresa = await get('SELECT * FROM empresas WHERE id_empresa = ?', [id]);
        res.json({
            success: true,
            message: `Suscripción de "${empresa.nombre_comercial}" cambiada a: ${estado_suscripcion}`,
            empresa
        });
    } catch (err) {
        console.error('Error actualizando estado de empresa:', err);
        res.status(500).json({ error: 'Error al cambiar estado de la empresa.' });
    }
});

module.exports = router;
