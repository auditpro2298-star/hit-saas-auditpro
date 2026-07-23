const express = require('express');
const router = express.Router();
const { query, get } = require('../database');

// GET /api/cliente/cartilla/:token - Vista pública y de solo lectura de la Cartilla Virtual por escaneo QR o DNI
router.get('/cartilla/:token', async (req, res) => {
    const { token } = req.params;

    try {
        const cliente = await get('SELECT id_cliente, id_empresa, nombre_apellido, dni, telefono, direccion, barrio, qr_token, calificacion FROM clientes WHERE qr_token = ? OR dni = ?', [token, token]);
        if (!cliente) {
            return res.status(404).json({ error: 'Cartilla virtual no encontrada. Verifique el código QR o DNI.' });
        }

        const empresa = await get('SELECT nombre_comercial, logo_url FROM empresas WHERE id_empresa = ?', [cliente.id_empresa]);
        const ficheros = await query('SELECT id_fichero, producto_nombre, cantidad_cuotas, valor_cuota, monto_total, fecha_entrega, estado FROM ficheros WHERE id_cliente = ? ORDER BY id_fichero DESC', [cliente.id_cliente]);

        let cartillas = [];
        let totalSaldado = 0;
        let totalPendiente = 0;

        for (let f of ficheros) {
            const cuotas = await query('SELECT id_cuota, nro_cuota, monto, estado, fecha_vencimiento, fecha_pago, medio_pago FROM cuotas WHERE id_fichero = ? ORDER BY nro_cuota ASC', [f.id_fichero]);
            
            const pagadas = cuotas.filter(q => q.estado === 'PAGADO');
            const pendientes = cuotas.filter(q => q.estado === 'PENDIENTE');
            
            totalSaldado += pagadas.reduce((sum, q) => sum + q.monto, 0);
            totalPendiente += pendientes.reduce((sum, q) => sum + q.monto, 0);

            cartillas.push({
                fichero: f,
                cuotas: cuotas,
                resumen_fichero: {
                    pagadas_count: pagadas.length,
                    pendientes_count: pendientes.length,
                    porcentaje_progreso: Math.round((pagadas.length / f.cantidad_cuotas) * 100) || 0
                }
            });
        }

        res.json({
            success: true,
            cliente: {
                nombre_apellido: cliente.nombre_apellido,
                dni: cliente.dni,
                telefono: cliente.telefono,
                direccion: cliente.direccion,
                barrio: cliente.barrio,
                qr_token: cliente.qr_token,
                calificacion: cliente.calificacion
            },
            empresa: empresa || { nombre_comercial: 'Casa de Cuotas' },
            resumen_global: {
                total_saldado: totalSaldado,
                total_pendiente: totalPendiente,
                ficheros_activos: ficheros.filter(f => f.estado === 'ACTIVO').length
            },
            cartillas
        });
    } catch (err) {
        console.error('Error obteniendo cartilla del cliente:', err);
        res.status(500).json({ error: 'Error cargando cartilla virtual.' });
    }
});

module.exports = router;
