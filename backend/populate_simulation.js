const { run, query, get, resequenceAndReset } = require('./database');
const crypto = require('crypto');

// Nombres y apellidos realistas de Argentina
const nombresOriginales = [
    "Juan Maidana", "Estela Giménez", "Ricardo Darín", "Mariano Martínez", "Cecilia Roth", 
    "Guillermo Francella", "Adrián Suar", "Natalia Oreiro", "Pablo Echarri", "Diego Maradona",
    "Lionel Messi", "Gabriela Sabatini", "Facundo Campazzo", "Gustavo Cerati", "Luis Alberto Spinetta",
    "Charly García", "Fito Páez", "Patricia Sosa", "Sandra Mihanovich", "Valeria Lynch",
    "Ricardo Mollo", "Andrés Calamaro", "Mercedes Sosa", "Atahualpa Yupanqui", "Jorge Cafrune",
    "Luciano Pereyra", "Soledad Pastorutti", "Abel Pintos", "Axel Fernando", "Diego Torres",
    "Sandro de América", "Leo Dan", "Palito Ortega", "Cacho Castaña", "Sergio Denis",
    "Karina Princesa", "Gilda Gómez", "Rodrigo Bueno", "Walter Olmos", "Daniel Agostini",
    "Antonio Ríos", "Gladys Tucumana", "Marcelo Tinelli", "Mirtha Legrand", "Susana Giménez",
    "Moria Casán", "Beto Casella", "Guido Kaczka", "Alejandro Fantino", "Jorge Lanata",
    "Eduardo Feinmann", "Jonatan Viale", "Luis Novaresio", "Rodolfo Barili", "Cristina Pérez",
    "Marley Wiebe", "Lizy Tagliani", "Santiago del Moro", "Darío Barassi", "Iván de Pineda"
];

// Direcciones y barrios de cobertura
const calles = [
    "Av. Rivadavia", "Av. Directorio", "Av. San Martín", "Av. Nazca", "Calle 14", "Calle 8",
    "Calle Mitre", "Calle Belgrano", "Calle Sarmiento", "Calle Las Heras", "Av. Alvear",
    "Av. Pueyrredón", "Av. Jujuy", "Av. Boedo", "Av. La Plata", "Av. Acoyte", "Calle Rojas",
    "Calle Yerbal", "Calle Ramón Falcón", "Calle Yerbal", "Av. Eva Perón", "Calle Carabobo"
];

const barrios = [
    { nombre: "Flores", lat: -34.6300, lng: -58.4650, cobrador_id: 3, encargado: "Coco Encargado" },
    { nombre: "Caballito", lat: -34.6180, lng: -58.4420, cobrador_id: 3, encargado: "Coco Encargado" },
    { nombre: "Avellaneda", lat: -34.6620, lng: -58.3640, cobrador_id: 4, encargado: "General" },
    { nombre: "Berazategui", lat: -34.7630, lng: -58.2120, cobrador_id: 11, encargado: "Coco Encargado" },
    { nombre: "Quilmes", lat: -34.7240, lng: -58.2520, cobrador_id: 11, encargado: "Coco Encargado" }
];

const productos = [
    { nombre: "Smart TV 55 Samsung", cuotas: 16, valor: 22000, frecuencia: "SEMANAL" },
    { nombre: "Celular Motorola G54", cuotas: 10, valor: 15000, frecuencia: "SEMANAL" },
    { nombre: "Heladera Patrick 300L", cuotas: 34, valor: 18000, frecuencia: "SEMANAL" },
    { nombre: "Lavarropas Drean Next", cuotas: 30, valor: 14000, frecuencia: "SEMANAL" },
    { nombre: "Microondas BGH Quick Chef", cuotas: 12, valor: 9000, frecuencia: "SEMANAL" },
    { nombre: "Colchón Piero 2 Plazas", cuotas: 16, valor: 15000, frecuencia: "SEMANAL" },
    { nombre: "Bicicleta Rodado 29", cuotas: 24, valor: 12000, frecuencia: "SEMANAL" },
    { nombre: "Smart TV 43 Philips", cuotas: 16, valor: 16000, frecuencia: "SEMANAL" },
    { nombre: "Ventilador de Pie Liliana", cuotas: 10, valor: 6000, frecuencia: "SEMANAL" },
    { nombre: "Freidora de Aire Moulinex", cuotas: 12, valor: 11000, frecuencia: "SEMANAL" }
];

const calificaciones = ["EXCELENTE", "BUENO", "REGULAR", "MOROSO"];
const motivosNoCobro = ["AUSENTE", "DOMICILIO_CERRADO", "PASA_MAÑANA", "SIN_DINERO"];
const mediosPago = ["EFECTIVO", "TRANSFERENCIA"];

// Mezclar array para aleatoriedad
function shuffle(array) {
    let currentIndex = array.length, randomIndex;
    const newArr = [...array];
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [newArr[currentIndex], newArr[randomIndex]] = [newArr[randomIndex], newArr[currentIndex]];
    }
    return newArr;
}

/**
 * Genera y guarda clientes y ficheros en la base de datos
 * @param {number} cantidad Número de clientes a crear
 * @param {number} id_empresa ID de la empresa (por defecto 1 - Electro Genesis)
 */
async function generateSimulation(cantidad = 20, id_empresa = 1) {
    console.log(`🚀 Iniciando generación de ${cantidad} clientes simulados para empresa ID ${id_empresa}...`);
    
    // Verificar que la empresa exista
    const empresa = await get("SELECT nombre_comercial FROM empresas WHERE id_empresa = ?", [id_empresa]);
    if (!empresa) {
        throw new Error(`La empresa con ID ${id_empresa} no existe en la base de datos.`);
    }
    console.log(`🏢 Empresa destino: ${empresa.nombre_comercial}`);

    // Obtener cobradores registrados para reasegurar IDs de cobrador existentes
    const cobradoresRegistrados = await query("SELECT id_usuario, nombre FROM usuarios WHERE id_empresa = ? AND rol = 'COBRADOR'", [id_empresa]);
    const cobradoresIds = cobradoresRegistrados.map(c => c.id_usuario);
    
    if (cobradoresIds.length === 0) {
        console.warn("⚠️ Advertencia: No se encontraron cobradores para esta empresa. Se usarán IDs genéricos o asignados por zona.");
    }

    const nombresMezclados = shuffle(nombresOriginales);
    let creados = 0;

    for (let i = 0; i < cantidad; i++) {
        const nombre = nombresMezclados[i % nombresMezclados.length] + (Math.floor(i / nombresMezclados.length) > 0 ? ` ${Math.floor(i / nombresMezclados.length) + 1}` : "");
        const dni = (25000000 + Math.floor(Math.random() * 20000000)).toString();
        const telefono = `+54 9 11 ${1000 + Math.floor(Math.random() * 9000)}-${1000 + Math.floor(Math.random() * 9000)}`;
        
        const calle = calles[Math.floor(Math.random() * calles.length)];
        const altura = 100 + Math.floor(Math.random() * 4500);
        const direccion = `${calle} ${altura}`;
        
        const barrioObj = barrios[Math.floor(Math.random() * barrios.length)];
        const barrio = barrioObj.nombre;
        
        // Coordenadas con pequeña dispersión alrededor del centro del barrio
        const lat = barrioObj.lat + (Math.random() - 0.5) * 0.015;
        const lng = barrioObj.lng + (Math.random() - 0.5) * 0.015;
        
        const piso_dpto = Math.random() > 0.6 ? `${Math.floor(Math.random() * 10) + 1} ${String.fromCharCode(65 + Math.floor(Math.random() * 6))}` : "PB";
        const referencia = Math.random() > 0.4 ? `Frente a ${Math.random() > 0.5 ? 'la plaza' : 'un portón verde'} / Casa color ${['azul', 'blanca', 'ladrillo', 'crema'][Math.floor(Math.random() * 4)]}` : "";
        
        const qr_token = crypto.randomUUID ? crypto.randomUUID() : `uuid-sim-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
        
        // Calificación aleatoria ponderada (más Buenos y Excelentes que Morosos)
        const randCalif = Math.random();
        let calificacion = "BUENO";
        if (randCalif < 0.2) calificacion = "EXCELENTE";
        else if (randCalif > 0.85) calificacion = "MOROSO";
        else if (randCalif > 0.7) calificacion = "REGULAR";

        const cobradorAsignadoId = cobradoresIds.includes(barrioObj.cobrador_id) ? barrioObj.cobrador_id : (cobradoresIds[0] || null);

        // 1. Insertar Cliente
        const resultCli = await run(
            "INSERT INTO clientes (id_empresa, nombre_apellido, dni, telefono, direccion, barrio, piso_dpto, referencia_domicilio, latitud, longitud, qr_token, calificacion, encargado_zona) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [id_empresa, nombre, dni, telefono, direccion, barrio, piso_dpto, referencia, lat, lng, qr_token, calificacion, barrioObj.encargado]
        );
        const id_cliente = resultCli.lastID;

        // 2. Insertar Fichero Digital (Contrato/Plan)
        const prod = productos[Math.floor(Math.random() * productos.length)];
        const cantidad_cuotas = prod.cuotas;
        const valor_cuota = prod.valor;
        const monto_total = cantidad_cuotas * valor_cuota;
        
        // Vendedor aleatorio
        const vendedor = ["Milagros", "Carlos", "General"][Math.floor(Math.random() * 3)];
        
        // Fecha de entrega simulada en el pasado (entre 5 y 15 semanas atrás para tener historial de cuotas)
        const semanasAtras = 3 + Math.floor(Math.random() * 12);
        const fechaEntregaDate = new Date();
        fechaEntregaDate.setDate(fechaEntregaDate.getDate() - (semanasAtras * 7));
        const fecha_entrega = fechaEntregaDate.toISOString().split('T')[0];

        // Estado del fichero según calificación
        let estadoFichero = "ACTIVO";
        if (calificacion === "MOROSO" && Math.random() > 0.5) {
            estadoFichero = "MOROSO";
        }

        const ordenVisita = Math.floor(Math.random() * 15) + 1;

        const resultFic = await run(
            "INSERT INTO ficheros (id_cliente, id_empresa, producto_nombre, cantidad_cuotas, valor_cuota, frecuencia_pago, monto_total, vendedor, encargado_zona, id_cobrador_asignado, fecha_entrega, estado, orden_visita) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [id_cliente, id_empresa, prod.nombre, cantidad_cuotas, valor_cuota, prod.frecuencia, monto_total, vendedor, barrioObj.encargado, cobradorAsignadoId, fecha_entrega, estadoFichero, ordenVisita]
        );
        const id_fichero = resultFic.lastID;

        // 3. Insertar Cuotas (casilleros de pagos)
        let fechaActual = new Date(fechaEntregaDate);
        
        for (let n = 1; n <= cantidad_cuotas; n++) {
            // Calcular fecha de vencimiento sumando 7 días por cuota semanal
            fechaActual.setDate(fechaActual.getDate() + 7);
            const fechaVencimiento = fechaActual.toISOString().split('T')[0];
            const esVencida = fechaActual < new Date();

            let estadoCuota = "PENDIENTE";
            let fechaPago = null;
            let medioPago = null;
            let motivoNoCobroVal = null;
            let compUrl = null;

            if (esVencida) {
                const randEstado = Math.random();
                
                if (calificacion === "EXCELENTE") {
                    // Paga casi siempre a tiempo
                    estadoCuota = "PAGADO";
                    medioPago = mediosPago[Math.floor(Math.random() * mediosPago.length)];
                    fechaPago = new Date(fechaActual);
                    // Pagar en el mismo día o 1-2 días de retraso
                    fechaPago.setDate(fechaPago.getDate() + Math.floor(Math.random() * 3));
                    fechaPago = fechaPago.toISOString().replace('T', ' ').substring(0, 19);
                } else if (calificacion === "BUENO") {
                    // Paga la mayoría, algunas se le pasan
                    if (randEstado > 0.15) {
                        estadoCuota = "PAGADO";
                        medioPago = mediosPago[Math.floor(Math.random() * mediosPago.length)];
                        fechaPago = new Date(fechaActual);
                        fechaPago.setDate(fechaPago.getDate() + Math.floor(Math.random() * 5));
                        fechaPago = fechaPago.toISOString().replace('T', ' ').substring(0, 19);
                    } else if (randEstado > 0.05) {
                        estadoCuota = "NO_COBRADO";
                        motivoNoCobroVal = motivosNoCobro[Math.floor(Math.random() * motivosNoCobro.length)];
                    } else {
                        estadoCuota = "PENDIENTE";
                    }
                } else if (calificacion === "REGULAR") {
                    // Paga el 50%, tiene varios no cobrados o pendientes
                    if (randEstado > 0.5) {
                        estadoCuota = "PAGADO";
                        medioPago = mediosPago[Math.floor(Math.random() * mediosPago.length)];
                        fechaPago = new Date(fechaActual);
                        fechaPago.setDate(fechaPago.getDate() + Math.floor(Math.random() * 10));
                        fechaPago = fechaPago.toISOString().replace('T', ' ').substring(0, 19);
                    } else if (randEstado > 0.25) {
                        estadoCuota = "NO_COBRADO";
                        motivoNoCobroVal = motivosNoCobro[Math.floor(Math.random() * motivosNoCobro.length)];
                    } else {
                        estadoCuota = "PENDIENTE";
                    }
                } else {
                    // MOROSO: Paga muy poco, la mayoría pendiente o no cobrado
                    if (randEstado > 0.85) {
                        estadoCuota = "PAGADO";
                        medioPago = mediosPago[Math.floor(Math.random() * mediosPago.length)];
                        fechaPago = new Date(fechaActual);
                        fechaPago.setDate(fechaPago.getDate() + Math.floor(Math.random() * 15));
                        fechaPago = fechaPago.toISOString().replace('T', ' ').substring(0, 19);
                    } else if (randEstado > 0.4) {
                        estadoCuota = "NO_COBRADO";
                        motivoNoCobroVal = motivosNoCobro[Math.floor(Math.random() * motivosNoCobro.length)];
                    } else {
                        estadoCuota = "PENDIENTE";
                    }
                }
            }

            // Imagen comprobante si es por transferencia
            if (estadoCuota === "PAGADO" && medioPago === "TRANSFERENCIA") {
                compUrl = "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400";
            }

            const nombreCobrador = cobradoresRegistrados.find(c => c.id_usuario === cobradorAsignadoId)?.nombre || "Nico Cobrador";

            await run(
                "INSERT INTO cuotas (id_fichero, id_empresa, nro_cuota, monto, estado, fecha_vencimiento, fecha_pago, medio_pago, motivo_no_cobro, comprobante_img_url, id_cobrador, nombre_cobrador) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [id_fichero, id_empresa, n, valor_cuota, estadoCuota, fechaVencimiento, fechaPago, medioPago, motivoNoCobroVal, compUrl, cobradorAsignadoId, nombreCobrador]
            );
        }

        creados++;
    }

    console.log(`✅ Se insertaron exitosamente ${creados} clientes con sus ficheros y cuotas correspondientes.`);
    
    // Re-secuenciar IDs para asegurar consistencia
    await resequenceAndReset(id_empresa);
    console.log("⭐ Proceso de simulación finalizado con éxito.");
    return creados;
}

// Ejecutar si se corre directamente
if (require.main === module) {
    const args = process.argv.slice(2);
    const cant = parseInt(args[0], 10) || 20;
    const empresaId = parseInt(args[1], 10) || 1;
    
    generateSimulation(cant, empresaId)
        .then(() => {
            console.log("¡Hecho!");
            process.exit(0);
        })
        .catch(err => {
            console.error("Error en la ejecución autónoma de simulación:", err);
            process.exit(1);
        });
}

module.exports = { generateSimulation };
