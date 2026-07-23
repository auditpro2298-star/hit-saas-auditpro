/* ============================================================================
   HIT SaaS — Panel Nivel 2: Admin de Empresa (Casa de Cuotas / Dueños)
   ============================================================================ */

let mapInstance = null;
let mapMarkers = [];

async function initEmpresaPanel() {
    console.log('🏢 Inicializando Panel Admin de Empresa...');
    try {
        const dashboard = await api.get('/empresa/dashboard');
        renderEmpresaDashboard(dashboard);

        // Por defecto cargar la solapa de clientes y mapa
        switchEmpresaTab('clientes');
    } catch (err) {
        if (!err.message.includes('SUSCRIPCION_BLOQUEADA')) {
            console.error('Error al iniciar panel empresa:', err);
        }
    }
}

function renderEmpresaDashboard(d) {
    document.getElementById('emp-clientes-total').innerText = d.clientes_total || 0;
    document.getElementById('emp-ficheros-activos').innerText = d.ficheros_activos || 0;
    document.getElementById('emp-cartera-activa').innerText = `$${Number(d.cartera_activa || 0).toLocaleString('es-AR')}`;
    document.getElementById('emp-cobrado-hoy').innerText = `$${Number(d.cobrado_hoy?.monto || 0).toLocaleString('es-AR')}`;
    document.getElementById('emp-cuotas-hoy').innerText = `${d.cobrado_hoy?.cantidad || 0} cobros hoy`;
    document.getElementById('emp-deuda-monto').innerText = `$${Number(d.deuda_pendiente?.monto || 0).toLocaleString('es-AR')}`;
}

async function switchEmpresaTab(tabName) {
    // Actualizar botones activos
    document.querySelectorAll('#empresa-panel .tab-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`#empresa-panel .tab-btn[data-tab="${tabName}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    // Ocultar todas las solapas
    document.querySelectorAll('.empresa-tab-content').forEach(div => div.classList.add('hidden'));
    const targetDiv = document.getElementById(`tab-content-${tabName}`);
    if (targetDiv) targetDiv.classList.remove('hidden');

    if (tabName === 'clientes') {
        await loadClientesAndMap();
    } else if (tabName === 'ficheros') {
        await loadFicheros();
    } else if (tabName === 'personal') {
        await loadPersonal();
    } else if (tabName === 'rutas') {
        await loadAsignacionRutas();
    } else if (tabName === 'auditoria') {
        await loadAuditoriaCaja();
    } else if (tabName === 'promesas') {
        await loadPromesas();
    } else if (tabName === 'whatsapp') {
        await loadWhatsappLog();
    }
}

// SOLAPA 1: CLIENTES Y GEOLOCALIZACIÓN
async function loadClientesAndMap() {
    const clientes = await api.get('/empresa/clientes');
    renderClientesTable(clientes);
    initMap(clientes);
}

function renderClientesTable(clientes) {
    const tbody = document.getElementById('tbody-clientes');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (clientes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No hay clientes dados de alta.</td></tr>`;
        return;
    }

    clientes.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <strong style="color: var(--primary); cursor: pointer; text-decoration: underline;" 
                    onclick="focusClientOnMap(${c.id_cliente})" 
                    title="Hacer clic para ubicar en el mapa">
                    📍 ${c.nombre_apellido}
                </strong>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-left: 1.1rem;">DNI: ${c.dni}</div>
            </td>
            <td>📍 ${c.direccion} (${c.barrio})</td>
            <td>${c.telefono || '-'}</td>
            <td><span class="badge badge-purple" style="font-family: monospace;">${c.qr_token}</span></td>
            <td><span class="badge badge-success">${c.calificacion}</span></td>
            <td>
                <div class="flex gap-1 items-center flex-wrap">
                    <button class="btn btn-outline" style="font-size: 0.78rem; padding: 0.35rem 0.65rem;" onclick="showQrModal('${c.nombre_apellido}', '${c.qr_token}')">
                        📱 Ver QR
                    </button>
                    <button class="btn btn-purple" style="font-size: 0.78rem; padding: 0.35rem 0.65rem;" onclick="editarClienteMudanza(${c.id_cliente}, '${c.nombre_apellido}', '${c.direccion}', '${c.barrio}', '${c.telefono || ''}')" title="Actualizar dirección por mudanza">
                        ✏️ Mudanza
                    </button>
                    <button class="btn btn-warning" style="font-size: 0.78rem; padding: 0.35rem 0.65rem;" onclick="regenerarQrCliente(${c.id_cliente}, '${c.nombre_apellido}')" title="Regenerar por pérdida o robo">
                        🔄 Revocar QR
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function focusClientOnMap(id_cliente) {
    if (!mapInstance || !mapMarkers) return;
    const marker = mapMarkers.find(m => m.id_cliente === id_cliente);
    if (marker) {
        mapInstance.setView(marker.getLatLng(), 15);
        marker.openPopup();
        
        // Scroll suave al mapa en pantallas chicas
        document.getElementById('map-container').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function initMap(clientes) {
    const mapContainer = document.getElementById('map-container');
    if (!mapContainer || !window.L) return;

    if (!mapInstance) {
        mapInstance = L.map('map-container').setView([-34.6250, -58.4550], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap - HIT SaaS'
        }).addTo(mapInstance);
    }

    // Limpiar marcadores previos
    mapMarkers.forEach(m => mapInstance.removeLayer(m));
    mapMarkers = [];

    clientes.forEach(c => {
        if (c.latitud && c.longitud) {
            const marker = L.marker([c.latitud, c.longitud]).addTo(mapInstance);
            marker.id_cliente = c.id_cliente; // Asociar ID del cliente al marcador
            marker.bindPopup(`
                <div style="font-family: Inter, sans-serif;">
                    <strong>${c.nombre_apellido}</strong><br>
                    <span>📍 ${c.direccion} (${c.barrio})</span><br>
                    <span style="font-size:0.75rem; color:#6366f1;">QR Token: ${c.qr_token}</span>
                </div>
            `);
            mapMarkers.push(marker);
        }
    });
}

function showQrModal(nombre, token) {
    document.getElementById('modal-qr-client-name').innerText = nombre;
    document.getElementById('modal-qr-token-text').innerText = token;
    
    // Generar código QR apuntando a la URL pública de la Cartilla del Cliente
    const fullPublicUrl = `${window.location.origin}/?qr_cartilla=${token}`;
    const qrImage = document.getElementById('modal-qr-image');
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(fullPublicUrl)}&color=0f172a&bgcolor=ffffff`;
    qrImage.src = qrUrl;

    // Configurar botones de enlace público
    const linkInput = document.getElementById('modal-qr-public-link');
    if (linkInput) linkInput.value = fullPublicUrl;

    document.getElementById('modal-client-qr').classList.remove('hidden');
}

function copiarLinkCartillaCliente() {
    const linkInput = document.getElementById('modal-qr-public-link');
    if (linkInput && linkInput.value) {
        navigator.clipboard.writeText(linkInput.value);
        alert('📋 ¡Enlace público de la Cartilla copiado al portapapeles! Podés pegarlo y mandarlo a cualquier cliente.');
    }
}

function enviarLinkCartillaWhatsapp() {
    const linkInput = document.getElementById('modal-qr-public-link');
    const nombre = document.getElementById('modal-qr-client-name').innerText;
    if (linkInput && linkInput.value) {
        const msg = `Hola *${nombre}*, ingresá al siguiente enlace para ver tu Cartilla Virtual de cuotas en tiempo real:\n\n${linkInput.value}`;
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
    }
}

// Variables del mapa de verificación del modal
let modalMapInstance = null;
let modalMapMarker = null;
let modalMapGeocoder = null;

function openNewClienteModal() {
    document.getElementById('form-new-cliente').reset();
    window.tempClientLat = null;
    window.tempClientLng = null;
    const mapDiv = document.getElementById('modal-map-container');
    if (mapDiv) mapDiv.style.display = 'none';
    document.getElementById('modal-new-cliente').classList.remove('hidden');
}

async function verificarDireccionEnMapa() {
    const calle = document.getElementById('new-cli-calle').value;
    const altura = document.getElementById('new-cli-altura').value;
    const barrio = document.getElementById('new-cli-barrio').value;
    
    const dir = `${calle} ${altura}`.trim();

    if (!calle || !altura || !barrio) {
        alert('Por favor, complete primero la calle, la altura y el barrio.');
        return;
    }

    const loader = document.getElementById('verificando-loader');
    if (loader) loader.style.display = 'inline';

    // Limpieza de términos de dirección en Argentina que confunden al geocodificador Nominatim (ej: "numero", "nro", "n°", etc.)
    const cleanDir = dir.toLowerCase()
        .replace(/([a-z])(\d)/g, '$1 $2') // Separa letras de números, ej: calle121 -> calle 121
        .replace(/\bnumero\b/g, '')
        .replace(/\bnro\b/g, '')
        .replace(/\bn°\b/g, '')
        .replace(/#/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    // 1. Intentar buscar dirección completa (Calle + Altura + Barrio)
    const queryFull = `${cleanDir}, ${barrio.trim()}, Buenos Aires, Argentina`;
    const urlFull = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryFull)}`;

    try {
        const response = await fetch(urlFull);
        const results = await response.json();

        if (results && results.length > 0) {
            const best = results[0];
            const lat = parseFloat(best.lat);
            const lng = parseFloat(best.lon);

            window.tempClientLat = lat;
            window.tempClientLng = lng;

            mostrarMapaVerificacion(lat, lng);
            return;
        }

        // 2. Si falló, intentar buscar solo la Calle (sin número) dentro del Barrio
        // Extraer calle quitando los números del final (ej: "calle 121 129" -> "calle 121")
        const streetOnly = cleanDir.replace(/\s+\d+$/, '').trim();
        if (streetOnly && streetOnly !== cleanDir) {
            const queryStreet = `${streetOnly}, ${barrio.trim()}, Buenos Aires, Argentina`;
            const urlStreet = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryStreet)}`;
            const responseStreet = await fetch(urlStreet);
            const resultsStreet = await responseStreet.json();

            if (resultsStreet && resultsStreet.length > 0) {
                const bestS = resultsStreet[0];
                const latS = parseFloat(bestS.lat);
                const lngS = parseFloat(bestS.lon);

                window.tempClientLat = latS;
                window.tempClientLng = lngS;

                mostrarMapaVerificacion(latS, lngS);
                alert(`⚠️ No se encontró la altura exacta (número) en el mapa de zonas. Se ubicó en la calle "${streetOnly.toUpperCase()}". Podés arrastrar el pin rojo al número de casa exacto.`);
                return;
            }
        }

        // 3. Si falló la calle, buscar el Barrio / Zona en general
        const queryBarrio = `${barrio.trim()}, Buenos Aires, Argentina`;
        const urlBarrio = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryBarrio)}`;
        const responseBarrio = await fetch(urlBarrio);
        const resultsBarrio = await responseBarrio.json();

        if (resultsBarrio && resultsBarrio.length > 0) {
            const bestB = resultsBarrio[0];
            const latB = parseFloat(bestB.lat);
            const lngB = parseFloat(bestB.lon);

            window.tempClientLat = latB;
            window.tempClientLng = lngB;

            mostrarMapaVerificacion(latB, lngB);
            alert(`⚠️ No se encontró la calle ni la altura en el mapa. Se centró en el Barrio "${barrio.toUpperCase()}" de manera aproximada. ¡Arrastrá el pin rojo al lugar correcto!`);
        } else {
            alert('❌ No pudimos encontrar la dirección ni el barrio en el mapa. Por favor, revisa la escritura.');
        }
    } catch (err) {
        console.error('Error buscando dirección:', err);
        alert('Error al conectar con el geolocalizador. Verifique su conexión de red.');
    } finally {
        if (loader) loader.style.display = 'none';
    }
}

function mostrarMapaVerificacion(lat, lng) {
    const mapDiv = document.getElementById('modal-map-container');
    if (mapDiv) mapDiv.style.display = 'block';

    if (!modalMapInstance) {
        modalMapInstance = L.map('modal-map-container').setView([lat, lng], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(modalMapInstance);

        if (L.Control.Geocoder) {
            modalMapGeocoder = L.Control.geocoder({
                defaultMarkGeocode: false,
                placeholder: 'Buscar dirección manual...',
                errorMessage: 'No encontrado.'
            })
            .on('markgeocode', function(e) {
                const center = e.geocode.center;
                modalMapInstance.setView(center, 15);
                
                if (modalMapMarker) {
                    modalMapMarker.setLatLng(center);
                }
                window.tempClientLat = center.lat;
                window.tempClientLng = center.lng;
                console.log('Búsqueda manual, marcador a:', center.lat, center.lng);
            })
            .addTo(modalMapInstance);
        }
    } else {
        modalMapInstance.setView([lat, lng], 15);
    }

    if (modalMapMarker) {
        modalMapMarker.setLatLng([lat, lng]);
    } else {
        modalMapMarker = L.marker([lat, lng], { draggable: true }).addTo(modalMapInstance);
        
        modalMapMarker.on('dragend', function() {
            const pos = modalMapMarker.getLatLng();
            window.tempClientLat = pos.lat;
            window.tempClientLng = pos.lng;
            console.log('Marcador arrastrado a:', pos.lat, pos.lng);
        });
    }

    setTimeout(() => {
        modalMapInstance.invalidateSize();
    }, 150);
}

async function submitNewClienteForm(event) {
    event.preventDefault();
    const payload = {
        nombre_apellido: document.getElementById('new-cli-nombre').value,
        dni: document.getElementById('new-cli-dni').value,
        telefono: document.getElementById('new-cli-tel').value,
        direccion: `${document.getElementById('new-cli-calle').value} ${document.getElementById('new-cli-altura').value}`.trim(),
        barrio: document.getElementById('new-cli-barrio').value
    };

    if (window.tempClientLat && window.tempClientLng) {
        payload.latitud = window.tempClientLat;
        payload.longitud = window.tempClientLng;
    }

    try {
        await api.post('/empresa/clientes', payload);
        alert('✅ Cliente registrado e indexado geográficamente.');
        document.getElementById('modal-new-cliente').classList.add('hidden');
        document.getElementById('form-new-cliente').reset();
        
        // Limpiar temporales
        window.tempClientLat = null;
        window.tempClientLng = null;
        const mapDiv = document.getElementById('modal-map-container');
        if (mapDiv) mapDiv.style.display = 'none';

        loadClientesAndMap();
        initEmpresaPanel();
    } catch (err) {
        alert('Error al crear cliente: ' + err.message);
    }
}

// SOLAPA 2: FICHEROS Y VENTAS
async function loadFicheros() {
    const ficheros = await api.get('/empresa/ficheros');
    renderFicherosTable(ficheros);

    // Cargar clientes en el select para el modal de nuevo fichero
    const clientes = await api.get('/empresa/clientes');
    const select = document.getElementById('new-fich-cliente');
    if (select) {
        select.innerHTML = '<option value="">-- Seleccionar Cliente --</option>';
        clientes.forEach(c => {
            select.innerHTML += `<option value="${c.id_cliente}">${c.nombre_apellido} (${c.dni}) - ${c.barrio}</option>`;
        });
    }

    const cobradores = await api.get('/empresa/cobradores');
    const selectCob = document.getElementById('new-fich-cobrador');
    if (selectCob) {
        selectCob.innerHTML = '<option value="">-- Sin Asignar (General) --</option>';
        cobradores.forEach(cb => {
            selectCob.innerHTML += `<option value="${cb.id_usuario}">${cb.nombre} (${cb.zona_asignada})</option>`;
        });
    }

    const vendedores = await api.get('/empresa/vendedores');
    const selectVend = document.getElementById('new-fich-vendedor');
    if (selectVend) {
        selectVend.innerHTML = '<option value="General">-- General / Sin Especif. --</option>';
        vendedores.forEach(vd => {
            selectVend.innerHTML += `<option value="${vd.nombre}">${vd.nombre} (${vd.zona_asignada || 'General'})</option>`;
        });
        selectVend.innerHTML += '<option value="Otro">Otro Vendedor</option>';
    }
}

function openNewFicheroModal() {
    document.getElementById('modal-new-fichero').classList.remove('hidden');
    loadFicheros();
}

function renderFicherosTable(ficheros) {
    const tbody = document.getElementById('tbody-ficheros');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (ficheros.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No hay ficheros de venta activos.</td></tr>`;
        return;
    }

    ficheros.forEach(f => {
        const tr = document.createElement('tr');
        const badgeStatus = f.estado === 'ACTIVO' ? 'badge-success' : 'badge-warning';
        tr.innerHTML = `
            <td>
                <strong>Fichero #${f.id_fichero}</strong>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${f.producto_nombre}</div>
            </td>
            <td>
                <strong>${f.cliente_nombre}</strong>
                <div style="font-size: 0.75rem;">📍 ${f.barrio}</div>
            </td>
            <td>${f.cantidad_cuotas} cuotas de <strong>$${Number(f.valor_cuota).toLocaleString('es-AR')}</strong></td>
            <td><strong>$${Number(f.monto_total).toLocaleString('es-AR')}</strong></td>
            <td>
                <div class="flex items-center gap-2">
                    <span style="font-size:0.8rem;">${f.cuotas_pagadas || 0} / ${f.cantidad_cuotas} pagadas</span>
                </div>
            </td>
            <td>🛵 <strong>${f.cobrador_nombre || 'Sin asignar'}</strong></td>
            <td><span class="badge ${badgeStatus}">${f.estado}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

async function submitNewFicheroForm(event) {
    event.preventDefault();
    const payload = {
        id_cliente: parseInt(document.getElementById('new-fich-cliente').value),
        producto_nombre: document.getElementById('new-fich-producto').value,
        cantidad_cuotas: parseInt(document.getElementById('new-fich-cuotas').value || 34),
        valor_cuota: parseFloat(document.getElementById('new-fich-valor').value),
        frecuencia_pago: document.getElementById('new-fich-frecuencia')?.value || 'SEMANAL',
        vendedor: document.getElementById('new-fich-vendedor')?.value || '',
        encargado_zona: document.getElementById('new-fich-encargado')?.value || '',
        id_cobrador_asignado: document.getElementById('new-fich-cobrador').value || null,
        fecha_entrega: document.getElementById('new-fich-fecha').value || new Date().toISOString().split('T')[0]
    };

    try {
        const res = await api.post('/empresa/ficheros', payload);
        alert(res.message);
        document.getElementById('modal-new-fichero').classList.add('hidden');
        document.getElementById('form-new-fichero').reset();
        loadFicheros();
        initEmpresaPanel();
        switchEmpresaTab('ficheros');
    } catch (err) {
        alert('Error al crear fichero: ' + err.message);
    }
}

// SOLAPA 3: ASIGNACIÓN DINÁMICA DE RUTAS
let routeMapInstance = null;
let routeMapMarkers = [];
let routeMapLines = [];

async function loadAsignacionRutas() {
    const ficheros = await api.get('/empresa/ficheros');
    const cobradores = await api.get('/empresa/cobradores');
    
    // Guardar en caché global para el trazador de mapas
    window.currentFicherosCache = ficheros;

    // Poblar filtro del mapa
    const selectFilter = document.getElementById('select-filter-route-map');
    if (selectFilter) {
        selectFilter.innerHTML = '<option value="ALL">📍 Ver Todo el Personal</option>';
        cobradores.forEach(cb => {
            selectFilter.innerHTML += `<option value="${cb.id_usuario}">🛵 ${cb.nombre} (${cb.zona_asignada})</option>`;
        });
    }

    renderAsignacionTable(ficheros, cobradores);
    drawRouteMap();
}

function renderAsignacionTable(ficheros, cobradores) {
    const tbody = document.getElementById('tbody-asignacion');
    if (!tbody) return;
    tbody.innerHTML = '';

    const activos = ficheros.filter(f => f.estado === 'ACTIVO');
    if (activos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No hay ficheros activos para asignar.</td></tr>`;
        return;
    }

    activos.forEach(f => {
        const tr = document.createElement('tr');
        
        // Construir select de cobradores
        let optionsHtml = `<option value="">-- Sin asignar --</option>`;
        cobradores.forEach(cb => {
            const selected = f.id_cobrador_asignado === cb.id_usuario ? 'selected' : '';
            optionsHtml += `<option value="${cb.id_usuario}" ${selected}>🛵 ${cb.nombre}</option>`;
        });

        tr.innerHTML = `
            <td><strong>#${f.id_fichero}</strong></td>
            <td>
                <input type="number" class="form-control" value="${f.orden_visita || 0}" 
                    style="width: 65px; padding: 0.35rem 0.5rem; text-align: center; font-weight: 700; border: 1px solid var(--border-color); border-radius: 6px;" 
                    onchange="updateFicheroOrden(${f.id_fichero}, this.value)" 
                    title="Defina prioridad numérica (1, 2, 3...) para ordenar la hoja de ruta de este cobrador">
            </td>
            <td>
                <strong>${f.cliente_nombre}</strong>
                <div style="font-size:0.75rem; color:var(--text-secondary);">📍 ${f.direccion} (${f.barrio})</div>
                <div style="font-size:0.75rem; color:var(--primary); font-weight:600;">📦 ${f.producto_nombre}</div>
            </td>
            <td>
                <div class="flex items-center gap-2">
                    <select class="form-control" style="padding:0.4rem; font-size:0.85rem;" id="select-assign-${f.id_fichero}">
                        ${optionsHtml}
                    </select>
                    <button class="btn btn-primary" style="font-size:0.75rem; padding:0.4rem 0.8rem;" onclick="asignarFichero(${f.id_fichero})">
                        💾
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function asignarFichero(id_fichero) {
    const select = document.getElementById(`select-assign-${id_fichero}`);
    const id_cobrador = select.value ? parseInt(select.value) : null;

    try {
        const res = await api.put(`/empresa/ficheros/${id_fichero}/asignar`, { id_cobrador_asignado: id_cobrador });
        alert(res.message);
        loadAsignacionRutas();
    } catch (err) {
        alert('Error asignando cobrador: ' + err.message);
    }
}

async function updateFicheroOrden(id_fichero, nuevoOrden) {
    try {
        const res = await api.put(`/empresa/ficheros/${id_fichero}/orden`, { orden_visita: parseInt(nuevoOrden) || 0 });
        console.log('Orden guardado:', res.message);
        
        // Actualizar caché local y redibujar el mapa de ruta sin recargar toda la tabla
        if (window.currentFicherosCache) {
            const fIdx = window.currentFicherosCache.findIndex(x => x.id_fichero === id_fichero);
            if (fIdx >= 0) {
                window.currentFicherosCache[fIdx].orden_visita = parseInt(nuevoOrden) || 0;
            }
        }
        drawRouteMap();
    } catch (err) {
        alert('Error guardando prioridad de ruta: ' + err.message);
    }
}

function drawRouteMap() {
    const container = document.getElementById('route-map-container');
    if (!container) return;

    if (!routeMapInstance) {
        routeMapInstance = L.map('route-map-container').setView([-34.62, -58.45], 11);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(routeMapInstance);
    }

    // Limpiar previo
    routeMapMarkers.forEach(m => routeMapInstance.removeLayer(m));
    routeMapMarkers = [];
    routeMapLines.forEach(l => routeMapInstance.removeLayer(l));
    routeMapLines = [];

    const selectedCobId = document.getElementById('select-filter-route-map')?.value || 'ALL';
    if (!window.currentFicherosCache) return;

    const coordsMap = {};
    window.currentFicherosCache.forEach(f => {
        if (f.estado !== 'ACTIVO') return;
        if (f.latitud && f.longitud) {
            const cobId = f.id_cobrador_asignado || 0;
            if (!coordsMap[cobId]) coordsMap[cobId] = [];
            coordsMap[cobId].push({
                lat: parseFloat(f.latitud),
                lng: parseFloat(f.longitud),
                orden: parseInt(f.orden_visita) || 0,
                cliente: f.cliente_nombre,
                direccion: f.direccion,
                producto: f.producto_nombre,
                id_fichero: f.id_fichero
            });
        }
    });

    const colors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];
    let colorIndex = 0;
    const bounds = [];

    Object.keys(coordsMap).forEach(cobIdStr => {
        if (selectedCobId !== 'ALL' && selectedCobId !== cobIdStr) return;

        const points = coordsMap[cobIdStr];
        // Ordenar recorrido por orden de visita (prioridad)
        points.sort((a, b) => a.orden - b.orden);

        const pathCoords = [];
        points.forEach((p, idx) => {
            pathCoords.push([p.lat, p.lng]);
            bounds.push([p.lat, p.lng]);

            const markerColor = cobIdStr === '0' ? '#94a3b8' : colors[colorIndex % colors.length];
            const markerHtml = `
                <div style="background:${markerColor}; color:white; width:26px; height:26px; border-radius:50%; border:2px solid white; display:flex; justify-content:center; align-items:center; font-weight:800; font-size:0.75rem; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">
                    ${p.orden > 0 ? p.orden : idx + 1}
                </div>
            `;

            const icon = L.divIcon({
                html: markerHtml,
                className: 'custom-route-icon',
                iconSize: [26, 26]
            });

            const marker = L.marker([p.lat, p.lng], { icon })
                .bindPopup(`
                    <div style="font-family:sans-serif; font-size:0.82rem; line-height:1.4;">
                        <strong style="color:${markerColor}">📍 Visita #${p.orden > 0 ? p.orden : idx + 1}</strong><br>
                        <strong>Cliente:</strong> ${p.cliente}<br>
                        <strong>Dirección:</strong> ${p.direccion}<br>
                        <strong>Producto:</strong> ${p.producto}<br>
                        <strong>Fichero:</strong> #${p.id_fichero}
                    </div>
                `)
                .addTo(routeMapInstance);

            routeMapMarkers.push(marker);
        });

        // Dibujar polilínea secuencial si está asignado a un cobrador
        if (pathCoords.length > 1 && cobIdStr !== '0') {
            const polyline = L.polyline(pathCoords, {
                color: colors[colorIndex % colors.length],
                weight: 4,
                opacity: 0.7,
                dashArray: '8, 8'
            }).addTo(routeMapInstance);

            routeMapLines.push(polyline);
        }

        if (cobIdStr !== '0') colorIndex++;
    });

    if (bounds.length > 0) {
        routeMapInstance.fitBounds(bounds, { padding: [30, 30] });
    }

    setTimeout(() => {
        routeMapInstance.invalidateSize();
    }, 200);
}

// SOLAPA 4: AUDITORÍA DE CAJA EN VIVO & COMPROBANTES
async function loadAuditoriaCaja() {
    const audit = await api.get('/empresa/auditoria');
    renderAuditSummary(audit.cierres_cobrador);
    renderAuditDetails(audit.cobros_detallados);
}

function renderAuditSummary(cierres) {
    const tbody = document.getElementById('tbody-audit-summary');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!cierres || cierres.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No se han registrado cobros hoy en calle.</td></tr>`;
        return;
    }

    cierres.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <strong>🛵 ${c.cobrador_nombre}</strong>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${c.zona_asignada}</div>
            </td>
            <td><strong>$${Number(c.recaudado_efectivo || 0).toLocaleString('es-AR')}</strong></td>
            <td><strong>$${Number(c.recaudado_transferencia || 0).toLocaleString('es-AR')}</strong></td>
            <td><span class="badge badge-success">${c.cobros_realizados || 0} cuotas</span></td>
            <td><span class="badge badge-danger">${c.visitas_no_cobradas || 0} rechazos</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function renderAuditDetails(cobros) {
    const tbody = document.getElementById('tbody-audit-details');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!cobros || cobros.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Sin movimientos recientes de cobro.</td></tr>`;
        return;
    }

    cobros.forEach(q => {
        const tr = document.createElement('tr');
        const badgeMedio = q.medio_pago === 'EFECTIVO' ? 'badge-success' : (q.medio_pago === 'TRANSFERENCIA' ? 'badge-purple' : 'badge-danger');
        
        let comprobanteBtn = '-';
        if (q.comprobante_img_url) {
            comprobanteBtn = `<button class="btn btn-purple" style="font-size:0.72rem; padding:0.25rem 0.6rem;" onclick="showComprobanteModal('${q.comprobante_img_url}', 'Fichero #${q.id_fichero} - Cuota #${q.nro_cuota} (${q.cliente_nombre})')">📸 Ver Recibo</button>`;
        } else if (q.estado === 'NO_COBRADO') {
            comprobanteBtn = `<span style="font-size:0.75rem; color:#ef4444;">⚠️ ${q.motivo_no_cobro || 'Rechazo'}</span>`;
        }

        const fechaStr = q.fecha_pago ? new Date(q.fecha_pago).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-';

        tr.innerHTML = `
            <td><strong>${fechaStr}</strong></td>
            <td><strong>${q.cliente_nombre}</strong> (${q.barrio})</td>
            <td>Fichero #${q.id_fichero} - <strong>Cuota #${q.nro_cuota}</strong></td>
            <td><strong>$${Number(q.monto).toLocaleString('es-AR')}</strong></td>
            <td><span class="badge ${badgeMedio}">${q.medio_pago || 'NO COBRADO'}</span></td>
            <td>${comprobanteBtn}</td>
        `;
        tbody.appendChild(tr);
    });
}

function showComprobanteModal(imgUrl, titulo) {
    document.getElementById('modal-comprobante-title').innerText = titulo;
    document.getElementById('modal-comprobante-img').src = imgUrl;
    document.getElementById('modal-ver-comprobante').classList.remove('hidden');
}

// SOLAPA 5: PROMESAS DE PAGO & MOROSIDAD
async function loadPromesas() {
    try {
        const data = await api.get('/empresa/promesas');
        const promesas = data.promesas || [];
        const ranking = data.ranking_morosidad || [];

        const tbodyProm = document.getElementById('tbody-promesas-list');
        tbodyProm.innerHTML = '';
        if (promesas.length === 0) {
            tbodyProm.innerHTML = `<tr><td colspan="4" class="text-center text-muted">🎉 No hay promesas de pago pendientes.</td></tr>`;
        } else {
            promesas.forEach(p => {
                const tr = document.createElement('tr');
                const fechaProm = p.promesa_pago_fecha ? new Date(p.promesa_pago_fecha).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Sin fecha';
                tr.innerHTML = `
                    <td><strong style="color:#d97706;">📅 ${fechaProm}</strong></td>
                    <td><strong>${p.nombre_apellido}</strong><br><span style="font-size:0.75rem; color:var(--text-secondary);">${p.barrio} (${p.telefono || 'Sin tel'})</span></td>
                    <td>Fichero #${p.id_fichero}<br><strong>Cuota #${p.nro_cuota} ($${Number(p.monto).toLocaleString('es-AR')})</strong></td>
                    <td><span class="badge badge-danger" style="font-size:0.72rem;">${p.motivo_no_cobro || 'NO COBRADO'}</span><br><span style="font-size:0.75rem; color:var(--text-secondary);">Cobrador: ${p.nombre_cobrador || 'Calle'}</span></td>
                `;
                tbodyProm.appendChild(tr);
            });
        }

        const tbodyRank = document.getElementById('tbody-ranking-clientes');
        tbodyRank.innerHTML = '';
        if (ranking.length === 0) {
            tbodyRank.innerHTML = `<tr><td colspan="4" class="text-center text-muted">Ningún cliente registra postergaciones reiteradas.</td></tr>`;
        } else {
            ranking.forEach(r => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${r.nombre_apellido}</strong><br><span style="font-size:0.75rem; color:var(--text-secondary);">📞 ${r.telefono || 'Sin tel'}</span></td>
                    <td><span class="badge badge-purple">${r.barrio}</span></td>
                    <td><span class="badge badge-success">${r.calificacion || 'BUENO'}</span></td>
                    <td><span class="badge badge-danger" style="font-size:0.85rem; font-weight:800;">🚨 ${r.postergaciones} rechazos / promesas</span></td>
                `;
                tbodyRank.appendChild(tr);
            });
        }
    } catch (err) {
        console.error('Error cargando promesas de pago:', err);
    }
}

// SOLAPA 6: AUDITORÍA DE NOTIFICACIONES WHATSAPP
async function loadWhatsappLog() {
    try {
        const notifs = await api.get('/empresa/whatsapp-log');
        const tbody = document.getElementById('tbody-whatsapp-log');
        tbody.innerHTML = '';

        if (!notifs || notifs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Aún no se han generado notificaciones automáticas por WhatsApp en este turno.</td></tr>`;
            return;
        }

        notifs.forEach(w => {
            const tr = document.createElement('tr');
            const fechaStr = w.fecha ? new Date(w.fecha).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '-';
            tr.innerHTML = `
                <td><strong>${fechaStr}</strong></td>
                <td><strong>${w.cliente_nombre || 'Cliente'}</strong><br><span style="font-size:0.75rem; color:var(--text-secondary);">📞 ${w.telefono_cliente || 'Sin tel'}</span></td>
                <td>Cuota #${w.nro_cuota || '-'} ($${Number(w.monto || 0).toLocaleString('es-AR')})</td>
                <td style="max-width:320px; font-size:0.8rem; line-height:1.35; color:var(--text-secondary); white-space:normal;">💬 "${w.mensaje}"</td>
                <td><span class="badge badge-success">✔✔ ${w.estado}</span></td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Error cargando log whatsapp:', err);
    }
}

// ============================================================================
// SOLAPA 3: PERSONAL (VENDEDORES & COBRADORES EN CALLE)
// ============================================================================
async function loadPersonal() {
    await Promise.all([loadVendedoresRanking(), loadCobradoresCalle()]);
}

async function loadVendedoresRanking() {
    const tbody = document.getElementById('tbody-vendedores-ranking');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Cargando ranking...</td></tr>';

    try {
        const vendedores = await api.get('/empresa/vendedores');
        tbody.innerHTML = '';
        if (vendedores.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No hay vendedores registrados.</td></tr>';
            return;
        }

        vendedores.forEach((v, index) => {
            const tr = document.createElement('tr');
            let medalla = `${index + 1}º`;
            if (index === 0 && v.monto_total_vendido > 0) medalla = '🥇 1º (Estrella)';
            else if (index === 1 && v.monto_total_vendido > 0) medalla = '🥈 2º';
            else if (index === 2 && v.monto_total_vendido > 0) medalla = '🥉 3º';

            const badgeEstado = v.activo ? '<span class="badge badge-success">🟢 Activo</span>' : '<span class="badge badge-danger">🔴 Bloqueado</span>';
            const btnBloqueo = v.id_usuario 
                ? `<button class="btn ${v.activo ? 'btn-danger' : 'btn-success'}" style="padding:0.35rem 0.65rem; font-size:0.75rem;" onclick="toggleActivoEmpleado(${v.id_usuario}, '${v.nombre}')">${v.activo ? '🛑 Bloquear App' : '🟢 Desbloquear'}</button>`
                : `<span style="font-size:0.75rem; color:var(--text-muted);">Ventas Calle</span>`;

            tr.innerHTML = `
                <td>
                    <strong>${medalla} ${v.nombre}</strong> ${badgeEstado}
                    <div style="font-size:0.75rem; color:var(--text-muted);">${v.email}</div>
                </td>
                <td>
                    <strong>📍 ${v.zona_asignada || 'General'}</strong>
                    <div style="font-size:0.75rem; color:var(--text-secondary);">📞 ${v.telefono || '-'}</div>
                </td>
                <td>
                    <span class="badge badge-purple" style="font-size:0.85rem;">📑 ${v.total_ficheros} ficheros</span>
                </td>
                <td>
                    <div class="flex justify-between items-center gap-2">
                        <span style="font-size:1rem; font-weight:800; color:#34d399;">$${Number(v.monto_total_vendido).toLocaleString('es-AR')}</span>
                        ${btnBloqueo}
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Error cargando ranking vendedores:', err);
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Error al cargar ranking.</td></tr>';
    }
}

async function submitNewVendedorForm(event) {
    event.preventDefault();
    const nombre = document.getElementById('new-vend-nombre').value;
    const telefono = document.getElementById('new-vend-tel').value;
    const zona_asignada = document.getElementById('new-vend-zona').value;

    try {
        const res = await api.post('/empresa/vendedores', { nombre, telefono, zona_asignada });
        alert(res.message || 'Vendedor dado de alta exitosamente');
        document.getElementById('form-new-vendedor').reset();
        loadVendedoresRanking();
        loadFicheros();
    } catch (err) {
        alert('Error al crear vendedor: ' + err.message);
    }
}

async function loadCobradoresCalle() {
    const tbody = document.getElementById('tbody-cobradores-calle');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Cargando cobradores...</td></tr>';

    try {
        const cobradores = await api.get('/empresa/cobradores');
        tbody.innerHTML = '';
        if (cobradores.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No hay cobradores registrados.</td></tr>';
            return;
        }

        cobradores.forEach(cb => {
            const tr = document.createElement('tr');
            const lugaresCount = cb.lugares ? cb.lugares.length : cb.ficheros_asignados;
            const encodedLugares = encodeURIComponent(JSON.stringify(cb.lugares || []));
            const badgeEstado = cb.activo ? '<span class="badge badge-success" style="font-size:0.7rem;">🟢 App Habilitada</span>' : '<span class="badge badge-danger" style="font-size:0.7rem;">🔴 App Bloqueada</span>';
            const btnBloqueo = `<button class="btn ${cb.activo ? 'btn-danger' : 'btn-success'}" style="padding:0.4rem 0.7rem; font-size:0.78rem;" onclick="toggleActivoEmpleado(${cb.id_usuario}, '${cb.nombre}')">${cb.activo ? '🛑 Bloquear Acceso' : '🟢 Restaurar App'}</button>`;

            tr.innerHTML = `
                <td>
                    <strong>🛵 ${cb.nombre}</strong> ${badgeEstado}
                    <div style="font-size:0.75rem; color:var(--text-muted);">${cb.email}</div>
                </td>
                <td>
                    <strong>📍 ${cb.zona_asignada || 'General'}</strong>
                    <div style="font-size:0.75rem; color:var(--text-secondary);">📞 ${cb.telefono || '-'}</div>
                </td>
                <td>
                    <span class="badge badge-success" style="font-size:0.85rem;">🏠 ${lugaresCount} lugares a cobrar</span>
                </td>
                <td>
                    <div class="flex flex-col gap-1">
                        <button class="btn btn-success" style="padding:0.35rem 0.7rem; font-size:0.78rem; display:inline-flex; align-items:center; gap:0.3rem;" onclick="enviarLugaresCobroWhatsapp('${cb.nombre}', '${cb.telefono || ''}', '${cb.zona_asignada || ''}', '${encodedLugares}')">
                            📲 Enviar WhatsApp
                        </button>
                        <div class="flex gap-1">
                            ${btnBloqueo}
                            <button class="btn btn-warning" style="padding:0.35rem 0.6rem; font-size:0.78rem;" onclick="resetPasswordEmpleado(${cb.id_usuario}, '${cb.nombre}')" title="Resetear Clave por pérdida/robo de celular">
                                🔑 Reset Clave
                            </button>
                        </div>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Error cargando cobradores calle:', err);
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Error al cargar cobradores.</td></tr>';
    }
}

async function submitNewCobradorForm(event) {
    event.preventDefault();
    const nombre = document.getElementById('new-cob-nombre').value;
    const email = document.getElementById('new-cob-email').value;
    const password = document.getElementById('new-cob-pass').value;
    const telefono = document.getElementById('new-cob-tel').value;

    try {
        const res = await api.post('/empresa/cobradores', { nombre, email, password, telefono, zona_asignada: 'Zona Centro' });
        alert(res.message || 'Cobrador dado de alta exitosamente');
        document.getElementById('form-new-cobrador').reset();
        loadCobradoresCalle();
    } catch (err) {
        alert('Error al crear cobrador: ' + err.message);
    }
}

function enviarLugaresCobroWhatsapp(nombreCobrador, telCobrador, zona, encodedLugares) {
    const lugares = JSON.parse(decodeURIComponent(encodedLugares));
    let mensaje = `🛵 *HIT SaaS - Hoja de Ruta y Lugares a Cobrar*\n\nHola *${nombreCobrador}*, te enviamos los lugares y clientes que tenés asignados para cobrar hoy en tu zona (*${zona}*):\n\n`;

    if (lugares.length === 0) {
        mensaje += `_No tenés ficheros/lugares activos asignados en este momento._\n\n`;
    } else {
        lugares.forEach((item, idx) => {
            mensaje += `*${idx + 1}. ${item.nombre_apellido}* (${item.producto_nombre})\n`;
            mensaje += `   📍 Dirección: *${item.direccion}* (${item.barrio})\n`;
            mensaje += `   💵 Valor Cuota: *$${Number(item.valor_cuota).toLocaleString('es-AR')}*\n`;
            if (item.telefono) mensaje += `   📞 Tel: ${item.telefono}\n`;
            mensaje += `------------------------------------\n`;
        });
    }

    mensaje += `\nAbrí tu App de Cobrador en el celular y apuntá la cámara al QR de cada cliente cuando llegues a su puerta para asentar el cobro en el casillero.\n\n_Sistema Integral HIT SaaS_`;

    let cleanTel = telCobrador.replace(/[^0-9]/g, '');
    let url = `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;
    if (cleanTel && cleanTel.length >= 8) {
        url = `https://api.whatsapp.com/send?phone=${cleanTel}&text=${encodeURIComponent(mensaje)}`;
    }
    window.open(url, '_blank');
}

async function regenerarQrCliente(id_cliente, nombre) {
    if (!confirm(`⚠️ ¿Estás seguro de regenerar la tarjeta QR de "${nombre}"?\n\nEl código QR viejo quedará REVOCADO e INVALIDADO inmediatamente (ante extravío o robo). Se generará uno nuevo seguro.`)) {
        return;
    }
    try {
        const res = await api.post(`/empresa/clientes/${id_cliente}/regenerar-qr`);
        alert(res.message);
        loadClientesAndMap();
    } catch (err) {
        alert('Error al regenerar QR: ' + err.message);
    }
}

async function toggleActivoEmpleado(id_usuario, nombre) {
    if (!confirm(`⚠️ ¿Deseas cambiar el estado de acceso y bloqueo en calle para "${nombre}"?\n\nSi bloqueas a este empleado (por despido o renuncia), su sesión en la App Móvil se terminará instantáneamente y NO PODRÁ COBRAR NI UN PESO ni acceder a carteras de clientes.`)) {
        return;
    }
    try {
        const res = await api.put(`/empresa/usuarios/${id_usuario}/toggle-activo`);
        alert(res.message);
        loadPersonal();
    } catch (err) {
        alert('Error al cambiar estado de empleado: ' + err.message);
    }
}

async function editarClienteMudanza(id_cliente, nombre, dirActual, barrioActual, telActual) {
    const nuevaDir = prompt(`🏠 MUDANZA / CAMBIO DE DOMICILIO DE "${nombre}":\n\nIngrese la nueva calle y número:`, dirActual);
    if (!nuevaDir || !nuevaDir.trim()) return;

    const nuevoBarrio = prompt(`📍 Ingrese el nuevo Barrio o Zona:`, barrioActual);
    if (!nuevoBarrio || !nuevoBarrio.trim()) return;

    const nuevoTel = prompt(`📞 Ingrese el nuevo Teléfono de contacto:`, telActual || '');

    try {
        const res = await api.put(`/empresa/clientes/${id_cliente}`, {
            direccion: nuevaDir.trim(),
            barrio: nuevoBarrio.trim(),
            telefono: nuevoTel ? nuevoTel.trim() : telActual
        });
        alert(res.message);
        loadClientesAndMap();
    } catch (err) {
        alert('Error al actualizar domicilio: ' + err.message);
    }
}

async function resetPasswordEmpleado(id_usuario, nombre) {
    const nueva = prompt(`🔑 CAMBIO DE CONTRASEÑA REMOTO Y DESVALIDACIÓN DE SESIÓN:\n\nIngrese la nueva contraseña para "${nombre}" (por ejemplo ante robo o pérdida de celular en calle):`);
    if (!nueva || nueva.trim().length < 4) return;

    try {
        const res = await api.put(`/empresa/usuarios/${id_usuario}/reset-password`, { nueva_password: nueva.trim() });
        alert(res.message);
    } catch (err) {
        alert('Error al cambiar contraseña: ' + err.message);
    }
}

window.initEmpresaPanel = initEmpresaPanel;
window.switchEmpresaTab = switchEmpresaTab;
window.showQrModal = showQrModal;
window.submitNewClienteForm = submitNewClienteForm;
window.openNewFicheroModal = openNewFicheroModal;
window.submitNewFicheroForm = submitNewFicheroForm;
window.asignarFichero = asignarFichero;
window.showComprobanteModal = showComprobanteModal;
window.loadPromesas = loadPromesas;
window.loadWhatsappLog = loadWhatsappLog;
window.loadPersonal = loadPersonal;
window.submitNewVendedorForm = submitNewVendedorForm;
window.submitNewCobradorForm = submitNewCobradorForm;
window.enviarLugaresCobroWhatsapp = enviarLugaresCobroWhatsapp;
window.regenerarQrCliente = regenerarQrCliente;
window.toggleActivoEmpleado = toggleActivoEmpleado;
window.editarClienteMudanza = editarClienteMudanza;
window.resetPasswordEmpleado = resetPasswordEmpleado;
window.updateFicheroOrden = updateFicheroOrden;
window.drawRouteMap = drawRouteMap;
window.openNewClienteModal = openNewClienteModal;
window.verificarDireccionEnMapa = verificarDireccionEnMapa;
window.focusClientOnMap = focusClientOnMap;
