const express = require('express');
const router = express.Router();
const { query, run, get } = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Todos los endpoints requieren autenticación y rol SUPER_ADMIN
router.use(authenticateToken, requireRole(['SUPER_ADMIN']));

// GET /api/superadmin/metrics - Métricas Globales SaaS
router.get('/metrics', async (req, res) => {
    try {
        const tenantsCount = await get("SELECT COUNT(*) as total, SUM(CASE WHEN estado_suscripcion = 'ACTIVA' THEN 1 ELSE 0 END) as activas, SUM(CASE WHEN estado_suscripcion = 'BLOQUEADA' THEN 1 ELSE 0 END) as bloqueadas FROM empresas");
        const mrrResult = await get("SELECT SUM(monto_abono_mensual) as mrr FROM empresas WHERE estado_suscripcion = 'ACTIVA'");
        const totalCobrado = await get("SELECT SUM(monto) as total_recaudado, COUNT(*) as cuotas_cobradas FROM cuotas WHERE estado = 'PAGADO'");
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
            "INSERT INTO empresas (nombre_comercial, cuit_rut, monto_abono_mensual, logo_url, estado_suscripcion) VALUES (?, ?, ?, ?, 'ACTIVA')",
            [nombre_comercial, cuit_rut, monto_abono_mensual || 35000.00, logo_url || 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=150']
        );
        const id_empresa = resultEmpresa.lastID;

        // Hash de contraseña para el nuevo admin de empresa
        const bcrypt = require('bcryptjs');
        const passHash = await bcrypt.hash(admin_password, 10);

        await run(
            "INSERT INTO usuarios (id_empresa, nombre, email, password_hash, rol, zona_asignada) VALUES (?, ?, ?, ?, 'ADMIN_EMPRESA', 'Central')",
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

// DELETE /api/superadmin/tenants/:id - Eliminar empresa por completo (en cascada manual para máxima compatibilidad)
router.delete('/tenants/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const empresa = await get('SELECT nombre_comercial FROM empresas WHERE id_empresa = ?', [id]);
        if (!empresa) {
            return res.status(404).json({ error: 'Empresa no encontrada.' });
        }

        console.log(`🗑️ Iniciando borrado manual secuencial de datos vinculados para empresa ID ${id} (${empresa.nombre_comercial})...`);
        
        // Borrar registros en orden inverso de dependencias para evitar violaciones de clave foránea
        await run('DELETE FROM whatsapp_notifications WHERE id_empresa = ?', [id]);
        await run('DELETE FROM auditoria_caja WHERE id_empresa = ?', [id]);
        await run('DELETE FROM cuotas WHERE id_empresa = ?', [id]);
        await run('DELETE FROM ficheros WHERE id_empresa = ?', [id]);
        await run('DELETE FROM clientes WHERE id_empresa = ?', [id]);
        await run('DELETE FROM usuarios WHERE id_empresa = ?', [id]);
        await run('DELETE FROM empresas WHERE id_empresa = ?', [id]);

        console.log(`✅ Borrado de empresa ID ${id} finalizado.`);

        res.json({
            success: true,
            message: `🗑️ Empresa "${empresa.nombre_comercial}" y todos sus datos vinculados fueron eliminados correctamente.`
        });
    } catch (err) {
        console.error('Error al eliminar empresa:', err);
        res.status(500).json({ error: 'Error al eliminar la empresa: ' + (err.message || err) });
    }
});

// PUT /api/superadmin/tenants/:id/logo - Actualizar logo_url de la empresa
router.put('/tenants/:id/logo', async (req, res) => {
    const { id } = req.params;
    const { logo_url } = req.body;

    if (!logo_url || logo_url.trim().length === 0) {
        return res.status(400).json({ error: 'Debe especificar una URL de logo válida.' });
    }

    try {
        const empresa = await get('SELECT nombre_comercial FROM empresas WHERE id_empresa = ?', [id]);
        if (!empresa) {
            return res.status(404).json({ error: 'Empresa no encontrada.' });
        }

        await run('UPDATE empresas SET logo_url = ? WHERE id_empresa = ?', [logo_url.trim(), id]);

        res.json({
            success: true,
            message: `🖼️ Logo de "${empresa.nombre_comercial}" actualizado con éxito.`
        });
    } catch (err) {
        console.error('Error al actualizar logo de empresa:', err);
        res.status(500).json({ error: 'Error al actualizar el logo de la empresa.' });
    }
});

// PUT /api/superadmin/tenants/:id/password - Actualizar contraseña de administrador de la empresa (Tenant)
router.put('/tenants/:id/password', async (req, res) => {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.trim().length === 0) {
        return res.status(400).json({ error: 'La nueva contraseña no puede estar vacía.' });
    }

    try {
        const empresa = await get('SELECT nombre_comercial FROM empresas WHERE id_empresa = ?', [id]);
        if (!empresa) {
            return res.status(404).json({ error: 'Empresa no encontrada.' });
        }

        const bcrypt = require('bcryptjs');
        const passHash = await bcrypt.hash(password, 10);

        // Actualizar la contraseña de todos los usuarios con rol ADMIN_EMPRESA de esa empresa
        const result = await run(
            "UPDATE usuarios SET password_hash = ? WHERE id_empresa = ? AND rol = 'ADMIN_EMPRESA'",
            [passHash, id]
        );

        if (result.changes === 0) {
            return res.status(400).json({ 
                error: `No se encontró un usuario administrador (ADMIN_EMPRESA) activo para la empresa "${empresa.nombre_comercial}".` 
            });
        }

        res.json({
            success: true,
            message: `🔑 Contraseña del administrador de "${empresa.nombre_comercial}" actualizada con éxito.`
        });
    } catch (err) {
        console.error('Error al actualizar contraseña de empresa:', err);
        res.status(500).json({ error: 'Error al actualizar la contraseña del administrador.' });
    }
});

module.exports = router;
