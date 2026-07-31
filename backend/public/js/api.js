/* ============================================================================
   HIT SaaS — Cliente HTTP & Manejo de Autenticación JWT + Fallback Demo Static
   ============================================================================ */

const API_BASE = '/api';

function getInitialMockDB() {
    return {
        empresas: [
            { id_empresa: 1, nombre_comercial: "ElectroHogar Cuotas", cuit_rut: "30-71829384-9", estado_suscripcion: "ACTIVA", logo_url: "https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=150" }
        ],
        usuarios: [
            { id_usuario: 1, id_empresa: null, nombre: "Martín (Súper Admin SaaS)", email: "admin@hitsaas.com", rol: "SUPER_ADMIN", activo: 1, zona_asignada: "Global" },
            { id_usuario: 2, id_empresa: 1, nombre: "Roberto González (Admin ElectroHogar)", email: "admin@electrohogar.com", rol: "ADMIN_EMPRESA", activo: 1, zona_asignada: "Oficina Central" },
            { id_usuario: 3, id_empresa: 1, nombre: "Juan Pérez (Cobrador Flores)", email: "juan@electrohogar.com", rol: "COBRADOR", activo: 1, zona_asignada: "Flores / Caballito", telefono: "+54 9 11 3344-5566" },
            { id_usuario: 4, id_empresa: 1, nombre: "Diego Silva (Cobrador Avellaneda)", email: "diego@electrohogar.com", rol: "COBRADOR", activo: 1, zona_asignada: "Avellaneda / Sur", telefono: "+54 9 11 4455-6677" }
        ],
        vendedores: [
            { id_vendedor: 1, id_empresa: 1, nombre: "Natasha Vendedora", zona_asignada: "Zona Centro", telefono: "3815001122" }
        ],
        clientes: [
            { id_cliente: 1, id_empresa: 1, nombre_apellido: "Juan Carlos Pérez", dni: "32456789", telefono: "3815551234", direccion: "Av. Avellaneda 450", barrio: "Barrio Centro", piso_dpto: "Piso 2 A", referencia_domicilio: "Portón blanco", latitud: -26.83, longitud: -65.20, qr_token: "HIT-QR-8821-A90F", calificacion: "BUENO" },
            { id_cliente: 2, id_empresa: 1, nombre_apellido: "María Elena Gómez", dni: "28990112", telefono: "3815555678", direccion: "Jujuy 820", barrio: "Barrio Sur", piso_dpto: "", referencia_domicilio: "Frente a plaza", latitud: -26.84, longitud: -65.21, qr_token: "HIT-QR-3319-B42C", calificacion: "BUENO" }
        ],
        ficheros: [
            { id_fichero: 1, id_cliente: 1, id_empresa: 1, producto_nombre: "Smart TV 55 Samsung", cantidad_cuotas: 34, valor_cuota: 5000, frecuencia_pago: "SEMANAL", monto_total: 170000, vendedor: "Natasha Vendedora", encargado_zona: "Admin", id_cobrador_asignado: 2, fecha_entrega: "2026-07-01", estado: "ACTIVO", orden_visita: 1 }
        ],
        cuotas: Array.from({ length: 34 }, (_, i) => ({
            id_cuota: i + 1,
            id_fichero: 1,
            id_empresa: 1,
            nro_cuota: i + 1,
            monto: 5000,
            estado: i === 0 ? "PAGADO" : "PENDIENTE",
            fecha_vencimiento: `2026-07-${(i * 7 + 7).toString().padStart(2, '0')}`,
            id_cobrador: 2
        }))
    };
}

function getMockDB() {
    const raw = localStorage.getItem('HIT_DEMO_DB_V2');
    if (!raw) {
        const initial = getInitialMockDB();
        localStorage.setItem('HIT_DEMO_DB_V2', JSON.stringify(initial));
        return initial;
    }
    return JSON.parse(raw);
}

function saveMockDB(db) {
    localStorage.setItem('HIT_DEMO_DB_V2', JSON.stringify(db));
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
            const totalCartera = db.ficheros.filter(f => f.estado === 'ACTIVO').reduce((acc, f) => acc + (f.monto_total || 0), 0);
            return {
                clientes_total: db.clientes.length,
                ficheros_activos: activosCount,
                cartera_activa: totalCartera,
                cobrado_hoy: { monto: 5000, cantidad: 1 },
                deuda_pendiente: { monto: totalCartera * 0.85 }
            };
        }

        // 3. CLIENTES
        if (endpoint === '/empresa/clientes' && method === 'GET') {
            return db.clientes;
        }

        if (endpoint === '/empresa/clientes' && method === 'POST') {
            const tipo = (body.tipo_cliente || 'particular').toLowerCase();
            const newClient = {
                id_cliente: Date.now(),
                id_empresa: 1,
                tipo_cliente: tipo,
                razon_social: tipo === 'empresa' ? (body.razon_social || body.nombre_apellido) : null,
                cuit: tipo === 'empresa' ? (body.cuit || body.dni) : null,
                nombre_apellido: body.nombre_apellido,
                dni: body.dni,
                telefono: body.telefono || '',
                direccion: body.direccion,
                barrio: body.barrio,
                piso_dpto: body.piso_dpto || '',
                referencia_domicilio: body.referencia_domicilio || '',
                latitud: body.latitud || -26.83,
                longitud: body.longitud || -65.20,
                qr_token: 'HIT-QR-' + Math.floor(1000 + Math.random() * 9000) + '-DEMO',
                calificacion: 'BUENO'
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

        // 4. FICHEROS (VENTAS)
        if (endpoint === '/empresa/ficheros' && method === 'GET') {
            return db.ficheros.map(f => {
                const cli = db.clientes.find(c => c.id_cliente === f.id_cliente) || {};
                const cob = db.usuarios.find(u => u.id_usuario === f.id_cobrador_asignado) || {};
                const pagadas = db.cuotas.filter(q => q.id_fichero === f.id_fichero && q.estado === 'PAGADO').length;
                return {
                    ...f,
                    cliente_nombre: cli.nombre_apellido || 'Cliente Desconocido',
                    direccion: cli.direccion || '',
                    barrio: cli.barrio || 'General',
                    qr_token: cli.qr_token || 'HIT-QR-DEMO',
                    latitud: cli.latitud,
                    longitud: cli.longitud,
                    cobrador_nombre: cob.nombre || 'Sin asignar',
                    cuotas_pagadas: pagadas
                };
            }).sort((a, b) => b.id_fichero - a.id_fichero);
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
                encargado_zona: body.encargado_zona || 'Admin',
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

        if (endpoint.startsWith('/empresa/usuarios/') && method === 'DELETE') {
            const id = parseInt(endpoint.split('/')[3]);
            db.usuarios = db.usuarios.filter(u => u.id_usuario !== id);
            saveMockDB(db);
            return { success: true, message: `🗑️ Empleado eliminado correctamente.` };
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

