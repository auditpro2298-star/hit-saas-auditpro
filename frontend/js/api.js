/* ============================================================================
   HIT SaaS — Cliente HTTP & Manejo de Autenticación JWT + Fallback Demo Static
   ============================================================================ */

const API_BASE = '/api';

function getInitialMockDB() {
    const todayStr = new Date().toISOString().split('T')[0];
    const nowIso = new Date().toISOString();

    return {
        empresas: [
            { id_empresa: 1, nombre_comercial: "Electro Genesis", cuit_rut: "30-71829384-9", estado_suscripcion: "ACTIVA", logo_url: "https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=150" }
        ],
        usuarios: [
            { id_usuario: 1, id_empresa: null, nombre: "Martín (Súper Admin SaaS)", email: "admin@hitsaas.com", rol: "SUPER_ADMIN", activo: 1, zona_asignada: "Global" },
            { id_usuario: 2, id_empresa: 1, nombre: "Admin Genesis", email: "admin@genesis.com", rol: "ADMIN_EMPRESA", activo: 1, zona_asignada: "Oficina Central" },
            { id_usuario: 3, id_empresa: 1, nombre: "Nico Cobrador", email: "nico@genesis.com", rol: "COBRADOR", activo: 1, zona_asignada: "Flores / Berazategui / General", telefono: "+54 9 11 3344-5566" },
            { id_usuario: 4, id_empresa: 1, nombre: "Diego Silva (Cobrador Avellaneda)", email: "diego@electrohogar.com", rol: "COBRADOR", activo: 1, zona_asignada: "Avellaneda / Sur", telefono: "+54 9 11 4455-6677" },
            { id_usuario: 5, id_empresa: 1, nombre: "Coco Encargado", email: "coco@genesis.com", rol: "ENCARGADO_ZONA", activo: 1, zona_asignada: "Flores / Berazategui / General", telefono: "+54 9 11 5566-7788" },
            { id_usuario: 6, id_empresa: 1, nombre: "Carlos Gómez (Encargado Berazategui)", email: "carlos_zona@electrohogar.com", rol: "ENCARGADO_ZONA", activo: 1, zona_asignada: "Berazategui", telefono: "+54 9 11 5566-7788" }
        ],
        vendedores: [
            { id_vendedor: 1, id_empresa: 1, nombre: "Milagros Vendedora", zona_asignada: "Zona Centro", telefono: "3815001122" }
        ],
        clientes: [
            {
                id_cliente: 1,
                id_empresa: 1,
                nombre_apellido: "Marcelo Gómez",
                dni: "30123456",
                telefono: "+54 9 11 4455-6677",
                direccion: "Av. San Martín 1234",
                barrio: "Flores",
                piso_dpto: "2 B",
                referencia_domicilio: "Frente a la plaza central",
                latitud: "-34.628",
                longitud: "-58.462",
                qr_token: "4f3b9a12-e82b-4cc3-a123-456789abcdef",
                calificacion: "BUENO",
                encargado_zona: "Coco Encargado"
            },
            {
                id_cliente: 2,
                id_empresa: 1,
                nombre_apellido: "Lucía Fernández",
                dni: "32987654",
                telefono: "+54 9 11 8877-6655",
                direccion: "Calle 14 nro 456",
                barrio: "Berazategui",
                piso_dpto: "PB",
                referencia_domicilio: "Portón blanco",
                latitud: "-34.764",
                longitud: "-58.249",
                qr_token: "9b8c7d6e-5f4a-3b2c-1d0e-9a8b7c6d5e4f",
                calificacion: "EXCELENTE",
                encargado_zona: "Coco Encargado"
            }
        ],
        ficheros: [
            {
                id_fichero: 1,
                id_cliente: 1,
                id_empresa: 1,
                producto_nombre: "Smart TV 55 Samsung",
                cantidad_cuotas: 16,
                valor_cuota: 22000,
                frecuencia_pago: "SEMANAL",
                monto_total: 352000,
                vendedor: "Milagros Vendedora",
                encargado_zona: "Coco Encargado",
                id_cobrador_asignado: 3,
                orden_visita: 1,
                fecha_entrega: todayStr,
                estado: "ACTIVO"
            }
        ],
        cuotas: [
            {
                id_cuota: 101,
                id_fichero: 1,
                id_empresa: 1,
                nro_cuota: 1,
                monto: 22000,
                estado: "PAGADO",
                medio_pago: "EFECTIVO",
                fecha_pago: nowIso,
                fecha_vencimiento: todayStr,
                id_cobrador: 3,
                nombre_cobrador: "Nico Cobrador"
            },
            {
                id_cuota: 102,
                id_fichero: 1,
                id_empresa: 1,
                nro_cuota: 2,
                monto: 22000,
                estado: "PAGADO",
                medio_pago: "TRANSFERENCIA",
                comprobante_img_url: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400",
                fecha_pago: nowIso,
                fecha_vencimiento: todayStr,
                id_cobrador: 3,
                nombre_cobrador: "Nico Cobrador"
            },
            {
                id_cuota: 103,
                id_fichero: 1,
                id_empresa: 1,
                nro_cuota: 3,
                monto: 22000,
                estado: "NO_COBRADO",
                motivo_no_cobro: "AUSENTE - No respondieron timbre",
                promesa_pago_fecha: todayStr + " 17:00",
                fecha_vencimiento: todayStr,
                id_cobrador: 3,
                nombre_cobrador: "Nico Cobrador"
            }
        ],
        whatsapp_notifications: [
            {
                id_notificacion: 1,
                id_empresa: 1,
                id_cliente: 1,
                id_cuota: 101,
                telefono: "+54 9 11 4455-6677",
                mensaje: "✅ Comprobante Virtual HIT SaaS: Cuota #1 abonada ($22.000 ARS en EFECTIVO). Cobrador: Nico. Saldo pendiente: $308.000 ARS.",
                estado: "ENVIADO",
                fecha_envio: nowIso
            },
            {
                id_notificacion: 2,
                id_empresa: 1,
                id_cliente: 1,
                id_cuota: 102,
                telefono: "+54 9 11 4455-6677",
                mensaje: "📸 Comprobante Virtual HIT SaaS: Cuota #2 abonada ($22.000 ARS por TRANSFERENCIA BANCARIA). Comprobante en verificación por tesorería. ¡Muchas gracias!",
                estado: "ENVIADO",
                fecha_envio: nowIso
            }
        ]
    };
}

function getMockDB() {
    const raw = localStorage.getItem('HIT_DEMO_DB_V4');
    if (!raw) {
        const initial = getInitialMockDB();
        localStorage.setItem('HIT_DEMO_DB_V4', JSON.stringify(initial));
        return initial;
    }
    return JSON.parse(raw);
}

function saveMockDB(db) {
    localStorage.setItem('HIT_DEMO_DB_V4', JSON.stringify(db));
}

class APIClient {
    constructor() {
        this.token = localStorage.getItem('hit_token') || null;
        this.user = JSON.parse(localStorage.getItem('hit_user') || 'null');
    }

    setAuth(token, user) {
        this.token = token;
        this.user = user;
        if (token) {
            localStorage.setItem('hit_token', token);
            localStorage.setItem('hit_user', JSON.stringify(user));
        } else {
            localStorage.removeItem('hit_token');
            localStorage.removeItem('hit_user');
        }
    }

    getAuthHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        return headers;
    }

    async request(endpoint, options = {}) {
        const url = `${API_BASE}${endpoint}`;
        const headers = { ...this.getAuthHeaders(), ...(options.headers || {}) };

        try {
            const response = await fetch(url, { ...options, headers });
            
            // Si responde 404 Not Found (sitio estático en GitHub Pages sin backend Node), derivar a Mock LocalStorage
            if (response.status === 404) {
                return this.handleMockRequest(endpoint, options);
            }

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                if (data.error === 'SUSCRIPCION_BLOQUEADA' || data.error === 'USUARIO_INACTIVO') {
                    this.setAuth(null, null);
                    this.showBlockModal(data.message);
                }
                throw new Error(data.message || data.error || `Error HTTP ${response.status}`);
            }

            return data;
        } catch (err) {
            // Si falla la red (servidor backend caído o alojado estáticamente en GitHub Pages)
            const msg = (err.message || '').toLowerCase();
            const isNetworkError = err.name === 'TypeError' || err.name === 'DOMException' || msg.includes('fetch') || msg.includes('network') || msg.includes('404');
            
            if (isNetworkError) {
                console.warn(`🌐 Entorno demo estático detectado. Ejecutando endpoint local (${endpoint})`);
                return this.handleMockRequest(endpoint, options);
            }
            console.error(`Error en API (${endpoint}):`, err.message);
            throw err;
        }
    }

    handleMockRequest(endpoint, options = {}) {
        const method = (options.method || 'GET').toUpperCase();
        const body = options.body ? JSON.parse(options.body) : {};
        const db = getMockDB();

        // 1. AUTH
        if (endpoint === '/auth/login' && method === 'POST') {
            const email = (body.email || '').toLowerCase().trim();
            let matchedUser = db.usuarios.find(u => u.email.toLowerCase() === email);
            if (!matchedUser) {
                if (email.includes('super') || email.includes('saas') || email.includes('hitsaas')) {
                    matchedUser = db.usuarios.find(u => u.rol === 'SUPER_ADMIN');
                } else if (email.includes('juan') || email.includes('diego') || email.includes('cobrador')) {
                    matchedUser = db.usuarios.find(u => u.rol === 'COBRADOR');
                } else if (email.includes('carlos') || email.includes('encargado') || email.includes('zona')) {
                    matchedUser = db.usuarios.find(u => u.rol === 'ENCARGADO_ZONA') || db.usuarios[4];
                } else {
                    matchedUser = db.usuarios.find(u => u.rol === 'ADMIN_EMPRESA') || db.usuarios[0];
                }
            }

            const emp = matchedUser.id_empresa ? db.empresas.find(e => e.id_empresa === matchedUser.id_empresa) : null;
            const tokenPayload = {
                id_usuario: matchedUser.id_usuario,
                id_empresa: matchedUser.id_empresa,
                nombre: matchedUser.nombre,
                email: matchedUser.email,
                rol: matchedUser.rol,
                zona_asignada: matchedUser.zona_asignada,
                empresa_nombre: emp ? emp.nombre_comercial : 'HIT SaaS Central'
            };

            return { success: true, token: 'demo-jwt-token-hit-saas', user: tokenPayload, empresa: emp };
        }

        if (endpoint === '/auth/me' && method === 'GET') {
            return { user: this.user || db.usuarios[0] };
        }

        // 1.5. SUPER ADMIN
        if (endpoint === '/superadmin/metrics' && method === 'GET') {
            const mrrValue = db.empresas.filter(e => e.estado_suscripcion === 'ACTIVA').reduce((acc, e) => acc + (e.monto_abono_mensual || 0), 0);
            return {
                tenants: {
                    total: db.empresas.length,
                    activas: db.empresas.filter(e => e.estado_suscripcion === 'ACTIVA').length,
                    bloqueadas: db.empresas.filter(e => e.estado_suscripcion === 'BLOQUEADA').length
                },
                mrr: mrrValue,
                operaciones: {
                    total_recaudado: db.cuotas.filter(q => q.estado === 'PAGADO').reduce((acc, q) => acc + (q.monto || 0), 0),
                    cuotas_cobradas: db.cuotas.filter(q => q.estado === 'PAGADO').length
                },
                usuarios_total: db.usuarios.length
            };
        }

        if (endpoint === '/superadmin/tenants' && method === 'GET') {
            return db.empresas.map(e => {
                const totalClientes = db.clientes.filter(c => c.id_empresa === e.id_empresa).length;
                const totalFicheros = db.ficheros.filter(f => f.id_empresa === e.id_empresa).length;
                const totalCobradores = db.usuarios.filter(u => u.id_empresa === e.id_empresa && u.rol === 'COBRADOR').length;
                return {
                    ...e,
                    total_clientes: totalClientes,
                    total_ficheros: totalFicheros,
                    total_cobradores: totalCobradores
                };
            }).sort((a, b) => b.id_empresa - a.id_empresa);
        }

        if (endpoint.startsWith('/superadmin/tenants/') && method === 'PUT' && endpoint.endsWith('/logo')) {
            const id = parseInt(endpoint.split('/')[3], 10);
            const emp = db.empresas.find(e => e.id_empresa === id);
            if (emp) {
                emp.logo_url = body.logo_url;
                saveMockDB(db);
                return { success: true, message: `🖼️ Logo de "${emp.nombre_comercial}" actualizado con éxito (Modo Demo).` };
            }
            return { error: 'Empresa no encontrada.' };
        }

        if (endpoint.startsWith('/superadmin/tenants/') && method === 'PUT' && endpoint.endsWith('/password')) {
            const id = parseInt(endpoint.split('/')[3], 10);
            const emp = db.empresas.find(e => e.id_empresa === id);
            if (emp) {
                const adminUser = db.usuarios.find(u => u.id_empresa === id && u.rol === 'ADMIN_EMPRESA');
                if (adminUser) {
                    adminUser.password = body.password;
                }
                saveMockDB(db);
                return { success: true, message: `🔑 Contraseña de administrador para "${emp.nombre_comercial}" actualizada con éxito (Modo Demo).` };
            }
            return { error: 'Empresa no encontrada.' };
        }

        if (endpoint.startsWith('/superadmin/tenants/') && method === 'DELETE') {
            const id = parseInt(endpoint.split('/')[3], 10);
            db.empresas = db.empresas.filter(e => e.id_empresa !== id);
            db.usuarios = db.usuarios.filter(u => u.id_empresa !== id);
            db.clientes = db.clientes.filter(c => c.id_empresa !== id);
            db.ficheros = db.ficheros.filter(f => f.id_empresa !== id);
            db.cuotas = db.cuotas.filter(q => q.id_empresa !== id);
            saveMockDB(db);
            return { success: true, message: `🗑️ Empresa ID #${id} eliminada con éxito (Modo Demo).` };
        }

        // 2. DASHBOARD EMPRESA
        if (endpoint === '/empresa/dashboard' && method === 'GET') {
            const activosCount = db.ficheros.filter(f => f.estado === 'ACTIVO').length;
            const totalCartera = db.ficheros.filter(f => f.estado === 'ACTIVO').reduce((acc, f) => acc + Number(f.monto_total || 0), 0);
            const pagadasHoy = db.cuotas.filter(q => q.estado === 'PAGADO');
            const cobradoHoyMonto = pagadasHoy.reduce((acc, q) => acc + Number(q.monto || 0), 0);
            const deudaMonto = db.cuotas.filter(q => q.estado !== 'PAGADO').reduce((acc, q) => acc + Number(q.monto || 0), 0);

            return {
                clientes_total: db.clientes.length,
                ficheros_activos: activosCount,
                cartera_activa: totalCartera,
                cobrado_hoy: { monto: cobradoHoyMonto, cantidad: pagadasHoy.length },
                deuda_pendiente: { monto: deudaMonto }
            };
        }

        // 2.5 AUDITORÍA, PROMESAS & WHATSAPP
        if (endpoint === '/empresa/auditoria' && method === 'GET') {
            const isEncargado = (this.user && this.user.rol === 'ENCARGADO_ZONA');
            const userZona = (this.user && this.user.zona_asignada) ? this.user.zona_asignada.toLowerCase() : '';
            const userNombre = (this.user && this.user.nombre) ? this.user.nombre.toLowerCase() : '';

            const cobrosDetallados = db.cuotas
                .filter(q => q.estado === 'PAGADO' || q.estado === 'NO_COBRADO')
                .map(q => {
                    const f = db.ficheros.find(fic => fic.id_fichero === q.id_fichero) || {};
                    const c = db.clientes.find(cli => cli.id_cliente === f.id_cliente) || {};
                    const cob = db.usuarios.find(u => u.id_usuario === (q.id_cobrador || f.id_cobrador_asignado)) || {};
                    return {
                        id_cuota: q.id_cuota,
                        id_fichero: q.id_fichero,
                        nro_cuota: q.nro_cuota,
                        monto: q.monto,
                        fecha_pago: q.fecha_pago || new Date().toISOString(),
                        medio_pago: q.medio_pago || (q.estado === 'PAGADO' ? 'EFECTIVO' : 'NO COBRADO'),
                        comprobante_img_url: q.comprobante_img_url || null,
                        motivo_no_cobro: q.motivo_no_cobro || null,
                        promesa_pago_fecha: q.promesa_pago_fecha || null,
                        estado: q.estado,
                        notas: q.notas || null,
                        cliente_nombre: c.nombre_apellido || 'Marcelo Gómez',
                        direccion: c.direccion || 'Av. San Martín 1234',
                        barrio: c.barrio || 'Flores',
                        cobrador_nombre: q.nombre_cobrador || cob.nombre || 'Nico Cobrador',
                        encargado_zona: f.encargado_zona || c.encargado_zona || 'General'
                    };
                })
                .filter(q => {
                    if (!isEncargado) return true;
                    const encStr = (q.encargado_zona || q.barrio || '').toLowerCase();
                    return encStr.includes(userZona) || encStr.includes(userNombre) || userZona.includes('flores') || userZona.includes('general') || userZona.includes('coco') || !userZona;
                });

            const cierresMap = {};
            cobrosDetallados.forEach(q => {
                const name = q.cobrador_nombre || 'Nico Cobrador';
                if (!cierresMap[name]) {
                    cierresMap[name] = { cobrador_nombre: name, zona_asignada: q.barrio || 'Flores', recaudado_efectivo: 0, recaudado_transferencia: 0, cobros_realizados: 0, visitas_no_cobradas: 0 };
                }
                if (q.estado === 'PAGADO') {
                    cierresMap[name].cobros_realizados++;
                    if (q.medio_pago === 'TRANSFERENCIA') {
                        cierresMap[name].recaudado_transferencia += Number(q.monto || 0);
                    } else {
                        cierresMap[name].recaudado_efectivo += Number(q.monto || 0);
                    }
                } else if (q.estado === 'NO_COBRADO') {
                    cierresMap[name].visitas_no_cobradas++;
                }
            });

            return {
                cierres_cobrador: Object.values(cierresMap),
                cobros_detallados: cobrosDetallados
            };
        }

        if (endpoint === '/empresa/promesas' && method === 'GET') {
            const isEncargado = (this.user && this.user.rol === 'ENCARGADO_ZONA');
            const userZona = (this.user && this.user.zona_asignada) ? this.user.zona_asignada.toLowerCase() : '';
            const userNombre = (this.user && this.user.nombre) ? this.user.nombre.toLowerCase() : '';

            const promesas = db.cuotas
                .filter(q => q.estado === 'NO_COBRADO' || q.promesa_pago_fecha)
                .map(q => {
                    const f = db.ficheros.find(fic => fic.id_fichero === q.id_fichero) || {};
                    const c = db.clientes.find(cli => cli.id_cliente === f.id_cliente) || {};
                    return {
                        id_cuota: q.id_cuota,
                        id_fichero: q.id_fichero,
                        nro_cuota: q.nro_cuota,
                        monto: q.monto,
                        motivo_no_cobro: q.motivo_no_cobro || 'AUSENTE - No respondieron timbre',
                        promesa_pago_fecha: q.promesa_pago_fecha || new Date().toISOString(),
                        cliente_nombre: c.nombre_apellido || 'Marcelo Gómez',
                        telefono: c.telefono || '+54 9 11 4455-6677',
                        barrio: c.barrio || 'Flores',
                        cobrador_nombre: q.nombre_cobrador || 'Nico Cobrador',
                        encargado_zona: f.encargado_zona || c.encargado_zona || 'General'
                    };
                })
                .filter(q => {
                    if (!isEncargado) return true;
                    const encStr = (q.encargado_zona || q.barrio || '').toLowerCase();
                    return encStr.includes(userZona) || encStr.includes(userNombre) || userZona.includes('flores') || userZona.includes('general') || userZona.includes('coco') || !userZona;
                });

            const ranking = db.clientes.map(c => {
                return {
                    id_cliente: c.id_cliente,
                    nombre_apellido: c.nombre_apellido,
                    telefono: c.telefono,
                    barrio: c.barrio,
                    calificacion: c.calificacion || 'BUENO',
                    total_postergaciones: 1
                };
            });

            return {
                promesas: promesas,
                ranking_clientes: ranking
            };
        }

        if (endpoint === '/empresa/whatsapp-log' && method === 'GET') {
            return db.whatsapp_notifications || [];
        }

        // 3. CLIENTES
        if (endpoint === '/empresa/clientes' && method === 'GET') {
            return db.clientes.map(c => {
                const activeFicheros = db.ficheros.filter(f => f.id_cliente === c.id_cliente && f.estado === 'ACTIVO');
                const activeFicIds = activeFicheros.map(f => f.id_fichero);
                const cuotasPendientes = db.cuotas.filter(q => activeFicIds.includes(q.id_fichero) && q.estado === 'PENDIENTE').length;
                const cuotasTotales = activeFicheros.reduce((sum, f) => sum + f.cantidad_cuotas, 0);
                return {
                    ...c,
                    ficheros_activos: activeFicheros.length,
                    cuotas_pendientes: cuotasPendientes,
                    cuotas_totales: cuotasTotales
                };
            });
        }

        if (endpoint === '/empresa/clientes' && method === 'POST') {
            const cleanDni = body.dni.toString().trim().replace(/[^0-9]/g, '');
            if (db.clientes.some(c => c.dni === cleanDni)) {
                throw new Error(`Ya existe un cliente registrado con el DNI ${cleanDni}.`);
            }

            const cleanTel = (body.telefono || '').toString().trim().replace(/[^0-9]/g, '');
            if (cleanTel && db.clientes.some(c => (c.telefono || '').toString().replace(/[^0-9]/g, '') === cleanTel)) {
                throw new Error(`Ya existe un cliente registrado con el teléfono "${body.telefono}".`);
            }

            const cleanDir = body.direccion.trim().toLowerCase();
            const cleanBar = body.barrio.trim().toLowerCase();
            const cleanPiso = (body.piso_dpto || '').trim().toLowerCase();
            const dupeDir = db.clientes.find(c => c.direccion.trim().toLowerCase() === cleanDir && c.barrio.trim().toLowerCase() === cleanBar && (c.piso_dpto || '').trim().toLowerCase() === cleanPiso);
            if (dupeDir) {
                const pisoText = cleanPiso ? ` (Piso/Depto: ${body.piso_dpto})` : '';
                throw new Error(`Ya existe un cliente registrado en la misma dirección: "${body.direccion}, ${body.barrio}"${pisoText} (${dupeDir.nombre_apellido}).`);
            }

            const tipo = (body.tipo_cliente || 'particular').toLowerCase();
            const maxId = db.clientes.reduce((max, c) => (c.id_cliente < 1000000 ? Math.max(max, c.id_cliente) : max), 0);
            const newClient = {
                id_cliente: maxId + 1,
                id_empresa: 1,
                tipo_cliente: tipo,
                razon_social: tipo === 'empresa' ? (body.razon_social || body.nombre_apellido) : null,
                cuit: tipo === 'empresa' ? (body.cuit || body.dni) : null,
                nombre_apellido: body.nombre_apellido,
                dni: cleanDni,
                telefono: body.telefono || '',
                direccion: body.direccion,
                barrio: body.barrio,
                piso_dpto: body.piso_dpto || '',
                referencia_domicilio: body.referencia_domicilio || '',
                latitud: body.latitud || -26.83,
                longitud: body.longitud || -65.20,
                qr_token: 'HIT-QR-' + Math.floor(1000 + Math.random() * 9000) + '-DEMO',
                calificacion: 'BUENO',
                encargado_zona: body.encargado_zona || 'General'
            };
            db.clientes.push(newClient);
            saveMockDB(db);
            return { success: true, cliente: newClient, message: `✅ Cliente "${newClient.nombre_apellido}" registrado con éxito.` };
        }

        if (endpoint.startsWith('/empresa/clientes/') && method === 'DELETE') {
            const id = parseInt(endpoint.split('/')[3]);
            const activeFicheros = db.ficheros.filter(f => f.id_cliente === id && (f.estado === 'ACTIVO' || f.estado === 'MOROSO'));
            if (activeFicheros.length > 0) {
                throw new Error('No se puede eliminar un cliente con créditos activos o morosos vigentes.');
            }
            db.clientes = db.clientes.filter(c => c.id_cliente !== id);
            const ficIds = db.ficheros.filter(f => f.id_cliente === id).map(f => f.id_fichero);
            db.ficheros = db.ficheros.filter(f => f.id_cliente !== id);
            db.cuotas = db.cuotas.filter(q => !ficIds.includes(q.id_fichero));
            saveMockDB(db);
            return { success: true, message: `🗑️ Cliente y sus ficheros finalizados fueron eliminados correctamente.` };
        }

        if (endpoint.startsWith('/empresa/clientes/') && endpoint.endsWith('/calificacion') && method === 'PATCH') {
            const id = parseInt(endpoint.split('/')[3]);
            const cli = db.clientes.find(c => c.id_cliente === id);
            if (cli) {
                cli.calificacion = body.calificacion;
            }
            saveMockDB(db);
            return { success: true, message: `Calificación actualizada en modo demo.` };
        }

        // 4. FICHEROS (VENTAS)
        if (endpoint === '/empresa/ficheros' && method === 'GET') {
            let dbChanged = false;
            let list = db.ficheros.map(f => {
                const cli = db.clientes.find(c => c.id_cliente === f.id_cliente) || {};
                const cob = db.usuarios.find(u => u.id_usuario === f.id_cobrador_asignado) || {};
                const pagadas = db.cuotas.filter(q => q.id_fichero === f.id_fichero && q.estado === 'PAGADO').length;
                const pendingCuotas = db.cuotas.filter(q => q.id_fichero === f.id_fichero && q.estado === 'PENDIENTE');
                
                // Auto-finalize in mock
                if (pendingCuotas.length === 0 && f.estado === 'ACTIVO') {
                    f.estado = 'FINALIZADO';
                    dbChanged = true;
                }

                const nextPayment = (() => {
                    if (!pendingCuotas.length) return null;
                    const sortedPending = [...pendingCuotas].sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento));
                    return sortedPending[0].fecha_vencimiento;
                })();
                const todayStr = new Date().toISOString().split('T')[0];
                const pagadoHoy = db.cuotas.filter(q => q.id_fichero === f.id_fichero && q.estado === 'PAGADO' && q.fecha_pago && q.fecha_pago.startsWith(todayStr)).length;
                return {
                    ...f,
                    cliente_nombre: cli.nombre_apellido || 'Cliente Desconocido',
                    direccion: cli.direccion || '',
                    barrio: cli.barrio || 'General',
                    referencia_domicilio: cli.referencia_domicilio || '',
                    qr_token: cli.qr_token || 'HIT-QR-DEMO',
                    latitud: cli.latitud,
                    longitud: cli.longitud,
                    cobrador_nombre: cob.nombre || 'Sin asignar',
                    cuotas_pagadas: pagadas,
                    cuotas_pendientes: pendingCuotas.length,
                    cliente_telefono: cli.telefono || '',
                    proximo_vencimiento: nextPayment,
                    pagado_hoy: pagadoHoy
                };
            });
            if (dbChanged) {
                saveMockDB(db);
            }
            if (this.user && this.user.rol === 'ENCARGADO_ZONA') {
                const userName = (this.user.nombre || '').toLowerCase().trim();
                list = list.filter(item => {
                    const encName = (item.encargado_zona || '').toLowerCase();
                    return (encName && userName && encName.includes(userName)) || 
                           (item.id_cobrador_asignado === this.user.id_usuario);
                });
            }
            return list.sort((a, b) => {
                const aUnassigned = !a.id_cobrador_asignado || a.id_cobrador_asignado === 0 || a.encargado_zona === 'Sin asignar';
                const bUnassigned = !b.id_cobrador_asignado || b.id_cobrador_asignado === 0 || b.encargado_zona === 'Sin asignar';
                if (aUnassigned && !bUnassigned) return -1;
                if (!aUnassigned && bUnassigned) return 1;
                return b.id_fichero - a.id_fichero;
            });
        }

        if (endpoint.startsWith('/empresa/ficheros/') && endpoint.endsWith('/asignar') && method === 'PUT') {
            const id = parseInt(endpoint.split('/')[3]);
            const f = db.ficheros.find(item => item.id_fichero === id);
            if (f) {
                f.id_cobrador_asignado = body.id_cobrador_asignado || null;
                if (body.encargado_zona !== undefined) {
                    f.encargado_zona = body.encargado_zona || 'Sin asignar';
                }
                saveMockDB(db);
            }
            return { success: true, message: `✅ Fichero #${id} asignado a Encargado de Cobro correctamente.` };
        }

        if (endpoint === '/empresa/ficheros' && method === 'POST') {
            const nextId = db.ficheros.length ? Math.max(...db.ficheros.map(f => f.id_fichero)) + 1 : 1;
            const monto_total = parseFloat(body.valor_cuota) * parseInt(body.cantidad_cuotas);
            const newFichero = {
                id_fichero: nextId,
                id_cliente: body.id_cliente,
                id_empresa: 1,
                producto_nombre: body.producto_nombre,
                cantidad_cuotas: body.cantidad_cuotas,
                valor_cuota: body.valor_cuota,
                frecuencia_pago: body.frecuencia_pago || 'SEMANAL',
                monto_total: monto_total,
                vendedor: body.vendedor || 'General',
                encargado_zona: body.encargado_zona || 'General',
                id_cobrador_asignado: body.id_cobrador_asignado || null,
                fecha_entrega: body.fecha_entrega,
                estado: 'ACTIVO'
            };
            db.ficheros.push(newFichero);

            // Generar cuotas
            for (let i = 1; i <= body.cantidad_cuotas; i++) {
                db.cuotas.push({
                    id_cuota: Date.now() + i,
                    id_fichero: nextId,
                    id_empresa: 1,
                    nro_cuota: i,
                    monto: body.valor_cuota,
                    estado: 'PENDIENTE',
                    fecha_vencimiento: '2026-08-01',
                    id_cobrador: body.id_cobrador_asignado || null
                });
            }
            saveMockDB(db);
            return { success: true, fichero: newFichero, message: `Fichero #${nextId} creado con ${body.cantidad_cuotas} cuotas automáticas.` };
        }

        if (endpoint.startsWith('/empresa/ficheros/') && method === 'DELETE') {
            const id = parseInt(endpoint.split('/')[3]);
            db.ficheros = db.ficheros.filter(f => f.id_fichero !== id);
            db.cuotas = db.cuotas.filter(q => q.id_fichero !== id);
            saveMockDB(db);
            return { success: true, message: `🗑️ Fichero #${id} y sus casilleros fueron eliminados.` };
        }

        // 5. COBRADORES & VENDEDORES
        if (endpoint === '/empresa/cobradores' && method === 'GET') {
            return db.usuarios.filter(u => u.rol === 'COBRADOR');
        }

        if (endpoint === '/empresa/vendedores' && method === 'GET') {
            return db.vendedores;
        }

        if (endpoint === '/empresa/cobradores' && method === 'POST') {
            const newCob = {
                id_usuario: Date.now(),
                id_empresa: 1,
                nombre: body.nombre,
                email: body.email,
                rol: 'COBRADOR',
                telefono: body.telefono || '',
                zona_asignada: body.zona_asignada || 'Zona Centro',
                activo: 1
            };
            db.usuarios.push(newCob);
            saveMockDB(db);
            return { success: true, message: `✅ Cobrador "${newCob.nombre}" registrado exitosamente.` };
        }

        if (endpoint === '/empresa/vendedores' && method === 'POST') {
            const newVend = {
                id_vendedor: Date.now(),
                id_empresa: 1,
                nombre: body.nombre,
                telefono: body.telefono || '',
                zona_asignada: body.zona_asignada || 'General'
            };
            db.vendedores.push(newVend);
            saveMockDB(db);
            return { success: true, message: `✅ Vendedor "${newVend.nombre}" registrado exitosamente.` };
        }

        if (endpoint === '/empresa/encargados' && method === 'GET') {
            return db.usuarios.filter(u => u.rol === 'ENCARGADO_ZONA');
        }

        if (endpoint === '/empresa/encargados' && method === 'POST') {
            const newEnc = {
                id_usuario: Date.now(),
                id_empresa: 1,
                nombre: body.nombre,
                email: body.email,
                rol: 'ENCARGADO_ZONA',
                telefono: body.telefono || '',
                zona_asignada: body.zona_asignada || 'General',
                activo: 1
            };
            db.usuarios.push(newEnc);
            saveMockDB(db);
            return { success: true, message: `✅ Encargado de Cobro "${newEnc.nombre}" registrado exitosamente.` };
        }

        // 6. COBRADOR HOJA DE RUTA
        if (endpoint === '/cobrador/hoja-de-ruta' && method === 'GET') {
            const todayStr = new Date().toISOString().split('T')[0];
            const isCobrador = (this.user && this.user.rol === 'COBRADOR');
            
            let filteredFicheros = db.ficheros;
            if (isCobrador) {
                filteredFicheros = db.ficheros.filter(f => f.id_cobrador_asignado === this.user.id_usuario);
            }
            
            return filteredFicheros.map(f => {
                const c = db.clientes.find(cli => cli.id_cliente === f.id_cliente) || {};
                const cuotasFichero = db.cuotas.filter(q => q.id_fichero === f.id_fichero);
                const cuotasPagadas = cuotasFichero.filter(q => q.estado === 'PAGADO').length;
                const nextCuota = cuotasFichero.find(q => q.estado === 'PENDIENTE');
                const cobradoHoy = cuotasFichero.filter(q => q.estado === 'PAGADO' && (q.fecha_pago || '').startsWith(todayStr)).length;
                const noCobradoHoy = cuotasFichero.filter(q => (q.estado === 'NO_COBRADO' || q.motivo_no_cobro) && ((q.fecha_pago || '').startsWith(todayStr) || (q.promesa_pago_fecha || '').startsWith(todayStr))).length;

                return {
                    id_fichero: f.id_fichero,
                    producto_nombre: f.producto_nombre,
                    valor_cuota: f.valor_cuota,
                    cantidad_cuotas: f.cantidad_cuotas,
                    monto_total: f.monto_total,
                    fichero_estado: f.estado,
                    id_cliente: c.id_cliente,
                    nombre_apellido: c.nombre_apellido || 'Cliente Demo',
                    direccion: c.direccion || 'Calle Falsa 123',
                    barrio: c.barrio || 'General',
                    piso_dpto: c.piso_dpto || '',
                    referencia_domicilio: c.referencia_domicilio || '',
                    telefono: c.telefono || '',
                    latitud: c.latitud,
                    longitud: c.longitud,
                    qr_token: c.qr_token || 'HIT-QR-DEMO',
                    cuotas_saldadas: cuotasPagadas,
                    proxima_cuota_nro: nextCuota ? nextCuota.nro_cuota : f.cantidad_cuotas,
                    proximo_vencimiento: nextCuota ? nextCuota.fecha_vencimiento : todayStr,
                    cobrado_hoy: cobradoHoy,
                    no_cobrado_hoy: noCobradoHoy
                };
            });
        }

        if (endpoint === '/empresa/reset-asignaciones-mensual' && method === 'POST') {
            db.ficheros.forEach(f => {
                f.id_cobrador_asignado = null;
                f.encargado_zona = 'Sin asignar';
            });
            saveMockDB(db);
            return { success: true, message: '✅ Asignaciones de encargados y cobradores reiniciadas con éxito (Modo Demo).' };
        }

        if (endpoint === '/empresa/caja-cierre' && method === 'POST') {
            const todayStr = new Date().toISOString().split('T')[0];
            const obs = body.observaciones || '';
            
            // Calculate today's collections per cobrador
            const cobrosHoy = db.cuotas.filter(q => q.estado === 'PAGADO' && q.fecha_pago && q.fecha_pago.startsWith(todayStr));
            
            const grouped = {};
            cobrosHoy.forEach(q => {
                const f = db.ficheros.find(fic => fic.id_fichero === q.id_fichero) || {};
                const cobradorId = q.id_cobrador || f.id_cobrador_asignado || 3;
                if (!grouped[cobradorId]) {
                    grouped[cobradorId] = {
                        recaudado_efectivo: 0,
                        recaudado_transferencia: 0,
                        cobros_realizados: 0
                    };
                }
                if (q.medio_pago === 'TRANSFERENCIA') {
                    grouped[cobradorId].recaudado_transferencia += Number(q.monto || 0);
                } else {
                    grouped[cobradorId].recaudado_efectivo += Number(q.monto || 0);
                }
                grouped[cobradorId].cobros_realizados++;
            });
            
            const keys = Object.keys(grouped);
            if (keys.length === 0) {
                keys.push('3');
                grouped['3'] = { recaudado_efectivo: 15000, recaudado_transferencia: 8500, cobros_realizados: 3 };
            }
            
            keys.forEach(cobId => {
                const c = grouped[cobId];
                const existingIdx = db.auditoria.findIndex(a => a.id_cobrador === parseInt(cobId) && (a.fecha_caja === todayStr || a.fecha_arqueo === todayStr));
                
                const newCierre = {
                    id_caja: existingIdx >= 0 ? db.auditoria[existingIdx].id_caja : db.auditoria.length + 1,
                    id_empresa: 1,
                    id_cobrador: parseInt(cobId),
                    fecha_caja: todayStr,
                    total_efectivo: c.recaudado_efectivo,
                    total_transferencias: c.recaudado_transferencia,
                    cantidad_cobros: c.cobros_realizados,
                    estado_caja: 'CERRADA_CONCILIADA',
                    observaciones: obs,
                    fecha_actualizacion: new Date().toISOString()
                };
                
                if (existingIdx >= 0) {
                    db.auditoria[existingIdx] = newCierre;
                } else {
                    db.auditoria.push(newCierre);
                }
            });
            
            saveMockDB(db);
            return { success: true, message: '✅ Cierre de caja registrado y consolidado con éxito (Modo Demo).' };
        }

        if (endpoint === '/empresa/cierres-historial' && method === 'GET') {
            const list = db.auditoria.map(a => {
                const cob = db.usuarios.find(u => u.id_usuario === a.id_cobrador) || { nombre: 'Cobrador Demo', zona_asignada: 'Flores' };
                return {
                    id_caja: a.id_caja,
                    id_empresa: a.id_empresa,
                    id_cobrador: a.id_cobrador,
                    fecha_caja: a.fecha_caja || a.fecha_arqueo || new Date().toISOString().split('T')[0],
                    total_efectivo: a.total_efectivo || a.recaudado_efectivo || 0.00,
                    total_transferencias: a.total_transferencias || a.recaudado_transferencia || 0.00,
                    cantidad_cobros: a.cantidad_cobros || a.cobros_realizados || 0,
                    estado_caja: a.estado_caja || 'CERRADA_CONCILIADA',
                    observaciones: a.observaciones || '',
                    cobrador_nombre: cob.nombre,
                    zona_asignada: cob.zona_asignada || 'Flores'
                };
            });
            return list.sort((a, b) => b.fecha_caja.localeCompare(a.fecha_caja));
        }

        // Fallback genérico para otros GET/POST
        if (method === 'GET') return [];
        return { success: true, message: 'Operación registrada en modo demo estático.' };
    }

    get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }

    post(endpoint, body) {
        return this.request(endpoint, { method: 'POST', body: JSON.stringify(body) });
    }

    put(endpoint, body) {
        return this.request(endpoint, { method: 'PUT', body: JSON.stringify(body) });
    }

    patch(endpoint, body) {
        return this.request(endpoint, { method: 'PATCH', body: JSON.stringify(body) });
    }

    delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }

    async showBlockModal(message) {
        const panels = ['panel-super-admin', 'panel-admin-empresa', 'panel-cobrador', 'panel-client-portal'];
        panels.forEach(p => {
            const el = document.getElementById(p);
            if (el) el.classList.add('hidden');
        });
        const loginEl = document.getElementById('panel-login');
        if (loginEl) loginEl.classList.remove('hidden');

        const overlay = document.getElementById('modal-block-subscription');
        if (overlay) {
            document.getElementById('block-msg-text').innerText = message;
            overlay.classList.remove('hidden');
        } else {
            await showAlert('🚫 ALERTA SAAS:\n\n' + message);
        }
    }
}

const api = new APIClient();
window.api = api;

