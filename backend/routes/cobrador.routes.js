const express = require('express');
const router = express.Router();
const { query, run, get } = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Los endpoints del cobrador requieren autenticación y rol COBRADOR (o Admin para pruebas)
router.use(authenticateToken, requireRole(['COBRADOR', 'ADMIN_EMPRESA', 'SUPER_ADMIN']));

// GET /api/cobrador/hoja-de-ruta - Sincronizar hoja de ruta del día y clientes asignados
router.get('/hoja-de-ruta', async (req, res) => {
    const id_usuario = req.user.id_usuario;
    const id_empresa = req.user.id_empresa;
    const userRole = req.user.rol;
    const userZone = (req.user.zona_asignada || '').toLowerCase().trim();

    // Lógica para reiniciar las asignaciones día a día de forma aislada por empresa
    try {
        const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
        const emp = await get("SELECT dia_ultimo_reset FROM empresas WHERE id_empresa = ?", [id_empresa]);
        
        if (emp && emp.dia_ultimo_reset !== todayStr) {
            console.log(`🌅 ¡Es un nuevo día! Reiniciando asignaciones de ruta para cobradores de la empresa ID ${id_empresa} (${todayStr})...`);
            // Limpiamos la asignación de cobradores de forma aislada por empresa
            await run('UPDATE ficheros SET id_cobrador_asignado = NULL WHERE id_empresa = ?', [id_empresa]);
            // Guardamos el nuevo día en la base de datos
            await run('UPDATE empresas SET dia_ultimo_reset = ? WHERE id_empresa = ?', [todayStr, id_empresa]);
            console.log(`✅ Asignaciones reiniciadas con éxito para la empresa ID ${id_empresa}.`);
        }
    } catch (resetErr) {
        console.error('Error al reiniciar asignaciones de ruta diarias:', resetErr);
    }

    try {
        let sql = `
            SELECT f.id_fichero, f.producto_nombre, f.valor_cuota, f.cantidad_cuotas, f.monto_total, f.estado as fichero_estado,
                   c.id_cliente, c.nombre_apellido, c.direccion, COALESCE(c.barrio, 'General') as barrio, c.piso_dpto, c.referencia_domicilio, c.telefono, c.latitud, c.longitud, c.qr_token,
                   (SELECT COUNT(*) FROM cuotas q WHERE q.id_fichero = f.id_fichero AND q.estado = 'PAGADO') as cuotas_saldadas,
                   (SELECT MIN(nro_cuota) FROM cuotas q WHERE q.id_fichero = f.id_fichero AND q.estado = 'PENDIENTE') as proxima_cuota_nro,
                   (SELECT MIN(fecha_vencimiento) FROM cuotas q WHERE q.id_fichero = f.id_fichero AND q.estado = 'PENDIENTE') as proximo_vencimiento,
                   (SELECT COUNT(*) FROM cuotas q WHERE q.id_fichero = f.id_fichero AND q.estado = 'PAGADO' AND q.fecha_pago IS NOT NULL AND date(q.fecha_pago) = date('now', 'localtime')) as cobrado_hoy,
                   (SELECT COUNT(*) FROM cuotas q WHERE q.id_fichero = f.id_fichero AND q.estado = 'NO_COBRADO' AND ((q.fecha_pago IS NOT NULL AND date(q.fecha_pago) = date('now', 'localtime')) OR (q.promesa_pago_fecha IS NOT NULL AND date(q.promesa_pago_fecha) = date('now', 'localtime')))) as no_cobrado_hoy
            FROM ficheros f
            JOIN clientes c ON f.id_cliente = c.id_cliente
            WHERE f.id_empresa = ? AND f.estado = 'ACTIVO'
        `;
        const params = [id_empresa];

        if (userRole === 'COBRADOR') {
            sql += ` AND f.id_cobrador_asignado = ?`;
            params.push(id_usuario);
        }

        sql += ` ORDER BY f.orden_visita ASC, c.barrio ASC, c.direccion ASC`;

        const ruta = await query(sql, params);
        res.json(ruta);
    } catch (err) {
        console.error('Error sincronizando hoja de ruta:', err);
        res.status(500).json({ error: 'Error cargando hoja de ruta.', details: err.message });
    }
});

// GET /api/cobrador/fichero-qr/:token - Escáner de QR: Levantar de inmediato el fichero y su planilla de casilleros
router.get('/fichero-qr/:token', async (req, res) => {
    const { token } = req.params;
    const id_empresa = req.user.id_empresa;

    try {
        const cliente = await get('SELECT * FROM clientes WHERE qr_token = ? AND id_empresa = ?', [token, id_empresa]);
        if (!cliente) {
            return res.status(404).json({ error: 'Código QR no reconocido para esta empresa o cliente inexistente.' });
        }

        const ficheros = await query('SELECT * FROM ficheros WHERE id_cliente = ? ORDER BY id_fichero DESC', [cliente.id_cliente]);
        
        let cuotasPorFichero = {};
        for (let f of ficheros) {
            const cuotas = await query('SELECT * FROM cuotas WHERE id_fichero = ? ORDER BY nro_cuota ASC', [f.id_fichero]);
            cuotasPorFichero[f.id_fichero] = cuotas;
        }

        res.json({
            success: true,
            cliente,
            ficheros,
            cuotas: cuotasPorFichero
        });
    } catch (err) {
        console.error('Error procesando escaneo de QR:', err);
        res.status(500).json({ error: 'Error procesando código QR.' });
    }
});

// POST /api/cobrador/buscar-dni - Búsqueda manual por DNI ante pérdida o robo del cartoncito QR (bajo registro de auditoría)
router.post('/buscar-dni', async (req, res) => {
    const { dni } = req.body;
    const id_empresa = req.user.id_empresa;
    const id_cobrador = req.user.id_usuario;

    if (!dni) {
        return res.status(400).json({ error: 'Debe ingresar el DNI del cliente.' });
    }

    try {
        const cleanDni = dni.toString().trim().replace(/[^0-9]/g, '');
        const cliente = await get('SELECT * FROM clientes WHERE dni = ? AND id_empresa = ?', [cleanDni, id_empresa]);
        if (!cliente) {
            return res.status(404).json({ error: `No se encontró ningún cliente con el DNI "${cleanDni}" en esta empresa.` });
        }

        const ficheros = await query('SELECT * FROM ficheros WHERE id_cliente = ? ORDER BY id_fichero DESC', [cliente.id_cliente]);
        
        let cuotasPorFichero = {};
        for (let f of ficheros) {
            const cuotas = await query('SELECT * FROM cuotas WHERE id_fichero = ? ORDER BY nro_cuota ASC', [f.id_fichero]);
            cuotasPorFichero[f.id_fichero] = cuotas;
        }

        console.log(`⚠️ ALERTA AUDITORÍA: El cobrador ID #${id_cobrador} buscó al cliente "${cliente.nombre_apellido}" por DNI (${cleanDni}) SIN ESCANEAR QR.`);

        res.json({
            success: true,
            cliente,
            ficheros,
            cuotas: cuotasPorFichero,
            warning: '⚠️ Búsqueda manual por DNI registrada en auditoría del sistema (Pérdida de QR).'
        });
    } catch (err) {
        console.error('Error en búsqueda por DNI:', err);
        res.status(500).json({ error: 'Error al buscar cliente por DNI.' });
    }
});

// POST /api/cobrador/cobrar - Registro en calle sobre un casillero (cuota)
router.post('/cobrar', async (req, res) => {
    const { id_cuota, medio_pago, comprobante_img_url, motivo_no_cobro, promesa_pago_fecha, lat_long_cobro, monto_cobrado, notas } = req.body;
    const id_cobrador = req.user.id_usuario;
    const nombre_cobrador = req.user.nombre || 'Cobrador Registrado';
    const id_empresa = req.user.id_empresa;

    if (!id_cuota) {
        return res.status(400).json({ error: 'Falta especificar el casillero / ID de cuota a procesar.' });
    }

    try {
        const cuota = await get('SELECT * FROM cuotas WHERE id_cuota = ? AND id_empresa = ?', [id_cuota, id_empresa]);
        if (!cuota) {
            return res.status(404).json({ error: 'Cuota no encontrada.' });
        }

        // Si se reporta pago (Efectivo o Transferencia)
        if (medio_pago === 'EFECTIVO' || medio_pago === 'TRANSFERENCIA') {
            if (medio_pago === 'TRANSFERENCIA' && !comprobante_img_url) {
                return res.status(400).json({ error: 'Para pagos con transferencia es obligatorio adjuntar foto o URL del comprobante bancario.' });
            }

            // CONTROL DE SEGURIDAD: Prevenir cobros de cuotas adelantadas sin autorización previa del Admin
            const proximaPendiente = await get("SELECT MIN(nro_cuota) as min_nro FROM cuotas WHERE id_fichero = ? AND estado = 'PENDIENTE'", [cuota.id_fichero]);
            if (proximaPendiente && proximaPendiente.min_nro !== null && cuota.nro_cuota > proximaPendiente.min_nro && !req.body.autorizacion_admin_codigo) {
                return res.status(403).json({
                    error: 'REQUIERE_AUTORIZACION_ADELANTO',
                    message: `⚠️ CONTROL DE SEGURIDAD: La cuota #${cuota.nro_cuota} es un PAGO ADELANTADO (la cuota pendiente actual es la #${proximaPendiente.min_nro}). Para evitar maniobras no autorizadas, el cobrador debe solicitar permiso previo al Administrador de la Empresa.`
                });
            }

            const cobrado = parseFloat(monto_cobrado !== undefined && monto_cobrado !== null ? monto_cobrado : cuota.monto);
            const ficheroRecord = await get('SELECT * FROM ficheros WHERE id_fichero = ?', [cuota.id_fichero]);
            const saldoFavorActual = ficheroRecord ? parseFloat(ficheroRecord.saldo_favor || 0) : 0;
            const totalCredited = cobrado + saldoFavorActual;
            const nuevoSaldoFavor = totalCredited - cuota.monto;

            let finalNotas = notas || '';
            if (saldoFavorActual > 0) {
                finalNotas = (finalNotas ? finalNotas + ' ' : '') + `[DESCUENTO_APLICADO:${saldoFavorActual}]`;
            } else if (saldoFavorActual < 0) {
                finalNotas = (finalNotas ? finalNotas + ' ' : '') + `[DEUDA_CUBIERTA:${Math.abs(saldoFavorActual)}]`;
            }
            if (nuevoSaldoFavor > 0) {
                finalNotas = (finalNotas ? finalNotas + ' ' : '') + `[SALDO_A_FAVOR_GENERADO:${nuevoSaldoFavor}]`;
            } else if (nuevoSaldoFavor < 0) {
                finalNotas = (finalNotas ? finalNotas + ' ' : '') + `[NUEVA_DEUDA_GENERADA:${Math.abs(nuevoSaldoFavor)}]`;
            }

            const localDateTime = new Date().toLocaleString('sv', { timeZone: 'America/Argentina/Buenos_Aires' });

            // Corrección Crítica 3: Guardar el ID y NOMBRE histórico del cobrador que procesa este pago en este instante
            await run(`
                UPDATE cuotas SET 
                    estado = 'PAGADO',
                    fecha_pago = ?,
                    medio_pago = ?,
                    comprobante_img_url = ?,
                    id_cobrador = ?,
                    nombre_cobrador = ?,
                    lat_long_cobro = ?,
                    notas = ?,
                    monto = ?
                WHERE id_cuota = ? AND id_empresa = ?
            `, [localDateTime, medio_pago, comprobante_img_url || null, id_cobrador, nombre_cobrador, lat_long_cobro || null, finalNotas || null, cobrado, id_cuota, id_empresa]);

            await run("UPDATE ficheros SET saldo_favor = ? WHERE id_fichero = ?", [nuevoSaldoFavor, cuota.id_fichero]);

            // Verificar si el fichero completó todas sus cuotas para pasarlo a FINALIZADO
            const pendientes = await get("SELECT COUNT(*) as restantes FROM cuotas WHERE id_fichero = ? AND estado = 'PENDIENTE'", [cuota.id_fichero]);
            if (pendientes && pendientes.restantes === 0) {
                await run("UPDATE ficheros SET estado = 'FINALIZADO' WHERE id_fichero = ?", [cuota.id_fichero]);
            }

            // Función 1: Alerta Automática por WhatsApp y cálculo de saldo
            const fichero = await get('SELECT f.*, c.id_cliente, c.nombre_apellido, c.telefono, c.qr_token FROM ficheros f JOIN clientes c ON f.id_cliente = c.id_cliente WHERE f.id_fichero = ?', [cuota.id_fichero]);
            const pagadas = await get("SELECT IFNULL(SUM(monto), 0) as total_pagado FROM cuotas WHERE id_fichero = ? AND estado = 'PAGADO'", [cuota.id_fichero]);
            const saldoRestante = Math.max(0, (fichero ? fichero.monto_total : cuota.monto) - (pagadas ? pagadas.total_pagado : 0));
            
            let messageText = `Cobro de $${cobrado.toLocaleString('es-AR')} registrado exitosamente en ${medio_pago}.`;
            if (nuevoSaldoFavor > 0) {
                messageText += ` (Generó $${nuevoSaldoFavor.toLocaleString('es-AR')} de saldo a favor)`;
            } else if (nuevoSaldoFavor < 0) {
                messageText += ` (Se aplicó un descuento de $${Math.abs(nuevoSaldoFavor).toLocaleString('es-AR')} de saldo a favor previo)`;
            }

            const whatsappMsg = `Hola ${fichero?.nombre_apellido || 'Cliente'}, HIT detectó tu pago de la cuota #${cuota.nro_cuota} por $${cobrado} en ${medio_pago}. Saldo restante: $${saldoRestante.toLocaleString('es-AR')}. Mirá tu cartilla acá: http://localhost:3000/?qr_cartilla=${fichero?.qr_token || 'TOKEN'}`;
            
            if (fichero) {
                await run(`INSERT INTO whatsapp_notifications (id_empresa, id_cliente, id_cuota, telefono_cliente, mensaje, estado) VALUES (?, ?, ?, ?, ?, 'ENVIADO')`,
                    [id_empresa, fichero.id_cliente, id_cuota, fichero.telefono || 'Sin teléfono', whatsappMsg]);
            }

            return res.json({ 
                success: true, 
                message: messageText,
                whatsapp_message: whatsappMsg,
                saldo_restante: saldoRestante
            });
        }
        // Si se reporta No Cobrado (Función 2: Promesa de pago agendada)
        else if (motivo_no_cobro) {
            await run(`
                UPDATE cuotas SET 
                    estado = 'NO_COBRADO',
                    fecha_pago = datetime('now', 'localtime'),
                    motivo_no_cobro = ?,
                    promesa_pago_fecha = ?,
                    id_cobrador = ?,
                    nombre_cobrador = ?,
                    lat_long_cobro = ?,
                    notas = ?
                WHERE id_cuota = ? AND id_empresa = ?
            `, [motivo_no_cobro, promesa_pago_fecha || null, id_cobrador, nombre_cobrador, lat_long_cobro || null, notas || null, id_cuota, id_empresa]);

            return res.json({ 
                success: true, 
                message: promesa_pago_fecha 
                    ? `Visita no cobrada (${motivo_no_cobro}). Promesa de pago agendada para: ${promesa_pago_fecha}.` 
                    : `Asentada visita no cobrada (${motivo_no_cobro}).` 
            });
        } else {
            return res.status(400).json({ error: 'Especifique un medio de pago válido o el motivo del no cobro.' });
        }
    } catch (err) {
        console.error('Error registrando cobro:', err);
        res.status(500).json({ error: 'Error al procesar el cobro en calle.' });
    }
});

// POST /api/cobrador/sync-offline - Sincronización masiva al recuperar conexión (Función 3)
router.post('/sync-offline', async (req, res) => {
    const { queue } = req.body;
    const id_cobrador = req.user.id_usuario;
    const nombre_cobrador = req.user.nombre || 'Cobrador Offline';
    const id_empresa = req.user.id_empresa;

    if (!Array.isArray(queue) || queue.length === 0) {
        return res.json({ success: true, synced: 0, message: 'La cola de sincronización estaba vacía.' });
    }

    let syncedCount = 0;
    let notificacionesEnviadas = [];

    try {
        for (const item of queue) {
            const cuota = await get('SELECT * FROM cuotas WHERE id_cuota = ? AND id_empresa = ?', [item.id_cuota, id_empresa]);
            if (!cuota || cuota.estado === 'PAGADO') continue; // Si ya fue pagado, omitir

            if (item.medio_pago === 'EFECTIVO' || item.medio_pago === 'TRANSFERENCIA') {
                const cobrado = parseFloat(item.monto_cobrado !== undefined && item.monto_cobrado !== null ? item.monto_cobrado : cuota.monto);
                const ficheroRecord = await get('SELECT * FROM ficheros WHERE id_fichero = ?', [cuota.id_fichero]);
                const saldoFavorActual = ficheroRecord ? parseFloat(ficheroRecord.saldo_favor || 0) : 0;
                const totalCredited = cobrado + saldoFavorActual;
                const nuevoSaldoFavor = totalCredited - cuota.monto;

                let finalNotas = item.notas || '';
                if (saldoFavorActual > 0) {
                    finalNotas = (finalNotas ? finalNotas + ' ' : '') + `[DESCUENTO_APLICADO:${saldoFavorActual}]`;
                } else if (saldoFavorActual < 0) {
                    finalNotas = (finalNotas ? finalNotas + ' ' : '') + `[DEUDA_CUBIERTA:${Math.abs(saldoFavorActual)}]`;
                }
                if (nuevoSaldoFavor > 0) {
                    finalNotas = (finalNotas ? finalNotas + ' ' : '') + `[SALDO_A_FAVOR_GENERADO:${nuevoSaldoFavor}]`;
                } else if (nuevoSaldoFavor < 0) {
                    finalNotas = (finalNotas ? finalNotas + ' ' : '') + `[NUEVA_DEUDA_GENERADA:${Math.abs(nuevoSaldoFavor)}]`;
                }

                const localDateTime = new Date().toLocaleString('sv', { timeZone: 'America/Argentina/Buenos_Aires' });

                await run(`
                    UPDATE cuotas SET 
                        estado = 'PAGADO',
                        fecha_pago = COALESCE(?, ?),
                        medio_pago = ?,
                        comprobante_img_url = ?,
                        id_cobrador = ?,
                        nombre_cobrador = ?,
                        lat_long_cobro = ?,
                        notas = ?,
                        monto = ?
                    WHERE id_cuota = ? AND id_empresa = ?
                `, [item.fecha_pago || null, localDateTime, item.medio_pago, item.comprobante_img_url || null, id_cobrador, nombre_cobrador, item.lat_long_cobro || null, finalNotas || 'Sincronizado desde cola offline', cobrado, item.id_cuota, id_empresa]);

                await run("UPDATE ficheros SET saldo_favor = ? WHERE id_fichero = ?", [nuevoSaldoFavor, cuota.id_fichero]);

                // Generar WhatsApp de sincronización
                const fichero = await get('SELECT f.*, c.id_cliente, c.nombre_apellido, c.telefono, c.qr_token FROM ficheros f JOIN clientes c ON f.id_cliente = c.id_cliente WHERE f.id_fichero = ?', [cuota.id_fichero]);
                const pagadas = await get("SELECT IFNULL(SUM(monto), 0) as total_pagado FROM cuotas WHERE id_fichero = ? AND estado = 'PAGADO'", [cuota.id_fichero]);
                const saldoRestante = Math.max(0, (fichero ? fichero.monto_total : cuota.monto) - (pagadas ? pagadas.total_pagado : 0));
                
                if (fichero) {
                    const whatsappMsg = `Hola ${fichero.nombre_apellido}, HIT sincronizó tu pago de la cuota #${cuota.nro_cuota} por $${cobrado} (${item.medio_pago}). Saldo restante: $${saldoRestante.toLocaleString('es-AR')}. Cartilla: http://localhost:3000/?qr_cartilla=${fichero.qr_token}`;
                    await run(`INSERT INTO whatsapp_notifications (id_empresa, id_cliente, id_cuota, telefono_cliente, mensaje, estado) VALUES (?, ?, ?, ?, ?, 'ENVIADO')`,
                        [id_empresa, fichero.id_cliente, item.id_cuota, fichero.telefono || 'Sin teléfono', whatsappMsg]);
                    notificacionesEnviadas.push({ cliente: fichero.nombre_apellido, mensaje: whatsappMsg });
                }
                syncedCount++;
            } else if (item.motivo_no_cobro) {
                await run(`
                    UPDATE cuotas SET 
                        estado = 'NO_COBRADO',
                        fecha_pago = COALESCE(?, datetime('now', 'localtime')),
                        motivo_no_cobro = ?,
                        promesa_pago_fecha = ?,
                        id_cobrador = ?,
                        nombre_cobrador = ?,
                        lat_long_cobro = ?,
                        notas = ?
                    WHERE id_cuota = ? AND id_empresa = ?
                `, [item.fecha_pago || null, item.motivo_no_cobro, item.promesa_pago_fecha || null, id_cobrador, nombre_cobrador, item.lat_long_cobro || null, item.notas || 'Sincronizado desde cola offline', item.id_cuota, id_empresa]);
                syncedCount++;
            }
        }

        res.json({ success: true, synced: syncedCount, notificaciones: notificacionesEnviadas, message: `☁️ ¡Sincronización Offline exitosa! ${syncedCount} cobros/visitas asentados en el servidor y notificados por WhatsApp.` });
    } catch (err) {
        console.error('Error en sync offline:', err);
        res.status(500).json({ error: 'Error sincronizando la cola de cobros.' });
    }
});

// GET /api/cobrador/resumen-diario - Resumen de recaudación en calle del día
router.get('/resumen-diario', async (req, res) => {
    const id_cobrador = req.user.id_usuario;
    const id_empresa = req.user.id_empresa;

    try {
        const resumen = await get(`
            SELECT SUM(CASE WHEN medio_pago = 'EFECTIVO' AND estado = 'PAGADO' THEN monto ELSE 0 END) as efectivo_en_bolsillo,
                   SUM(CASE WHEN medio_pago = 'TRANSFERENCIA' AND estado = 'PAGADO' THEN monto ELSE 0 END) as transferencias_cargadas,
                   COUNT(CASE WHEN estado = 'PAGADO' THEN 1 END) as cuotas_cobradas,
                   COUNT(CASE WHEN estado = 'NO_COBRADO' THEN 1 END) as visitas_no_cobradas
            FROM cuotas
            WHERE id_empresa = ? AND id_cobrador = ? AND date(fecha_pago) = date('now', 'localtime')
        `, [id_empresa, id_cobrador]);

        res.json(resumen || { efectivo_en_bolsillo: 0, transferencias_cargadas: 0, cuotas_cobradas: 0, visitas_no_cobradas: 0 });
    } catch (err) {
        console.error('Error obteniendo resumen del cobrador:', err);
        res.status(500).json({ error: 'Error calculando caja del día.' });
    }
});

module.exports = router;
