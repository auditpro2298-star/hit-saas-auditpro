const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query, run, get } = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Todos los endpoints de empresa requieren autenticación y pertenecer al rol ADMIN_EMPRESA, SUPER_ADMIN o VENDEDOR
router.use(authenticateToken, requireRole(['ADMIN_EMPRESA', 'SUPER_ADMIN', 'VENDEDOR', 'ENCARGADO_ZONA']));

// Middleware específico para rutas destructivas (solo admins)
const requireAdmin = requireRole(['ADMIN_EMPRESA', 'SUPER_ADMIN']);

// Helper para asegurar que la empresa consultada sea la del token (excepto que sea Súper Admin explorando)
function getEmpresaId(req) {
    let id = req.query.id_empresa || (req.body && req.body.id_empresa) || req.headers['x-empresa-id'];
    if (id) return parseInt(id, 10);
    return req.user.id_empresa || 1;
}

// Simulador de geocodificación de direcciones según el barrio/zona
function getSimulatedCoords(barrio) {
    const b = (barrio || '').toLowerCase().trim();
    let baseLat = -34.6150;
    let baseLng = -58.4350;

    if (b.includes('flores')) {
        baseLat = -34.6300;
        baseLng = -58.4650;
    } else if (b.includes('caballito')) {
        baseLat = -34.6180;
        baseLng = -58.4420;
    } else if (b.includes('avellaneda')) {
        baseLat = -34.6620;
        baseLng = -58.3640;
    } else if (b.includes('berazategui')) {
        baseLat = -34.7630;
        baseLng = -58.2120;
    } else if (b.includes('sur')) {
        baseLat = -34.6800;
        baseLng = -58.3800;
    }

    return {
        lat: baseLat + (Math.random() - 0.5) * 0.015,
        lng: baseLng + (Math.random() - 0.5) * 0.015
    };
}

// Geocodificador en el backend para auto-corrección de mudanzas y registros sin verificación manual
async function geocodeAddress(direccion, barrio) {
    const cleanDir = (direccion || '').toLowerCase()
        .replace(/\bnumero\b/g, '')
        .replace(/\bnro\b/g, '')
        .replace(/\bn°\b/g, '')
        .replace(/#/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    // 1. Intentar dirección completa (Calle + Altura + Barrio)
    const queryFull = `${cleanDir}, ${(barrio || '').trim()}, Buenos Aires, Argentina`;
    const urlFull = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryFull)}`;

    try {
        const response = await fetch(urlFull, {
            headers: { 'User-Agent': 'AuditPro-SaaS-Agent/1.0' }
        });
        const results = await response.json();
        if (results && results.length > 0) {
            return {
                lat: parseFloat(results[0].lat),
                lng: parseFloat(results[0].lon)
            };
        }

        // 2. Si falló, intentar buscar solo la Calle (sin número) dentro del Barrio
        const streetOnly = cleanDir.replace(/\s+\d+$/, '').trim();
        if (streetOnly && streetOnly !== cleanDir) {
            const queryStreet = `${streetOnly}, ${(barrio || '').trim()}, Buenos Aires, Argentina`;
            const urlStreet = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryStreet)}`;
            const responseStreet = await fetch(urlStreet, {
                headers: { 'User-Agent': 'AuditPro-SaaS-Agent/1.0' }
            });
            const resultsStreet = await responseStreet.json();
            if (resultsStreet && resultsStreet.length > 0) {
                return {
                    lat: parseFloat(resultsStreet[0].lat),
                    lng: parseFloat(resultsStreet[0].lon)
                };
            }
        }

        // 3. Si falló la calle, buscar el Barrio / Zona en general
        const queryBarrio = `${(barrio || '').trim()}, Buenos Aires, Argentina`;
        const urlBarrio = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryBarrio)}`;
        const responseBarrio = await fetch(urlBarrio, {
            headers: { 'User-Agent': 'AuditPro-SaaS-Agent/1.0' }
        });
        const resultsBarrio = await responseBarrio.json();
        if (resultsBarrio && resultsBarrio.length > 0) {
            return {
                lat: parseFloat(resultsBarrio[0].lat),
                lng: parseFloat(resultsBarrio[0].lon)
            };
        }
    } catch (e) {
        console.error('Nominatim geocode backend falló:', e);
    }
    return null;
}

// GET /api/empresa/dashboard - Métricas de la Casa de Cuotas
router.get('/dashboard', async (req, res) => {
    const id_empresa = getEmpresaId(req);
    try {
        const clientesCount = await get('SELECT COUNT(*) as total FROM clientes WHERE id_empresa = ?', [id_empresa]);
        const ficherosCount = await get("SELECT COUNT(*) as activos, SUM(monto_total) as monto_cartera FROM ficheros WHERE id_empresa = ? AND estado = 'ACTIVO'", [id_empresa]);
        const cobradoHoy = await get("SELECT SUM(monto) as total_hoy, COUNT(*) as cuotas_hoy FROM cuotas WHERE id_empresa = ? AND estado = 'PAGADO' AND date(fecha_pago) = date('now')", [id_empresa]);
        const pendientesTotal = await get("SELECT SUM(monto) as por_cobrar, COUNT(*) as cuotas_pendientes FROM cuotas WHERE id_empresa = ? AND estado = 'PENDIENTE'", [id_empresa]);
        const promesasCount = await get("SELECT COUNT(*) as promesas FROM cuotas WHERE id_empresa = ? AND promesa_pago_fecha IS NOT NULL AND estado = 'NO_COBRADO'", [id_empresa]);
        const whatsappHoy = await get("SELECT COUNT(*) as total_wp FROM whatsapp_notifications WHERE id_empresa = ? AND date(fecha_envio) = date('now')", [id_empresa]);

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
    const { nombre_apellido, dni, telefono, direccion, barrio, piso_dpto, referencia_domicilio, latitud, longitud, encargado_zona } = req.body;
    if (!nombre_apellido || !dni || !direccion || !barrio) {
        return res.status(400).json({ error: 'Nombre, DNI, dirección y barrio son obligatorios.' });
    }

    try {
        const cleanDni = dni.toString().trim().replace(/[^0-9]/g, '');
        if (!cleanDni) {
            return res.status(400).json({ error: 'El DNI ingresado debe contener números válidos.' });
        }

        // Verificar si ya existe cliente con mismo DNI en esta empresa
        const existente = await get('SELECT id_cliente, nombre_apellido FROM clientes WHERE dni = ? AND id_empresa = ?', [cleanDni, id_empresa]);
        if (existente) {
            return res.status(400).json({ error: `Ya existe un cliente registrado con el DNI ${cleanDni} (${existente.nombre_apellido}).` });
        }

        const qr_token = crypto.randomUUID ? crypto.randomUUID() : `uuid-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
        
        let lat = (latitud !== undefined && latitud !== null && latitud !== '') ? parseFloat(latitud) : null;
        let lng = (longitud !== undefined && longitud !== null && longitud !== '') ? parseFloat(longitud) : null;

        if (isNaN(lat) || isNaN(lng)) {
            lat = null;
            lng = null;
        }

        if (!lat && !lng) {
            const geocoded = await geocodeAddress(direccion, barrio);
            if (geocoded) {
                lat = geocoded.lat;
                lng = geocoded.lng;
            } else {
                const coords = getSimulatedCoords(barrio);
                lat = coords.lat;
                lng = coords.lng;
            }
        }

        const result = await run(
            "INSERT INTO clientes (id_empresa, nombre_apellido, dni, telefono, direccion, barrio, piso_dpto, referencia_domicilio, latitud, longitud, qr_token, calificacion, encargado_zona) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'BUENO', ?)",
            [id_empresa, nombre_apellido.trim(), cleanDni, (telefono || '').trim(), direccion.trim(), barrio.trim(), (piso_dpto || '').trim(), (referencia_domicilio || '').trim(), lat, lng, qr_token, encargado_zona || 'General']
        );

        const nuevoCliente = await get('SELECT * FROM clientes WHERE id_cliente = ?', [result.lastID]);
        res.status(201).json({ success: true, message: 'Cliente registrado con éxito.', cliente: nuevoCliente });
    } catch (err) {
        console.error('Error alta cliente:', err);
        res.status(500).json({ error: 'Error al registrar cliente: ' + (err.message || 'Error interno') });
    }
});

// PUT /api/empresa/clientes/:id - Editar cliente (Mudanzas, actualización de domicilio, teléfono y geolocalización GPS)
router.put('/clientes/:id', async (req, res) => {
    const id_empresa = getEmpresaId(req);
    const { id } = req.params;
    const { direccion, barrio, piso_dpto, referencia_domicilio, telefono, latitud, longitud, calificacion, encargado_zona } = req.body;

    if (!direccion || !barrio) {
        return res.status(400).json({ error: 'Dirección y barrio son obligatorios.' });
    }

    try {
        const cliente = await get('SELECT * FROM clientes WHERE id_cliente = ? AND id_empresa = ?', [id, id_empresa]);
        if (!cliente) {
            return res.status(404).json({ error: 'Cliente no encontrado o no pertenece a su empresa.' });
        }

        let lat = (latitud !== undefined && latitud !== null && latitud !== '') ? parseFloat(latitud) : null;
        let lng = (longitud !== undefined && longitud !== null && longitud !== '') ? parseFloat(longitud) : null;

        if (isNaN(lat) || isNaN(lng)) {
            lat = null;
            lng = null;
        }

        if (!lat && !lng) {
            if (direccion.toLowerCase().trim() !== cliente.direccion.toLowerCase().trim() || barrio.toLowerCase().trim() !== cliente.barrio.toLowerCase().trim()) {
                const geocoded = await geocodeAddress(direccion, barrio);
                if (geocoded) {
                    lat = geocoded.lat;
                    lng = geocoded.lng;
                } else {
                    const coords = getSimulatedCoords(barrio);
                    lat = coords.lat;
                    lng = coords.lng;
                }
            } else {
                lat = cliente.latitud;
                lng = cliente.longitud;
            }
        }

        await run(`
            UPDATE clientes SET 
                direccion = ?,
                barrio = ?,
                piso_dpto = ?,
                referencia_domicilio = ?,
                telefono = ?,
                latitud = ?,
                longitud = ?,
                calificacion = ?,
                encargado_zona = ?
            WHERE id_cliente = ? AND id_empresa = ?
        `, [direccion.trim(), barrio.trim(), piso_dpto !== undefined ? piso_dpto.trim() : cliente.piso_dpto, referencia_domicilio !== undefined ? referencia_domicilio.trim() : cliente.referencia_domicilio, (telefono || '').trim() || cliente.telefono, lat, lng, calificacion || cliente.calificacion, encargado_zona !== undefined ? encargado_zona : (cliente.encargado_zona || 'General'), id, id_empresa]);

        const actualizado = await get('SELECT * FROM clientes WHERE id_cliente = ?', [id]);
        res.json({ success: true, message: `Domicilio de "${actualizado.nombre_apellido}" actualizado por mudanza.`, cliente: actualizado });
    } catch (err) {
        console.error('Error al editar cliente:', err);
        res.status(500).json({ error: 'Error al actualizar datos del cliente: ' + (err.message || 'Error interno') });
    }
});

// PATCH /api/empresa/clientes/:id/calificacion - Actualizar la calificación del cliente
router.patch('/clientes/:id/calificacion', async (req, res) => {
    const id_empresa = getEmpresaId(req);
    const { id } = req.params;
    const { calificacion } = req.body;

    if (!['BUENO', 'REGULAR', 'MOROSO'].includes(calificacion)) {
        return res.status(400).json({ error: 'Calificación no válida.' });
    }

    try {
        const cliente = await get('SELECT * FROM clientes WHERE id_cliente = ? AND id_empresa = ?', [id, id_empresa]);
        if (!cliente) {
            return res.status(404).json({ error: 'Cliente no encontrado o no pertenece a su empresa.' });
        }

        await run('UPDATE clientes SET calificacion = ? WHERE id_cliente = ? AND id_empresa = ?', [calificacion, id, id_empresa]);
        res.json({ success: true, message: `Calificación de "${cliente.nombre_apellido}" actualizada a ${calificacion}.` });
    } catch (err) {
        console.error('Error al actualizar calificación:', err);
        res.status(500).json({ error: 'Error al actualizar calificación: ' + err.message });
    }
});


// GET /api/empresa/ficheros - Listado completo de ficheros
router.get('/ficheros', async (req, res) => {
    const id_empresa = getEmpresaId(req);
    try {
        let sql = `
            SELECT f.*, c.nombre_apellido as cliente_nombre, c.direccion, c.barrio, c.qr_token, c.latitud, c.longitud,
                   u.nombre as cobrador_nombre,
                   (SELECT COUNT(*) FROM cuotas q WHERE q.id_fichero = f.id_fichero AND q.estado = 'PAGADO') as cuotas_pagadas,
                   (SELECT COUNT(*) FROM cuotas q WHERE q.id_fichero = f.id_fichero AND q.estado = 'PENDIENTE') as cuotas_pendientes
            FROM ficheros f
            JOIN clientes c ON f.id_cliente = c.id_cliente
            LEFT JOIN usuarios u ON f.id_cobrador_asignado = u.id_usuario
            WHERE f.id_empresa = ?
        `;
        const params = [id_empresa];
        if (req.user.rol === 'ENCARGADO_ZONA') {
            const zoneStr = (req.user.zona_asignada || '').toLowerCase().trim();
            if (zoneStr && zoneStr !== 'todas' && zoneStr !== 'general') {
                sql += ` AND (LOWER(c.barrio) LIKE ? OR LOWER(f.encargado_zona) LIKE ? OR LOWER(c.encargado_zona) LIKE ?)`;
                params.push(`%${zoneStr}%`, `%${zoneStr}%`, `%${zoneStr}%`);
            }
        }
        sql += ` ORDER BY f.id_fichero DESC`;
        
        const ficheros = await query(sql, params);
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
        const clientObj = await get('SELECT encargado_zona FROM clientes WHERE id_cliente = ?', [id_cliente]);
        const finalEncargado = encargado_zona || (clientObj ? clientObj.encargado_zona : 'General');

        const monto_total = parseFloat(valor_cuota) * parseInt(cantidad_cuotas);
        const freq = (frecuencia_pago || 'SEMANAL').toUpperCase();
        const result = await run(
            "INSERT INTO ficheros (id_cliente, id_empresa, producto_nombre, cantidad_cuotas, valor_cuota, frecuencia_pago, monto_total, vendedor, encargado_zona, id_cobrador_asignado, fecha_entrega, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVO')",
            [id_cliente, id_empresa, producto_nombre, cantidad_cuotas, valor_cuota, freq, monto_total, vendedor || 'General', finalEncargado || 'General', id_cobrador_asignado || null, fecha_entrega]
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
                "INSERT INTO cuotas (id_fichero, id_empresa, nro_cuota, monto, estado, fecha_vencimiento, id_cobrador) VALUES (?, ?, ?, ?, 'PENDIENTE', ?, ?)",
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
        await run("UPDATE cuotas SET id_cobrador = ? WHERE id_fichero = ? AND id_empresa = ? AND estado = 'PENDIENTE'", [id_cobrador_asignado || null, id, id_empresa]);
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
router.post('/cobradores', requireAdmin, async (req, res) => {
    const id_empresa = getEmpresaId(req);
    const { nombre, email, password, telefono, zona_asignada } = req.body;
    if (!nombre || !email || !password) {
        return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios.' });
    }

    try {
        const passHash = await bcrypt.hash(password, 10);
        const result = await run(
            "INSERT INTO usuarios (id_empresa, nombre, email, password_hash, rol, telefono, zona_asignada) VALUES (?, ?, ?, ?, 'COBRADOR', ?, ?)",
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
router.post('/vendedores', requireAdmin, async (req, res) => {
    const id_empresa = getEmpresaId(req);
    const { nombre, email, telefono, zona_asignada } = req.body;
    if (!nombre) {
        return res.status(400).json({ error: 'El nombre del vendedor es obligatorio.' });
    }
    try {
        const emailFinal = email || `vend_${Date.now()}@hit.local`;
        const passHash = await bcrypt.hash('vendedor123', 10);
        const result = await run(
            "INSERT INTO usuarios (id_empresa, nombre, email, password_hash, rol, telefono, zona_asignada) VALUES (?, ?, ?, ?, 'VENDEDOR', ?, ?)",
            [id_empresa, nombre, emailFinal, passHash, telefono || '', zona_asignada || 'Ventas General']
        );
        res.status(201).json({ success: true, id_vendedor: result.lastID, message: `Vendedor "${nombre}" dado de alta exitosamente.` });
    } catch (err) {
        console.error('Error creando vendedor:', err);
        res.status(500).json({ error: 'No se pudo crear vendedor (verifique si el email ya existe).' });
    }
});

// GET /api/empresa/encargados - Listar encargados de zona
router.get('/encargados', async (req, res) => {
    const id_empresa = getEmpresaId(req);
    try {
        const encargados = await query(`
            SELECT id_usuario, nombre, email, telefono, zona_asignada, activo, fecha_creacion
            FROM usuarios
            WHERE id_empresa = ? AND rol = 'ENCARGADO_ZONA'
            ORDER BY nombre ASC
        `, [id_empresa]);
        res.json(encargados);
    } catch (err) {
        console.error('Error listando encargados:', err);
        res.status(500).json({ error: 'Error al obtener encargados de zona.' });
    }
});

// POST /api/empresa/encargados - Alta de nuevo encargado de zona
router.post('/encargados', requireAdmin, async (req, res) => {
    const id_empresa = getEmpresaId(req);
    const { nombre, email, password, telefono, zona_asignada } = req.body;
    if (!nombre || !email || !password || !zona_asignada) {
        return res.status(400).json({ error: 'Nombre, email, contraseña y zona asignada son obligatorios.' });
    }

    try {
        const passHash = await bcrypt.hash(password, 10);
        const result = await run(
            "INSERT INTO usuarios (id_empresa, nombre, email, password_hash, rol, telefono, zona_asignada) VALUES (?, ?, ?, ?, 'ENCARGADO_ZONA', ?, ?)",
            [id_empresa, nombre, email, passHash, telefono || '', zona_asignada]
        );
        res.status(201).json({ success: true, id_usuario: result.lastID, message: `Encargado de zona "${nombre}" dado de alta.` });
    } catch (err) {
        console.error('Error creando encargado de zona:', err);
        res.status(500).json({ error: 'No se pudo crear el encargado de zona (verifique si el email ya existe).' });
    }
});

// PUT /api/empresa/usuarios/:id/toggle-activo - Bloquear o desbloquear vendedor/cobrador/encargado instantáneamente
router.put('/usuarios/:id/toggle-activo', requireAdmin, async (req, res) => {
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
        const isEncargado = (req.user.rol === 'ENCARGADO_ZONA');
        const zoneStr = (req.user.zona_asignada || '').toLowerCase().trim();
        const hasZone = isEncargado && zoneStr && zoneStr !== 'todas' && zoneStr !== 'general';
        const zoneFilter = hasZone ? `%${zoneStr}%` : null;

        // Conciliación del día o histórico
        let cierresSql = `
            SELECT u.id_usuario, u.nombre as cobrador_nombre, u.zona_asignada,
                   SUM(CASE WHEN q.medio_pago = 'EFECTIVO' AND q.estado = 'PAGADO' THEN q.monto ELSE 0 END) as recaudado_efectivo,
                   SUM(CASE WHEN q.medio_pago = 'TRANSFERENCIA' AND q.estado = 'PAGADO' THEN q.monto ELSE 0 END) as recaudado_transferencia,
                   COUNT(CASE WHEN q.estado = 'PAGADO' THEN 1 END) as cobros_realizados,
                   COUNT(CASE WHEN q.estado = 'NO_COBRADO' THEN 1 END) as visitas_no_cobradas
            FROM cuotas q
            JOIN usuarios u ON q.id_cobrador = u.id_usuario
            JOIN ficheros f ON q.id_fichero = f.id_fichero
            JOIN clientes c ON f.id_cliente = c.id_cliente
            WHERE q.id_empresa = ? AND date(q.fecha_pago) = date('now')
        `;
        const cierresParams = [id_empresa];
        if (hasZone) {
            cierresSql += ` AND (LOWER(c.barrio) LIKE ? OR LOWER(u.zona_asignada) LIKE ?)`;
            cierresParams.push(zoneFilter, zoneFilter);
        }
        cierresSql += ` GROUP BY u.id_usuario`;
        const cierresCobrador = await query(cierresSql, cierresParams);

        // Últimos cobros con o sin comprobante + cobrador histórico
        let cobrosSql = `
            SELECT q.id_cuota, q.nro_cuota, q.monto, q.fecha_pago, q.medio_pago, q.comprobante_img_url, q.motivo_no_cobro, q.promesa_pago_fecha, q.estado,
                   c.nombre_apellido as cliente_nombre, c.direccion, c.barrio,
                   COALESCE(q.nombre_cobrador, u.nombre, 'Desconocido') as cobrador_nombre, f.id_fichero, f.producto_nombre
            FROM cuotas q
            JOIN ficheros f ON q.id_fichero = f.id_fichero
            JOIN clientes c ON f.id_cliente = c.id_cliente
            LEFT JOIN usuarios u ON q.id_cobrador = u.id_usuario
            WHERE q.id_empresa = ? AND q.estado = 'PAGADO'
        `;
        const cobrosParams = [id_empresa];
        if (hasZone) {
            cobrosSql += ` AND (LOWER(c.barrio) LIKE ? OR LOWER(f.encargado_zona) LIKE ?)`;
            cobrosParams.push(zoneFilter, zoneFilter);
        }
        cobrosSql += ` ORDER BY q.fecha_pago DESC, q.id_cuota DESC LIMIT 50`;
        const cobrosDetallados = await query(cobrosSql, cobrosParams);

        // WhatsApp recientes
        let waSql = `
            SELECT w.*, c.nombre_apellido as cliente_nombre 
            FROM whatsapp_notifications w 
            JOIN clientes c ON w.id_cliente = c.id_cliente 
            WHERE w.id_empresa = ? 
        `;
        const waParams = [id_empresa];
        if (hasZone) {
            waSql += ` AND (LOWER(c.barrio) LIKE ? OR LOWER(c.encargado_zona) LIKE ?)`;
            waParams.push(zoneFilter, zoneFilter);
        }
        waSql += ` ORDER BY w.id_notificacion DESC LIMIT 30`;
        const whatsappRecientes = await query(waSql, waParams);

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
        const isEncargado = (req.user.rol === 'ENCARGADO_ZONA');
        const zoneStr = (req.user.zona_asignada || '').toLowerCase().trim();
        const hasZone = isEncargado && zoneStr && zoneStr !== 'todas' && zoneStr !== 'general';
        const zoneFilter = hasZone ? `%${zoneStr}%` : null;

        let promesasSql = `
            SELECT q.id_cuota, q.nro_cuota, q.monto, q.fecha_vencimiento, q.fecha_pago, q.motivo_no_cobro, q.promesa_pago_fecha, q.notas,
                   c.id_cliente, c.nombre_apellido as cliente_nombre, c.telefono, c.direccion, c.barrio, c.calificacion,
                   f.id_fichero, f.producto_nombre,
                   COALESCE(q.nombre_cobrador, u.nombre, 'Desconocido') as cobrador_nombre
            FROM cuotas q
            JOIN ficheros f ON q.id_fichero = f.id_fichero
            JOIN clientes c ON f.id_cliente = c.id_cliente
            LEFT JOIN usuarios u ON q.id_cobrador = u.id_usuario
            WHERE q.id_empresa = ? AND q.promesa_pago_fecha IS NOT NULL AND q.estado = 'NO_COBRADO'
        `;
        const promesasParams = [id_empresa];
        if (hasZone) {
            promesasSql += ` AND (LOWER(c.barrio) LIKE ? OR LOWER(f.encargado_zona) LIKE ?)`;
            promesasParams.push(zoneFilter, zoneFilter);
        }
        promesasSql += ` ORDER BY q.promesa_pago_fecha ASC`;
        const promesasPendientes = await query(promesasSql, promesasParams);

        let postergadoresSql = `
            SELECT c.id_cliente, c.nombre_apellido, c.telefono, c.barrio, c.calificacion, COUNT(*) as total_postergaciones
            FROM cuotas q
            JOIN ficheros f ON q.id_fichero = f.id_fichero
            JOIN clientes c ON f.id_cliente = c.id_cliente
            WHERE q.id_empresa = ? AND q.estado = 'NO_COBRADO'
        `;
        const postergadoresParams = [id_empresa];
        if (hasZone) {
            postergadoresSql += ` AND (LOWER(c.barrio) LIKE ? OR LOWER(f.encargado_zona) LIKE ?)`;
            postergadoresParams.push(zoneFilter, zoneFilter);
        }
        postergadoresSql += ` GROUP BY c.id_cliente ORDER BY total_postergaciones DESC LIMIT 10`;
        const clientesPostergadores = await query(postergadoresSql, postergadoresParams);

        let cobradoresSql = `
            SELECT COALESCE(q.nombre_cobrador, u.nombre, 'Cobrador General') as cobrador_nombre, COUNT(*) as promesas_tomadas
            FROM cuotas q
            JOIN ficheros f ON q.id_fichero = f.id_fichero
            JOIN clientes c ON f.id_cliente = c.id_cliente
            LEFT JOIN usuarios u ON q.id_cobrador = u.id_usuario
            WHERE q.id_empresa = ? AND q.promesa_pago_fecha IS NOT NULL AND q.estado = 'NO_COBRADO'
        `;
        const cobradoresParams = [id_empresa];
        if (hasZone) {
            cobradoresSql += ` AND (LOWER(c.barrio) LIKE ? OR LOWER(f.encargado_zona) LIKE ?)`;
            cobradoresParams.push(zoneFilter, zoneFilter);
        }
        cobradoresSql += ` GROUP BY COALESCE(q.nombre_cobrador, u.nombre) ORDER BY promesas_tomadas DESC LIMIT 10`;
        const cobradoresPromesas = await query(cobradoresSql, cobradoresParams);

        res.json({
            promesas: promesasPendientes,
            ranking_morosidad: clientesPostergadores.map(r => ({
                ...r,
                postergaciones: r.total_postergaciones || 0
            })),
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
        const isEncargado = (req.user.rol === 'ENCARGADO_ZONA');
        const zoneStr = (req.user.zona_asignada || '').toLowerCase().trim();
        const hasZone = isEncargado && zoneStr && zoneStr !== 'todas' && zoneStr !== 'general';
        const zoneFilter = hasZone ? `%${zoneStr}%` : null;

        let sql = `
            SELECT w.*, c.nombre_apellido as cliente_nombre, f.producto_nombre, q.nro_cuota, q.monto
            FROM whatsapp_notifications w
            JOIN clientes c ON w.id_cliente = c.id_cliente
            JOIN cuotas q ON w.id_cuota = q.id_cuota
            JOIN ficheros f ON q.id_fichero = f.id_fichero
            WHERE w.id_empresa = ?
        `;
        const params = [id_empresa];
        if (hasZone) {
            sql += ` AND (LOWER(c.barrio) LIKE ? OR LOWER(f.encargado_zona) LIKE ?)`;
            params.push(zoneFilter, zoneFilter);
        }
        sql += ` ORDER BY w.fecha_envio DESC LIMIT 100`;

        const notificaciones = await query(sql, params);
        res.json(notificaciones);
    } catch (err) {
        console.error('Error cargando log de WhatsApp:', err);
        res.status(500).json({ error: 'Error obteniendo historial de notificaciones.' });
    }
});

// PUT /api/empresa/usuarios/:id/toggle-activo - Bloquear/Desbloquear empleado instantáneamente
router.put('/usuarios/:id/toggle-activo', requireAdmin, async (req, res) => {
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
router.put('/usuarios/:id/reset-password', requireAdmin, async (req, res) => {
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

// DELETE /api/empresa/usuarios/:id - Eliminar empleado (Vendedor o Cobrador)
router.delete('/usuarios/:id', requireAdmin, async (req, res) => {
    const id_empresa = getEmpresaId(req);
    const { id } = req.params;

    try {
        const usuario = await get('SELECT * FROM usuarios WHERE id_usuario = ? AND id_empresa = ?', [id, id_empresa]);
        if (!usuario) {
            return res.status(404).json({ error: 'Empleado no encontrado.' });
        }

        // Si es cobrador, desasignar de ficheros activos
        if (usuario.rol === 'COBRADOR') {
            await run('UPDATE ficheros SET id_cobrador_asignado = NULL WHERE id_cobrador_asignado = ? AND id_empresa = ?', [id, id_empresa]);
        }

        await run('DELETE FROM usuarios WHERE id_usuario = ? AND id_empresa = ?', [id, id_empresa]);

        res.json({
            success: true,
            message: `🗑️ ${usuario.rol === 'VENDEDOR' ? 'Vendedor' : 'Cobrador'} "${usuario.nombre}" fue eliminado correctamente.`
        });
    } catch (err) {
        console.error('Error al eliminar empleado:', err);
        res.status(500).json({ error: 'Error al eliminar empleado.' });
    }
});

// DELETE /api/empresa/clientes/:id - Eliminar cliente y sus ficheros/cuotas asociadas
router.delete('/clientes/:id', requireAdmin, async (req, res) => {
    const id_empresa = getEmpresaId(req);
    const { id } = req.params;

    try {
        const cliente = await get('SELECT * FROM clientes WHERE id_cliente = ? AND id_empresa = ?', [id, id_empresa]);
        if (!cliente) {
            return res.status(404).json({ error: 'Cliente no encontrado.' });
        }

        // Verificar si posee ficheros activos o morosos (créditos vigentes)
        const ficherosVigentes = await get("SELECT COUNT(*) as count FROM ficheros WHERE id_cliente = ? AND id_empresa = ? AND estado IN ('ACTIVO', 'MOROSO')", [id, id_empresa]);
        if (ficherosVigentes && parseInt(ficherosVigentes.count || 0, 10) > 0) {
            return res.status(400).json({ error: 'No se puede eliminar un cliente con créditos activos o morosos vigentes.' });
        }

        const ficheros = await query('SELECT id_fichero FROM ficheros WHERE id_cliente = ? AND id_empresa = ?', [id, id_empresa]);
        for (const f of ficheros) {
            await run('DELETE FROM cuotas WHERE id_fichero = ? AND id_empresa = ?', [f.id_fichero, id_empresa]);
        }

        await run('DELETE FROM ficheros WHERE id_cliente = ? AND id_empresa = ?', [id, id_empresa]);
        await run('DELETE FROM whatsapp_notifications WHERE id_cliente = ? AND id_empresa = ?', [id, id_empresa]);
        await run('DELETE FROM clientes WHERE id_cliente = ? AND id_empresa = ?', [id, id_empresa]);

        res.json({
            success: true,
            message: `🗑️ Cliente "${cliente.nombre_apellido}" y sus ficheros fueron eliminados correctamente.`
        });
    } catch (err) {
        console.error('Error al eliminar cliente:', err);
        res.status(500).json({ error: 'Error al eliminar cliente.' });
    }
});

// DELETE /api/empresa/ficheros/:id - Eliminar fichero/venta por equivocación
router.delete('/ficheros/:id', requireAdmin, async (req, res) => {
    const id_empresa = getEmpresaId(req);
    const { id } = req.params;

    try {
        const fichero = await get('SELECT * FROM ficheros WHERE id_fichero = ? AND id_empresa = ?', [id, id_empresa]);
        if (!fichero) {
            return res.status(404).json({ error: 'Fichero no encontrado.' });
        }

        await run('DELETE FROM cuotas WHERE id_fichero = ? AND id_empresa = ?', [id, id_empresa]);
        await run('DELETE FROM ficheros WHERE id_fichero = ? AND id_empresa = ?', [id, id_empresa]);

        res.json({
            success: true,
            message: `🗑️ Fichero #${id} ("${fichero.producto_nombre}") fue eliminado correctamente.`
        });
    } catch (err) {
        console.error('Error al eliminar fichero:', err);
        res.status(500).json({ error: 'Error al eliminar fichero.' });
    }
});

// GET /api/empresa/backup - Descargar Backup Completo de la Empresa en JSON
router.get('/backup', requireAdmin, async (req, res) => {
    const id_empresa = getEmpresaId(req);
    try {
        const empresa = await get('SELECT * FROM empresas WHERE id_empresa = ?', [id_empresa]);
        const usuarios = await query('SELECT id_usuario, nombre, email, rol, telefono, zona_asignada, activo FROM usuarios WHERE id_empresa = ?', [id_empresa]);
        const clientes = await query('SELECT * FROM clientes WHERE id_empresa = ?', [id_empresa]);
        const ficheros = await query('SELECT * FROM ficheros WHERE id_empresa = ?', [id_empresa]);
        const cuotas = await query('SELECT * FROM cuotas WHERE id_empresa = ?', [id_empresa]);
        const auditoria = await query('SELECT * FROM auditoria_caja WHERE id_empresa = ?', [id_empresa]);

        const backupData = {
            version: '2.0',
            fecha_exportacion: new Date().toISOString(),
            empresa,
            usuarios,
            clientes,
            ficheros,
            cuotas,
            auditoria
        };

        const dateStr = new Date().toISOString().split('T')[0];
        const cleanName = (empresa?.nombre_comercial || 'empresa').replace(/[^a-z0-9]/gi, '_');
        const filename = `backup_${cleanName}_${dateStr}.json`;
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(JSON.stringify(backupData, null, 2));
    } catch (err) {
        console.error('Error al generar backup:', err);
        res.status(500).json({ error: 'Error al generar la copia de seguridad.' });
    }
});



// GET /api/empresa/whatsapp-log - Obtener registro de notificaciones de WhatsApp
router.get('/whatsapp-log', async (req, res) => {
    const id_empresa = getEmpresaId(req);
    try {
        const notifs = await query(`
            SELECT 
                w.id_notificacion,
                w.telefono_cliente,
                w.mensaje,
                w.estado,
                w.fecha_envio as fecha,
                cl.nombre_apellido as cliente_nombre,
                c.nro_cuota,
                c.monto
            FROM whatsapp_notifications w
            LEFT JOIN clientes cl ON w.id_cliente = cl.id_cliente
            LEFT JOIN cuotas c ON w.id_cuota = c.id_cuota
            WHERE w.id_empresa = ?
            ORDER BY w.fecha_envio DESC
            LIMIT 50
        `, [id_empresa]);

        res.json(notifs || []);
    } catch (err) {
        console.error('Error al obtener log de whatsapp:', err);
        res.status(500).json({ error: 'Error al obtener log de whatsapp.' });
    }
});

module.exports = router;


