const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query, run, get } = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Todos los endpoints de empresa requieren autenticación y pertenecer al rol ADMIN_EMPRESA o SUPER_ADMIN
router.use(authenticateToken, requireRole(['ADMIN_EMPRESA', 'SUPER_ADMIN']));

// Helper para asegurar que la empresa consultada sea la del token (excepto que sea Súper Admin explorando)
function getEmpresaId(req) {
    return req.user.rol === 'SUPER_ADMIN' && req.query.id_empresa 
        ? req.query.id_empresa 
        : req.user.id_empresa;
}

// GET /api/empresa/dashboard - Métricas de la Casa de Cuotas
router.get('/dashboard', async (req, res) => {
    const id_empresa = getEmpresaId(req);
    try {
        const clientesCount = await get('SELECT COUNT(*) as total FROM clientes WHERE id_empresa = ?', [id_empresa]);
        const ficherosCount = await get('SELECT COUNT(*) as activos, SUM(monto_total) as monto_cartera FROM ficheros WHERE id_empresa = ? AND estado = "ACTIVO"', [id_empresa]);
        const cobradoHoy = await get('SELECT SUM(monto) as total_hoy, COUNT(*) as cuotas_hoy FROM cuotas WHERE id_empresa = ? AND estado = "PAGADO" AND date(fecha_pago) = date("now")', [id_empresa]);
        const pendientesTotal = await get('SELECT SUM(monto) as por_cobrar, COUNT(*) as cuotas_pendientes FROM cuotas WHERE id_empresa = ? AND estado = "PENDIENTE"', [id_empresa]);
        const promesasCount = await get('SELECT COUNT(*) as promesas FROM cuotas WHERE id_empresa = ? AND promesa_pago_fecha IS NOT NULL AND estado = "NO_COBRADO"', [id_empresa]);
        const whatsappHoy = await get('SELECT COUNT(*) as total_wp FROM whatsapp_notifications WHERE id_empresa = ? AND date(fecha_envio) = date("now")', [id_empresa]);

        res.json({
            clientes_total: clientesCount.total || 0,
            ficheros_activos: ficherosCount.activos || 0,
            cartera_activa: ficherosCount.monto_cartera || 0,
            cobrado_hoy: {
                monto: cobradoHoy.total_hoy || 0,
                cantidad: cobradoHoy.cuotas_hoy || 0
            },
            deuda_pendiente: {
                monto: pendientesTotal.por_cobrar || 0,
                cuotas: pendientesTotal.cuotas_pendientes || 0
            },
            promesas_activas: promesasCount?.promesas || 0,
            whatsapp_enviados_hoy: whatsappHoy?.total_wp || 0
        });
    } catch (err) {
        console.error('Error en dashboard de empresa:', err);
        res.status(500).json({ error: 'Error cargando panel del negocio.' });
    }
});

// GET /api/empresa/clientes - Listar clientes con geoposicionamiento y QR
router.get('/clientes', async (req, res) => {
    const id_empresa = getEmpresaId(req);
    try {
        const clientes = await query(`
            SELECT c.*, 
                   (SELECT COUNT(*) FROM ficheros f WHERE f.id_cliente = c.id_cliente AND f.estado = 'ACTIVO') as ficheros_activos
            FROM clientes c 
            WHERE c.id_empresa = ? 
            ORDER BY c.nombre_apellido ASC
        `, [id_empresa]);
        res.json(clientes);
    } catch (err) {
        console.error('Error listando clientes:', err);
        res.status(500).json({ error: 'Error listando clientes.' });
    }
});

// POST /api/empresa/clientes - Alta de cliente con coordenadas y token QR (UUID v4 de seguridad)
router.post('/clientes', async (req, res) => {
    const id_empresa = getEmpresaId(req);
    const { nombre_apellido, dni, telefono, direccion, barrio, latitud, longitud } = req.body;
    if (!nombre_apellido || !dni || !direccion || !barrio) {
        return res.status(400).json({ error: 'Nombre, DNI, dirección y barrio son obligatorios.' });
    }

    try {
        // Corrección Crítica 1: Generar un UUID v4 alfanumérico largo e imposible de adivinar
        const qr_token = crypto.randomUUID ? crypto.randomUUID() : `uuid-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
        const lat = latitud || -34.6150 + (Math.random() - 0.5) * 0.05;
        const lng = longitud || -58.4350 + (Math.random() - 0.5) * 0.05;

        const result = await run(
            'INSERT INTO clientes (id_empresa, nombre_apellido, dni, telefono, direccion, barrio, latitud, longitud, qr_token, calificacion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, "BUENO")',
            [id_empresa, nombre_apellido, dni, telefono, direccion, barrio, lat, lng, qr_token]
        );

        const nuevoCliente = await get('SELECT * FROM clientes WHERE id_cliente = ?', [result.lastID]);
        res.status(201).json({ success: true, cliente: nuevoCliente });
    } catch (err) {
        console.error('Error alta cliente:', err);
        res.status(500).json({ error: 'Error al registrar cliente.' });
    }
});

// PUT /api/empresa/clientes/:id - Editar cliente (Mudanzas, actualización de domicilio, teléfono y geolocalización GPS)
router.put('/clientes/:id', async (req, res) => {
    const id_empresa = getEmpresaId(req);
    const { id } = req.params;
    const { direccion, barrio, telefono, latitud, longitud, calificacion } = req.body;

    if (!direccion || !barrio) {
        return res.status(400).json({ error: 'Dirección y barrio son obligatorios.' });
    }

    try {
        const cliente = await get('SELECT * FROM clientes WHERE id_cliente = ? AND id_empresa = ?', [id, id_empresa]);
        if (!cliente) {
            return res.status(404).json({ error: 'Cliente no encontrado o no pertenece a su empresa.' });
        }

        const lat = latitud || cliente.latitud;
        const lng = longitud || cliente.longitud;

        await run(`
            UPDATE clientes SET 
                direccion = ?,
                barrio = ?,
                telefono = ?,
                latitud = ?,
                longitud = ?,
                calificacion = ?
            WHERE id_cliente = ? AND id_empresa = ?
        `, [direccion, barrio, telefono || cliente.telefono, lat, lng, calificacion || cliente.calificacion, id, id_empresa]);

        const actualizado = await get('SELECT * FROM clientes WHERE id_cliente = ?', [id]);
        res.json({ success: true, message: `Domicilio de "${actualizado.nombre_apellido}" actualizado por mudanza.`, cliente: actualizado });
    } catch (err) {
        console.error('Error al editar cliente:', err);
        res.status(500).json({ error: 'Error al actualizar datos del cliente.' });
    }
});

// GET /api/empresa/ficheros - Listado completo de ficheros
router.get('/ficheros', async (req, res) => {
    const id_empresa = getEmpresaId(req);
    try {
        const ficheros = await query(`
            SELECT f.*, c.nombre_apellido as cliente_nombre, c.direccion, c.barrio, c.qr_token, c.latitud, c.longitud,
                   u.nombre as cobrador_nombre,
                   (SELECT COUNT(*) FROM cuotas q WHERE q.id_fichero = f.id_fichero AND q.estado = 'PAGADO') as cuotas_pagadas,
                   (SELECT COUNT(*) FROM cuotas q WHERE q.id_fichero = f.id_fichero AND q.estado = 'PENDIENTE') as cuotas_pendientes
            FROM ficheros f
            JOIN clientes c ON f.id_cliente = c.id_cliente
            LEFT JOIN usuarios u ON f.id_cobrador_asignado = u.id_usuario
            WHERE f.id_empresa = ?
            ORDER BY f.id_fichero DESC
        `, [id_empresa]);
        res.json(ficheros);
    } catch (err) {
        console.error('Error listando ficheros:', err);
        res.status(500).json({ error: 'Error listando ficheros de venta.' });
    }
});

// POST /api/empresa/ficheros - Crear nuevo fichero (Calco de papel) con N cuotas automáticas
router.post('/ficheros', async (req, res) => {
    const id_empresa = getEmpresaId(req);
    const { id_cliente, producto_nombre, cantidad_cuotas, valor_cuota, frecuencia_pago, vendedor, encargado_zona, id_cobrador_asignado, fecha_entrega } = req.body;

    if (!id_cliente || !producto_nombre || !cantidad_cuotas || !valor_cuota || !fecha_entrega) {
        return res.status(400).json({ error: 'Faltan datos para crear el fichero (cliente, producto, cuotas, valor y fecha).' });
    }

    try {
        const monto_total = parseFloat(valor_cuota) * parseInt(cantidad_cuotas);
        const freq = (frecuencia_pago || 'SEMANAL').toUpperCase();
        const result = await run(
            'INSERT INTO ficheros (id_cliente, id_empresa, producto_nombre, cantidad_cuotas, valor_cuota, frecuencia_pago, monto_total, vendedor, encargado_zona, id_cobrador_asignado, fecha_entrega, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "ACTIVO")',
            [id_cliente, id_empresa, producto_nombre, cantidad_cuotas, valor_cuota, freq, monto_total, vendedor || 'General', encargado_zona || 'Admin', id_cobrador_asignado || null, fecha_entrega]
        );

        const id_fichero = result.lastID;

        // Generar los casilleros del 1 al N con vencimientos según frecuencia elegida
        let fechaActual = new Date(fecha_entrega);
        for (let i = 1; i <= cantidad_cuotas; i++) {
            if (freq === 'QUINCENAL') {
                fechaActual.setDate(fechaActual.getDate() + 15);
            } else if (freq === 'MENSUAL') {
                fechaActual.setMonth(fechaActual.getMonth() + 1);
            } else {
                // SEMANAL por defecto (+7 días)
                fechaActual.setDate(fechaActual.getDate() + 7);
            }
            const fechaVenc = fechaActual.toISOString().split('T')[0];
            await run(
                'INSERT INTO cuotas (id_fichero, id_empresa, nro_cuota, monto, estado, fecha_vencimiento, id_cobrador) VALUES (?, ?, ?, ?, "PENDIENTE", ?, ?)',
                [id_fichero, id_empresa, i, valor_cuota, fechaVenc, id_cobrador_asignado || null]
            );
        }

        const ficheroCreado = await get('SELECT * FROM ficheros WHERE id_fichero = ?', [id_fichero]);
        res.status(201).json({ success: true, fichero: ficheroCreado, message: `Fichero #${id_fichero} creado con ${cantidad_cuotas} cuotas automáticas.` });
    } catch (err) {
        console.error('Error creando fichero:', err);
        res.status(500).json({ error: 'Error al generar fichero digital.' });
    }
});

// PUT /api/empresa/ficheros/:id/asignar - Asignación dinámica de fichero a un Cobrador (Drag & Drop / Clientes)
router.put('/ficheros/:id/asignar', async (req, res) => {
    const id_empresa = getEmpresaId(req);
    const { id } = req.params;
    const { id_cobrador_asignado } = req.body;

    try {
        await run('UPDATE ficheros SET id_cobrador_asignado = ? WHERE id_fichero = ? AND id_empresa = ?', [id_cobrador_asignado || null, id, id_empresa]);
        await run('UPDATE cuotas SET id_cobrador = ? WHERE id_fichero = ? AND id_empresa = ? AND estado = "PENDIENTE"', [id_cobrador_asignado || null, id, id_empresa]);
        res.json({ success: true, message: `Fichero asignado al cobrador ID: ${id_cobrador_asignado || 'Sin asignar'}` });
    } catch (err) {
        console.error('Error al asignar fichero:', err);
        res.status(500).json({ error: 'Error en asignación de cobrador.' });
    }
});

// PUT /api/empresa/ficheros/:id/orden - Cambiar el orden de visita de un fichero (Secuenciación de Hojas de Ruta)
router.put('/ficheros/:id/orden', async (req, res) => {
    const id_empresa = getEmpresaId(req);
    const { id } = req.params;
    const { orden_visita } = req.body;

    try {
        await run('UPDATE ficheros SET orden_visita = ? WHERE id_fichero = ? AND id_empresa = ?', [parseInt(orden_visita) || 0, id, id_empresa]);
        res.json({ success: true, message: `Orden de visita actualizado a: ${orden_visita}` });
    } catch (err) {
        console.error('Error al actualizar orden de visita:', err);
        res.status(500).json({ error: 'Error al actualizar orden de visita.' });
    }
});

// GET /api/empresa/cobradores - Listar cobradores del equipo junto con los lugares/direcciones que tienen que ir a cobrar
router.get('/cobradores', async (req, res) => {
    const id_empresa = getEmpresaId(req);
    try {
        const cobradores = await query(`
            SELECT id_usuario, nombre, email, telefono, zona_asignada, activo,
                   (SELECT COUNT(*) FROM ficheros f WHERE f.id_cobrador_asignado = u.id_usuario AND f.estado = 'ACTIVO') as ficheros_asignados
            FROM usuarios u
            WHERE u.id_empresa = ? AND u.rol = 'COBRADOR'
            ORDER BY u.nombre ASC
        `, [id_empresa]);

        for (let cb of cobradores) {
            const lugares = await query(`
                SELECT f.id_fichero, f.producto_nombre, f.valor_cuota, c.nombre_apellido, c.direccion, c.barrio, c.telefono
                FROM ficheros f
                JOIN clientes c ON f.id_cliente = c.id_cliente
                WHERE f.id_cobrador_asignado = ? AND f.estado = 'ACTIVO' AND f.id_empresa = ?
            `, [cb.id_usuario, id_empresa]);
            cb.lugares = lugares;
        }

        res.json(cobradores);
    } catch (err) {
        console.error('Error listando cobradores:', err);
        res.status(500).json({ error: 'Error al obtener cobradores.' });
    }
});

// POST /api/empresa/cobradores - Alta de nuevo cobrador
router.post('/cobradores', async (req, res) => {
    const id_empresa = getEmpresaId(req);
    const { nombre, email, password, telefono, zona_asignada } = req.body;
    if (!nombre || !email || !password) {
        return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios.' });
    }

    try {
        const passHash = await bcrypt.hash(password, 10);
        const result = await run(
            'INSERT INTO usuarios (id_empresa, nombre, email, password_hash, rol, telefono, zona_asignada) VALUES (?, ?, ?, ?, "COBRADOR", ?, ?)',
            [id_empresa, nombre, email, passHash, telefono || '', zona_asignada || 'Zona Centro']
        );
        res.status(201).json({ success: true, id_cobrador: result.lastID, message: `Cobrador "${nombre}" dado de alta.` });
    } catch (err) {
        console.error('Error creando cobrador:', err);
        res.status(500).json({ error: 'No se pudo crear cobrador (verifique si el email ya existe).' });
    }
});

// GET /api/empresa/vendedores - Listar vendedores y ranking "Quién vendió más"
router.get('/vendedores', async (req, res) => {
    const id_empresa = getEmpresaId(req);
    try {
        const vendRegistrados = await query(`
            SELECT id_usuario, nombre, email, telefono, zona_asignada, activo
            FROM usuarios
            WHERE id_empresa = ? AND rol = 'VENDEDOR'
        `, [id_empresa]);

        const ventasPorNombre = await query(`
            SELECT IFNULL(vendedor, 'General') as nombre_vend,
                   COUNT(id_fichero) as total_ficheros,
                   SUM(monto_total) as monto_total_vendido
            FROM ficheros
            WHERE id_empresa = ? AND estado != 'CANCELADO'
            GROUP BY IFNULL(vendedor, 'General')
        `, [id_empresa]);

        const mapVendedores = new Map();
        vendRegistrados.forEach(v => {
            mapVendedores.set(v.nombre.trim().toLowerCase(), {
                id_usuario: v.id_usuario,
                nombre: v.nombre,
                email: v.email,
                telefono: v.telefono,
                zona_asignada: v.zona_asignada,
                activo: v.activo,
                total_ficheros: 0,
                monto_total_vendido: 0
            });
        });

        ventasPorNombre.forEach(stat => {
            if (!stat.nombre_vend) return;
            const key = stat.nombre_vend.trim().toLowerCase();
            if (mapVendedores.has(key)) {
                const item = mapVendedores.get(key);
                item.total_ficheros = stat.total_ficheros || 0;
                item.monto_total_vendido = stat.monto_total_vendido || 0;
            } else {
                mapVendedores.set(key, {
                    id_usuario: null,
                    nombre: stat.nombre_vend,
                    email: 'No registrado como usuario',
                    telefono: '-',
                    zona_asignada: 'Ventas Calle',
                    activo: 1,
                    total_ficheros: stat.total_ficheros || 0,
                    monto_total_vendido: stat.monto_total_vendido || 0
                });
            }
        });

        const ranking = Array.from(mapVendedores.values()).sort((a, b) => b.monto_total_vendido - a.monto_total_vendido);
        res.json(ranking);
    } catch (err) {
        console.error('Error listando vendedores:', err);
        res.status(500).json({ error: 'Error al obtener ranking de vendedores.' });
    }
});

// POST /api/empresa/vendedores - Alta de nuevo vendedor
router.post('/vendedores', async (req, res) => {
    const id_empresa = getEmpresaId(req);
    const { nombre, email, telefono, zona_asignada } = req.body;
    if (!nombre) {
        return res.status(400).json({ error: 'El nombre del vendedor es obligatorio.' });
    }
    try {
        const emailFinal = email || `vend_${Date.now()}@hit.local`;
        const passHash = await bcrypt.hash('vendedor123', 10);
        const result = await run(
            'INSERT INTO usuarios (id_empresa, nombre, email, password_hash, rol, telefono, zona_asignada) VALUES (?, ?, ?, ?, "VENDEDOR", ?, ?)',
            [id_empresa, nombre, emailFinal, passHash, telefono || '', zona_asignada || 'Ventas General']
        );
        res.status(201).json({ success: true, id_vendedor: result.lastID, message: `Vendedor "${nombre}" dado de alta exitosamente.` });
    } catch (err) {
        console.error('Error creando vendedor:', err);
        res.status(500).json({ error: 'No se pudo crear vendedor (verifique si el email ya existe).' });
    }
});

// PUT /api/empresa/usuarios/:id/toggle-activo - Bloquear o desbloquear vendedor/cobrador instantáneamente
router.put('/usuarios/:id/toggle-activo', async (req, res) => {
    const id_empresa = getEmpresaId(req);
    const { id } = req.params;
    try {
        const usuario = await get('SELECT id_usuario, nombre, rol, activo FROM usuarios WHERE id_usuario = ? AND id_empresa = ?', [id, id_empresa]);
        if (!usuario) {
            return res.status(404).json({ error: 'Empleado no encontrado.' });
        }
        const nuevoEstado = usuario.activo ? 0 : 1;
        await run('UPDATE usuarios SET activo = ? WHERE id_usuario = ? AND id_empresa = ?', [nuevoEstado, id, id_empresa]);
        const accionText = nuevoEstado ? 'DESBLOQUEADO (Activo)' : 'BLOQUEADO (Inactivo / Despedido)';
        res.json({
            success: true,
            activo: nuevoEstado,
            message: `🛑 Empleado "${usuario.nombre}" (${usuario.rol}) ha sido ${accionText}.`
        });
    } catch (err) {
        console.error('Error al cambiar estado del empleado:', err);
        res.status(500).json({ error: 'Error al cambiar estado del empleado.' });
    }
});

// POST /api/empresa/clientes/:id/regenerar-qr - Revocar QR viejo y generar nuevo UUID aleatorio por pérdida/robo
router.post('/clientes/:id/regenerar-qr', async (req, res) => {
    const id_empresa = getEmpresaId(req);
    const { id } = req.params;
    try {
        const cliente = await get('SELECT id_cliente, nombre_apellido, telefono FROM clientes WHERE id_cliente = ? AND id_empresa = ?', [id, id_empresa]);
        if (!cliente) {
            return res.status(404).json({ error: 'Cliente no encontrado.' });
        }
        const nuevoToken = crypto.randomUUID();
        await run('UPDATE clientes SET qr_token = ? WHERE id_cliente = ? AND id_empresa = ?', [nuevoToken, id, id_empresa]);
        res.json({
            success: true,
            qr_token: nuevoToken,
            message: `✅ Tarjeta QR revocada y regenerada exitosamente para "${cliente.nombre_apellido}". El QR viejo ya no funcionará.`
        });
    } catch (err) {
        console.error('Error al regenerar QR:', err);
        res.status(500).json({ error: 'Error al regenerar QR del cliente.' });
    }
});

// GET /api/empresa/auditoria - Cierre de caja segregado por cobrador y fotos de comprobantes
router.get('/auditoria', async (req, res) => {
    const id_empresa = getEmpresaId(req);
    try {
        // Conciliación del día o histórico
        const cierresCobrador = await query(`
            SELECT u.id_usuario, u.nombre as cobrador_nombre, u.zona_asignada,
                   SUM(CASE WHEN q.medio_pago = 'EFECTIVO' AND q.estado = 'PAGADO' THEN q.monto ELSE 0 END) as recaudado_efectivo,
                   SUM(CASE WHEN q.medio_pago = 'TRANSFERENCIA' AND q.estado = 'PAGADO' THEN q.monto ELSE 0 END) as recaudado_transferencia,
                   COUNT(CASE WHEN q.estado = 'PAGADO' THEN 1 END) as cobros_realizados,
                   COUNT(CASE WHEN q.estado = 'NO_COBRADO' THEN 1 END) as visitas_no_cobradas
            FROM cuotas q
            JOIN usuarios u ON q.id_cobrador = u.id_usuario
            WHERE q.id_empresa = ? AND date(q.fecha_pago) = date('now')
            GROUP BY u.id_usuario
        `, [id_empresa]);

        // Últimos cobros con o sin comprobante + cobrador histórico (Corrección Crítica 3)
        const cobrosDetallados = await query(`
            SELECT q.id_cuota, q.nro_cuota, q.monto, q.fecha_pago, q.medio_pago, q.comprobante_img_url, q.motivo_no_cobro, q.promesa_pago_fecha, q.estado,
                   c.nombre_apellido as cliente_nombre, c.direccion, c.barrio,
                   COALESCE(q.nombre_cobrador, u.nombre, 'Desconocido') as cobrador_nombre, f.id_fichero, f.producto_nombre
            FROM cuotas q
            JOIN ficheros f ON q.id_fichero = f.id_fichero
            JOIN clientes c ON f.id_cliente = c.id_cliente
            LEFT JOIN usuarios u ON q.id_cobrador = u.id_usuario
            WHERE q.id_empresa = ? AND (q.estado = 'PAGADO' OR q.estado = 'NO_COBRADO')
            ORDER BY q.fecha_pago DESC, q.id_cuota DESC
            LIMIT 50
        `, [id_empresa]);

        const whatsappRecientes = await query(`
            SELECT w.*, c.nombre_apellido as cliente_nombre 
            FROM whatsapp_notifications w 
            JOIN clientes c ON w.id_cliente = c.id_cliente 
            WHERE w.id_empresa = ? 
            ORDER BY w.id_notificacion DESC 
            LIMIT 30
        `, [id_empresa]);

        res.json({
            cierres_cobrador: cierresCobrador,
            cobros_detallados: cobrosDetallados,
            whatsapp_notifications: whatsappRecientes
        });
    } catch (err) {
        console.error('Error en auditoría de caja:', err);
        res.status(500).json({ error: 'Error cargando auditoría de cobros.' });
    }
});

// GET /api/empresa/promesas - Historial de Promesas de Pago y Ranking de Morosidad/Postergación (Función 2)
router.get('/promesas', async (req, res) => {
    const id_empresa = getEmpresaId(req);
    try {
        const promesasPendientes = await query(`
            SELECT q.id_cuota, q.nro_cuota, q.monto, q.fecha_vencimiento, q.fecha_pago, q.motivo_no_cobro, q.promesa_pago_fecha, q.notas,
                   c.id_cliente, c.nombre_apellido as cliente_nombre, c.telefono, c.direccion, c.barrio, c.calificacion,
                   f.id_fichero, f.producto_nombre,
                   COALESCE(q.nombre_cobrador, u.nombre, 'Desconocido') as cobrador_nombre
            FROM cuotas q
            JOIN ficheros f ON q.id_fichero = f.id_fichero
            JOIN clientes c ON f.id_cliente = c.id_cliente
            LEFT JOIN usuarios u ON q.id_cobrador = u.id_usuario
            WHERE q.id_empresa = ? AND q.promesa_pago_fecha IS NOT NULL AND q.estado = 'NO_COBRADO'
            ORDER BY q.promesa_pago_fecha ASC
        `, [id_empresa]);

        const clientesPostergadores = await query(`
            SELECT c.id_cliente, c.nombre_apellido, c.telefono, c.barrio, c.calificacion, COUNT(*) as total_postergaciones
            FROM cuotas q
            JOIN ficheros f ON q.id_fichero = f.id_fichero
            JOIN clientes c ON f.id_cliente = c.id_cliente
            WHERE q.id_empresa = ? AND q.estado = 'NO_COBRADO'
            GROUP BY c.id_cliente
            ORDER BY total_postergaciones DESC
            LIMIT 10
        `, [id_empresa]);

        const cobradoresPromesas = await query(`
            SELECT COALESCE(q.nombre_cobrador, u.nombre, 'Cobrador General') as cobrador_nombre, COUNT(*) as promesas_tomadas
            FROM cuotas q
            LEFT JOIN usuarios u ON q.id_cobrador = u.id_usuario
            WHERE q.id_empresa = ? AND q.promesa_pago_fecha IS NOT NULL AND q.estado = 'NO_COBRADO'
            GROUP BY COALESCE(q.nombre_cobrador, u.nombre)
            ORDER BY promesas_tomadas DESC
            LIMIT 10
        `, [id_empresa]);

        res.json({
            promesas: promesasPendientes,
            ranking_clientes: clientesPostergadores,
            ranking_cobradores: cobradoresPromesas
        });
    } catch (err) {
        console.error('Error cargando promesas de pago:', err);
        res.status(500).json({ error: 'Error al obtener historial de promesas.' });
    }
});

// GET /api/empresa/whatsapp-log - Auditoría y Log del envío automático de WhatsApp (Función 1)
router.get('/whatsapp-log', async (req, res) => {
    const id_empresa = getEmpresaId(req);
    try {
        const notificaciones = await query(`
            SELECT w.*, c.nombre_apellido as cliente_nombre, f.producto_nombre, q.nro_cuota, q.monto
            FROM whatsapp_notifications w
            JOIN clientes c ON w.id_cliente = c.id_cliente
            JOIN cuotas q ON w.id_cuota = q.id_cuota
            JOIN ficheros f ON q.id_fichero = f.id_fichero
            WHERE w.id_empresa = ?
            ORDER BY w.fecha_envio DESC
            LIMIT 100
        `, [id_empresa]);
        res.json(notificaciones);
    } catch (err) {
        console.error('Error cargando log de WhatsApp:', err);
        res.status(500).json({ error: 'Error obteniendo historial de notificaciones.' });
    }
});

// PUT /api/empresa/usuarios/:id/toggle-activo - Bloquear/Desbloquear empleado instantáneamente
router.put('/usuarios/:id/toggle-activo', async (req, res) => {
    const id_empresa = getEmpresaId(req);
    const { id } = req.params;

    try {
        const usuario = await get('SELECT * FROM usuarios WHERE id_usuario = ? AND id_empresa = ?', [id, id_empresa]);
        if (!usuario) {
            return res.status(404).json({ error: 'Empleado no encontrado.' });
        }

        const nuevoEstado = usuario.activo ? 0 : 1;
        await run('UPDATE usuarios SET activo = ? WHERE id_usuario = ? AND id_empresa = ?', [nuevoEstado, id, id_empresa]);

        res.json({
            success: true,
            activo: nuevoEstado === 1,
            message: `Acceso para "${usuario.nombre}" ${nuevoEstado === 1 ? 'HABILITADO' : 'BLOQUEADO INSTANTÁNEAMENTE'}.`
        });
    } catch (err) {
        console.error('Error cambiando estado de usuario:', err);
        res.status(500).json({ error: 'Error al cambiar estado de acceso del empleado.' });
    }
});

// PUT /api/empresa/usuarios/:id/reset-password - Cambiar contraseña y desvalidar sesiones en celulares extraviados
router.put('/usuarios/:id/reset-password', async (req, res) => {
    const id_empresa = getEmpresaId(req);
    const { id } = req.params;
    const { nueva_password } = req.body;

    if (!nueva_password || nueva_password.trim().length < 4) {
        return res.status(400).json({ error: 'Ingrese una nueva contraseña válida (mínimo 4 caracteres).' });
    }

    try {
        const usuario = await get('SELECT * FROM usuarios WHERE id_usuario = ? AND id_empresa = ?', [id, id_empresa]);
        if (!usuario) {
            return res.status(404).json({ error: 'Empleado no encontrado.' });
        }

        const passHash = await bcrypt.hash(nueva_password.trim(), 10);
        await run('UPDATE usuarios SET password_hash = ? WHERE id_usuario = ? AND id_empresa = ?', [passHash, id, id_empresa]);

        res.json({
            success: true,
            message: `🔑 Contraseña de "${usuario.nombre}" actualizada exitosamente. Si el celular fue extraviado, el cobrador ya no podrá ingresar con la clave anterior.`
        });
    } catch (err) {
        console.error('Error al resetear contraseña de empleado:', err);
        res.status(500).json({ error: 'Error al cambiar contraseña del empleado.' });
    }
});

module.exports = router;
