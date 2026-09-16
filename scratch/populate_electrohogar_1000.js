const { query, run, get, isPostgres, pgPool } = require('../backend/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

async function populateElectroHogar() {
    console.log('🚀 Iniciando generación masiva para ElectroHogar (ID: 5)...');
    const EMPRESA_ID = 5;

    // 1. Asegurar que la empresa existe
    const passHash = await bcrypt.hash('admin123', 10);
    let emp = await get('SELECT * FROM empresas WHERE id_empresa = ?', [EMPRESA_ID]);
    if (!emp) {
        await run(`
            INSERT INTO empresas (id_empresa, nombre_comercial, cuit_rut, estado_suscripcion, logo_url, monto_abono_mensual)
            VALUES (?, 'ElectroHogar', '30-71829304-8', 'ACTIVA', 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=150', 250000)
        `, [EMPRESA_ID]);
    } else {
        await run(`UPDATE empresas SET nombre_comercial = 'ElectroHogar', estado_suscripcion = 'ACTIVA' WHERE id_empresa = ?`, [EMPRESA_ID]);
    }

    // 2. Limpiar datos antiguos de la empresa 5
    console.log('🧹 Limpiando registros antiguos de ElectroHogar...');
    await run('DELETE FROM cuotas WHERE id_empresa = ?', [EMPRESA_ID]);
    await run('DELETE FROM ficheros WHERE id_empresa = ?', [EMPRESA_ID]);
    await run('DELETE FROM clientes WHERE id_empresa = ?', [EMPRESA_ID]);
    await run('DELETE FROM whatsapp_notifications WHERE id_empresa = ?', [EMPRESA_ID]);
    await run('DELETE FROM auditoria_caja WHERE id_empresa = ?', [EMPRESA_ID]);
    await run('DELETE FROM usuarios WHERE id_empresa = ? AND rol != \'ADMIN_EMPRESA\'', [EMPRESA_ID]);

    // Asegurar Admin
    const adminUser = await get('SELECT * FROM usuarios WHERE id_empresa = ? AND rol = \'ADMIN_EMPRESA\'', [EMPRESA_ID]);
    if (!adminUser) {
        await run(`
            INSERT INTO usuarios (id_empresa, nombre, email, password_hash, rol, zona_asignada, activo)
            VALUES (?, 'Diego Diaz', 'admin@hogar.com', ?, 'ADMIN_EMPRESA', 'Oficina Central', 1)
        `, [EMPRESA_ID, passHash]);
    } else {
        await run(`UPDATE usuarios SET email = 'admin@hogar.com', password_hash = ? WHERE id_usuario = ?`, [passHash, adminUser.id_usuario]);
    }

    // 3. Crear 3 Vendedores
    console.log('👥 Creando 3 Vendedores...');
    const vendedoresList = [
        { nombre: 'Marcela Borengo', telefono: '+54 9 11 4059-8812', email: 'marcela@hogar.com' },
        { nombre: 'Gonzalo Rossi', telefono: '+54 9 11 5592-3310', email: 'gonzalo@hogar.com' },
        { nombre: 'Micaela Duarte', telefono: '+54 9 11 6720-4491', email: 'micaela@hogar.com' }
    ];
    for (const v of vendedoresList) {
        await run(`
            INSERT INTO usuarios (id_empresa, nombre, email, password_hash, rol, zona_asignada, activo, telefono)
            VALUES (?, ?, ?, ?, 'VENDEDOR', 'Salón de Ventas', 1, ?)
        `, [EMPRESA_ID, v.nombre, v.email, passHash, v.telefono]);
    }

    // 4. Crear 2 Cobradores (Motos)
    console.log('🛵 Creando 2 Cobradores de Calle (Motos)...');
    const cobradoresList = [
        { nombre: 'Hernán Madeira', email: 'hernan@hogar.com', zona: 'Zona Sur 1 (Lanús / Lomas / Avellaneda)', tel: '+54 9 11 5344-2237' },
        { nombre: 'Gustavo García', email: 'gustavo@hogar.com', zona: 'Zona Sur 2 (Quilmes / Berazategui / Varela)', tel: '+54 9 11 2253-3757' }
    ];
    const cobradorIds = [];
    for (const c of cobradoresList) {
        const res = await run(`
            INSERT INTO usuarios (id_empresa, nombre, email, password_hash, rol, zona_asignada, activo, telefono)
            VALUES (?, ?, ?, ?, 'COBRADOR', ?, 1, ?)
        `, [EMPRESA_ID, c.nombre, c.email, passHash, c.zona, c.tel]);
        cobradorIds.push({ id: res.lastID, nombre: c.nombre, zona: c.zona });
    }

    // 5. Crear 3 Encargados de Zona
    console.log('👤 Creando 3 Encargados de Zona...');
    const encargadosList = [
        { nombre: 'Natasha Filizzola', email: 'natasha@hogar.com', zona: 'Lanús y Lomas', tel: '+54 9 11 6852-4878' },
        { nombre: 'Luis Romero', email: 'luis@hogar.com', zona: 'Quilmes y Bernal', tel: '+54 9 11 3100-9838' },
        { nombre: 'Camila Rotela', email: 'camila@hogar.com', zona: 'Varela y Berazategui', tel: '+54 9 11 3458-2799' }
    ];
    for (const e of encargadosList) {
        await run(`
            INSERT INTO usuarios (id_empresa, nombre, email, password_hash, rol, zona_asignada, activo, telefono)
            VALUES (?, ?, ?, ?, 'ENCARGADO_ZONA', ?, 1, ?)
        `, [EMPRESA_ID, e.nombre, e.email, passHash, e.zona, e.tel]);
    }

    // 6. Generador de 1000 Clientes con datos y coordenadas realistas
    console.log('📍 Generando 1.000 clientes con geolocalización precisa...');

    const nombres = ['Juan', 'Carlos', 'María', 'Ana', 'Lucas', 'Lucía', 'Esteban', 'Silvia', 'Jorge', 'Claudia', 'Facundo', 'Florencia', 'Diego', 'Valeria', 'Matías', 'Camila', 'Martín', 'Romina', 'Gabriel', 'Patricia', 'Gonzalo', 'Gisela', 'Federico', 'Agustina', 'Rodrigo', 'Daniela', 'Mariano', 'Cecilia', 'Ezequiel', 'Noelia', 'Franco', 'Paula', 'Leandro', 'Mónica', 'Nahuel', 'Lorena', 'Nicolás', 'Andrea', 'Cristian', 'Beatriz'];
    const apellidos = ['González', 'Rodríguez', 'López', 'Martínez', 'Gómez', 'Díaz', 'Fernández', 'Pérez', 'Álvarez', 'Romero', 'Sosa', 'Torres', 'Ramírez', 'Flores', 'Benítez', 'Acosta', 'Medina', 'Herrera', 'Aguirre', 'Pereyra', 'Gutiérrez', 'Giménez', 'Molina', 'Silva', 'Castro', 'Rojas', 'Ortiz', 'Núñez', 'Luna', 'Juárez', 'Cabrera', 'Ríos', 'Morales', 'Godoy', 'Moreno', 'Ferreyra', 'Domínguez', 'Carrizo', 'Vega', 'Castillo'];

    const zonasGeo = [
        { barrio: 'Lanús Oeste', lat: -34.7065, lng: -58.3920, encargado: 'Natasha Filizzola', cobradorId: cobradorIds[0].id },
        { barrio: 'Lanús Este', lat: -34.7090, lng: -58.3800, encargado: 'Natasha Filizzola', cobradorId: cobradorIds[0].id },
        { barrio: 'Lomas de Zamora', lat: -34.7600, lng: -58.4000, encargado: 'Natasha Filizzola', cobradorId: cobradorIds[0].id },
        { barrio: 'Banfield', lat: -34.7430, lng: -58.3960, encargado: 'Natasha Filizzola', cobradorId: cobradorIds[0].id },
        { barrio: 'Temperley', lat: -34.7730, lng: -58.3980, encargado: 'Natasha Filizzola', cobradorId: cobradorIds[0].id },
        { barrio: 'Quilmes Centro', lat: -34.7200, lng: -58.2540, encargado: 'Luis Romero', cobradorId: cobradorIds[1].id },
        { barrio: 'Bernal', lat: -34.7080, lng: -58.2780, encargado: 'Luis Romero', cobradorId: cobradorIds[1].id },
        { barrio: 'Avellaneda Centro', lat: -34.6610, lng: -58.3650, encargado: 'Luis Romero', cobradorId: cobradorIds[0].id },
        { barrio: 'Wilde', lat: -34.6970, lng: -58.3200, encargado: 'Luis Romero', cobradorId: cobradorIds[1].id },
        { barrio: 'Don Bosco', lat: -34.7010, lng: -58.2900, encargado: 'Luis Romero', cobradorId: cobradorIds[1].id },
        { barrio: 'Berazategui', lat: -34.7640, lng: -58.2120, encargado: 'Camila Rotela', cobradorId: cobradorIds[1].id },
        { barrio: 'Florencio Varela', lat: -34.8000, lng: -58.2800, encargado: 'Camila Rotela', cobradorId: cobradorIds[1].id },
        { barrio: 'Claypole', lat: -34.8100, lng: -58.3400, encargado: 'Camila Rotela', cobradorId: cobradorIds[1].id },
        { barrio: 'San Francisco Solano', lat: -34.7800, lng: -58.3100, encargado: 'Camila Rotela', cobradorId: cobradorIds[1].id },
        { barrio: 'Bosques', lat: -34.8250, lng: -58.2350, encargado: 'Camila Rotela', cobradorId: cobradorIds[1].id }
    ];

    const calles = ['Av. Hipólito Yrigoyen', 'Av. San Martín', 'Av. Mitre', 'Calle 14', 'Av. 25 de Mayo', 'Belgrano', 'Rivadavia', 'Alsina', 'Boedo', 'Gorriti', 'Laprida', 'Sarmiento', 'Mitre', 'Pringles', 'Lavalle', 'Moreno', 'Chacabuco', 'Maipú', 'España', 'Colón', 'Guido', 'Garibaldi', 'Colombres', 'Alvear', 'Pellegrini'];

    const productosCatalogo = [
        { nombre: 'Smart TV 55" Samsung 4K UHD', cuotas: 12, valor: 85000, freq: 'MENSUAL' },
        { nombre: 'Smart TV 50" BGH Android TV', cuotas: 12, valor: 65000, freq: 'MENSUAL' },
        { nombre: 'Smart TV 43" Philips Full HD', cuotas: 12, valor: 48000, freq: 'MENSUAL' },
        { nombre: 'Heladera No Frost Gafa 380L Inox', cuotas: 18, valor: 62000, freq: 'MENSUAL' },
        { nombre: 'Heladera Drean Cíclica 277L Blanca', cuotas: 12, valor: 52000, freq: 'MENSUAL' },
        { nombre: 'Lavarropas Automático Drean 8kg', cuotas: 12, valor: 59000, freq: 'MENSUAL' },
        { nombre: 'Sommier 2 Plazas Piero Espuma Alta Densidad', cuotas: 12, valor: 45000, freq: 'MENSUAL' },
        { nombre: 'Cocina 4 Hornallas Florencia Multigas', cuotas: 10, valor: 42000, freq: 'MENSUAL' },
        { nombre: 'Celular Samsung Galaxy A55 5G 128GB', cuotas: 12, valor: 49000, freq: 'MENSUAL' },
        { nombre: 'Celular Motorola Moto G84 256GB', cuotas: 12, valor: 44000, freq: 'MENSUAL' },
        { nombre: 'Bicicleta Mountain Bike R29 Shimano 21V', cuotas: 10, valor: 38000, freq: 'MENSUAL' },
        { nombre: 'Aire Acondicionado Split BGH 3500W Frío/Calor', cuotas: 18, valor: 75000, freq: 'MENSUAL' },
        { nombre: 'Microondas BGH Quick Chef 20L Digital', cuotas: 6, valor: 28000, freq: 'MENSUAL' },
        { nombre: 'Juego de Comedor Mesa + 6 Sillas Chenille', cuotas: 12, valor: 56000, freq: 'MENSUAL' }
    ];

    const today = new Date();
    const todayStr = today.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });

    console.log('📦 Insertando clientes y ficheros en bloques...');

    for (let i = 1; i <= 1000; i++) {
        const nom = nombres[Math.floor(Math.random() * nombres.length)];
        const ape1 = apellidos[Math.floor(Math.random() * apellidos.length)];
        const ape2 = apellidos[Math.floor(Math.random() * apellidos.length)];
        const nombreCompleto = `${nom} ${ape1} ${ape2}`;
        const dni = (30000000 + i * 137 + Math.floor(Math.random() * 50)).toString();
        const tel = `+54 9 11 ${Math.floor(3000 + Math.random() * 6000)}-${Math.floor(1000 + Math.random() * 9000)}`;
        
        const zona = zonasGeo[(i - 1) % zonasGeo.length];
        const calle = calles[Math.floor(Math.random() * calles.length)];
        const altura = Math.floor(100 + Math.random() * 8500);
        const direccion = `${calle} ${altura}`;
        
        // Coordenadas con pequeña dispersión realista (+/- 800 metros)
        const lat = zona.lat + (Math.random() - 0.5) * 0.018;
        const lng = zona.lng + (Math.random() - 0.5) * 0.018;
        const qrToken = `qr-${crypto.randomBytes(8).toString('hex')}`;
        const calificacion = i % 15 === 0 ? 'REGULAR' : (i % 8 === 0 ? 'EXCELENTE' : 'BUENO');

        // Insertar Cliente
        const resCli = await run(`
            INSERT INTO clientes (
                id_empresa, nombre_apellido, dni, telefono, direccion, barrio, 
                latitud, longitud, qr_token, calificacion, nro_cliente_interno, encargado_zona
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            EMPRESA_ID, nombreCompleto, dni, tel, direccion, zona.barrio,
            lat, lng, qrToken, calificacion, i, zona.encargado
        ]);
        const idCliente = resCli.lastID;

        // Fichero(s) para este cliente
        const prod = productosCatalogo[i % productosCatalogo.length];
        const vendedor = vendedoresList[i % vendedoresList.length].nombre;
        const montoTotal = prod.cuotas * prod.valor;

        // Fecha de entrega entre 1 y 6 meses atrás
        const mesesAtras = (i % 5) + 1;
        const fechaEntrega = new Date(today.getFullYear(), today.getMonth() - mesesAtras, Math.min(25, (i % 28) + 1));
        const fechaEntregaStr = fechaEntrega.toLocaleDateString('en-CA');

        // Determinar asignación de ruta para hoy
        const asignadoHoy = (i % 12 === 0); // ~85 ficheros asignados a cobrador de calle hoy
        const idCobradorAsignado = asignadoHoy ? zona.cobradorId : null;
        const ordenVisita = asignadoHoy ? ((i % 40) + 1) : 0;

        const resFich = await run(`
            INSERT INTO ficheros (
                id_cliente, id_empresa, producto_nombre, cantidad_cuotas, valor_cuota,
                frecuencia_pago, monto_total, vendedor, encargado_zona, id_cobrador_asignado,
                fecha_entrega, estado, orden_visita, saldo_favor
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVO', ?, 0)
        `, [
            idCliente, EMPRESA_ID, prod.nombre, prod.cuotas, prod.valor,
            prod.freq, montoTotal, vendedor, zona.encargado, idCobradorAsignado,
            fechaEntregaStr, ordenVisita
        ]);
        const idFichero = resFich.lastID;

        // Generar Cuotas del 1 al N
        const cuotasPagadasHistoricas = Math.min(prod.cuotas - 1, mesesAtras);
        
        for (let c = 1; c <= prod.cuotas; c++) {
            const fechaVenc = new Date(fechaEntrega.getFullYear(), fechaEntrega.getMonth() + (c - 1), fechaEntrega.getDate());
            const fechaVencStr = fechaVenc.toLocaleDateString('en-CA');

            if (c <= cuotasPagadasHistoricas) {
                // Cuotas anteriores pagadas
                const fechaPagoStr = fechaVencStr;
                const medioPago = (c + i) % 3 === 0 ? 'TRANSFERENCIA' : 'EFECTIVO';
                const cobradorNombre = medioPago === 'TRANSFERENCIA' ? `Encargado: ${zona.encargado}` : (zona.cobradorId === cobradorIds[0].id ? 'Hernán Madeira' : 'Gustavo García');
                
                await run(`
                    INSERT INTO cuotas (
                        id_fichero, id_empresa, nro_cuota, monto, estado,
                        fecha_vencimiento, fecha_pago, medio_pago, nombre_cobrador, id_cobrador
                    ) VALUES (?, ?, ?, ?, 'PAGADO', ?, ?, ?, ?, ?)
                `, [
                    idFichero, EMPRESA_ID, c, prod.valor, fechaVencStr,
                    fechaPagoStr, medioPago, cobradorNombre, zona.cobradorId
                ]);
            } else if (c === cuotasPagadasHistoricas + 1 && (i % 25 === 0)) {
                // Cobrado HOY en calle o transferencia (para métricas en vivo)
                const medioPagoHoy = (i % 2 === 0) ? 'EFECTIVO' : 'TRANSFERENCIA';
                const cobradorNombreHoy = medioPagoHoy === 'TRANSFERENCIA' ? `Encargado: ${zona.encargado}` : (zona.cobradorId === cobradorIds[0].id ? 'Hernán Madeira' : 'Gustavo García');
                
                await run(`
                    INSERT INTO cuotas (
                        id_fichero, id_empresa, nro_cuota, monto, estado,
                        fecha_vencimiento, fecha_pago, medio_pago, nombre_cobrador, id_cobrador, lat_long_cobro
                    ) VALUES (?, ?, ?, ?, 'PAGADO', ?, ?, ?, ?, ?, ?)
                `, [
                    idFichero, EMPRESA_ID, c, prod.valor, fechaVencStr,
                    today.toISOString(), medioPagoHoy, cobradorNombreHoy, zona.cobradorId, `${lat.toFixed(6)}, ${lng.toFixed(6)}`
                ]);
            } else if (c === cuotasPagadasHistoricas + 1 && (i % 30 === 0)) {
                // Promesa de pago registrada
                const fechaPromesa = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3).toLocaleDateString('en-CA');
                await run(`
                    INSERT INTO cuotas (
                        id_fichero, id_empresa, nro_cuota, monto, estado,
                        fecha_vencimiento, motivo_no_cobro, promesa_pago_fecha, id_cobrador
                    ) VALUES (?, ?, ?, ?, 'NO_COBRADO', ?, 'Cliente ausente, reprograma visita', ?, ?)
                `, [
                    idFichero, EMPRESA_ID, c, prod.valor, fechaVencStr,
                    fechaPromesa, idCobradorAsignado
                ]);
            } else {
                // Cuotas pendientes normales
                await run(`
                    INSERT INTO cuotas (
                        id_fichero, id_empresa, nro_cuota, monto, estado,
                        fecha_vencimiento, id_cobrador
                    ) VALUES (?, ?, ?, ?, 'PENDIENTE', ?, ?)
                `, [
                    idFichero, EMPRESA_ID, c, prod.valor, fechaVencStr, idCobradorAsignado
                ]);
            }
        }

        if (i % 200 === 0) {
            console.log(`  -> ${i}/1000 clientes generados con éxito...`);
        }
    }

    console.log('✅ ¡Población de 1.000 clientes, ficheros y cuotas completada con éxito para ElectroHogar!');

    // Resumen final
    const totalCli = await get('SELECT COUNT(*) as t FROM clientes WHERE id_empresa = ?', [EMPRESA_ID]);
    const totalFic = await get('SELECT COUNT(*) as t FROM ficheros WHERE id_empresa = ?', [EMPRESA_ID]);
    const totalCuo = await get('SELECT COUNT(*) as t FROM cuotas WHERE id_empresa = ?', [EMPRESA_ID]);
    const totalPagHoy = await get('SELECT COUNT(*) as t, SUM(monto) as s FROM cuotas WHERE id_empresa = ? AND estado = \'PAGADO\' AND date(fecha_pago) = ?', [EMPRESA_ID, todayStr]);
    const cartera = await get('SELECT SUM(monto_total) as s FROM ficheros WHERE id_empresa = ? AND estado = \'ACTIVO\'', [EMPRESA_ID]);

    console.log('\n📊 RESUMEN DE ELECTROHOGAR:');
    console.log(`- Clientes: ${totalCli.t}`);
    console.log(`- Ficheros Activos: ${totalFic.t}`);
    console.log(`- Cuotas Totales: ${totalCuo.t}`);
    console.log(`- Cobrado Hoy: $${Number(totalPagHoy.s || 0).toLocaleString('es-AR')} (${totalPagHoy.t} cobros)`);
    console.log(`- Cartera Total Activa: $${Number(cartera.s || 0).toLocaleString('es-AR')}`);
    console.log(`- Vendedores: 3`);
    console.log(`- Cobradores: 2`);
    console.log(`- Encargados: 3`);
}

populateElectroHogar().catch(err => console.error('Error fatal:', err));
