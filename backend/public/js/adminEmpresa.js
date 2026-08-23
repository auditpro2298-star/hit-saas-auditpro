/* ============================================================================
   HIT SaaS — Panel Nivel 2: Admin de Empresa (Casa de Cuotas / Dueños)
   ============================================================================ */

let mapInstance = null;
let mapMarkers = [];

async function loadEmpresaDashboard() {
    try {
        const dashboard = await api.get('/empresa/dashboard');
        renderEmpresaDashboard(dashboard);
    } catch (err) {
        if (!err.message || !err.message.includes('SUSCRIPCION_BLOQUEADA')) {
            console.error('Error al actualizar dashboard empresa:', err);
        }
    }
}

async function initEmpresaPanel() {
    console.log('🏢 Inicializando Panel Admin de Empresa...');

    // Resetear visibilidad por defecto
    const tabs = ['clientes', 'ficheros', 'personal', 'rutas', 'auditoria', 'promesas', 'whatsapp', 'operativo'];
    tabs.forEach(t => {
        const el = document.querySelector(`button[data-tab="${t}"]`);
        if (el) el.style.display = '';
    });
    const btnsNuevoCliente = document.querySelectorAll('button[onclick="openNewClienteModal()"]');
    const btnsNuevoFichero = document.querySelectorAll('button[onclick="openNewFicheroModal()"]');
    const btnBackup = document.getElementById('btn-backup-db') || document.querySelector('button[onclick="descargarBackupEmpresa()"]');
    const btnRestore = document.querySelector('button[onclick="triggerRestoreUpload()"]');
    btnsNuevoCliente.forEach(b => b.style.display = '');
    btnsNuevoFichero.forEach(b => b.style.display = '');
    if (btnBackup) btnBackup.style.display = '';
    if (btnRestore) btnRestore.style.display = '';

    // --- Restricciones UI para el rol SUPER_ENCARGADO ---
    if (window.currentUser && window.currentUser.rol === 'SUPER_ENCARGADO') {
        const hideTabs = ['clientes', 'personal'];
        hideTabs.forEach(t => {
            const el = document.querySelector(`button[data-tab="${t}"]`);
            if (el) el.style.display = 'none';
        });

        btnsNuevoCliente.forEach(b => b.style.display = 'none');
        btnsNuevoFichero.forEach(b => b.style.display = 'none');
        if (btnBackup) btnBackup.style.display = 'none';
        if (btnRestore) btnRestore.style.display = 'none';
        const containerReset = document.getElementById('container-reset-mensual');
        if (containerReset) containerReset.style.display = 'none';

        const metricsDashboard = document.getElementById('empresa-metrics-dashboard');
        if (metricsDashboard) metricsDashboard.style.display = 'none';

        await loadEmpresaDashboard();
        await switchEmpresaTab('ficheros');
        return;
    }

    // --- Restricciones UI para el rol ENCARGADO_ZONA ---
    if (window.currentUser && window.currentUser.rol === 'ENCARGADO_ZONA') {
        const hideTabs = ['clientes', 'ficheros', 'personal'];
        hideTabs.forEach(t => {
            const el = document.querySelector(`button[data-tab="${t}"]`);
            if (el) el.style.display = 'none';
        });

        btnsNuevoCliente.forEach(b => b.style.display = 'none');
        btnsNuevoFichero.forEach(b => b.style.display = 'none');
        if (btnBackup) btnBackup.style.display = 'none';
        if (btnRestore) btnRestore.style.display = 'none';
        const containerReset = document.getElementById('container-reset-mensual');
        if (containerReset) containerReset.style.display = 'none';

        const metricsDashboard = document.getElementById('empresa-metrics-dashboard');
        if (metricsDashboard) metricsDashboard.style.display = 'none';

        await loadEmpresaDashboard();
        await switchEmpresaTab('rutas');
        return;
    }

    // --- Restricciones UI para el rol VENDEDOR ---
    if (window.currentUser && window.currentUser.rol === 'VENDEDOR') {
        const tabPersonal = document.querySelector('button[data-tab="personal"]');
        if (tabPersonal) tabPersonal.style.display = 'none';

        if (btnBackup) btnBackup.style.display = 'none';
        if (btnRestore) btnRestore.style.display = 'none';
    }
    // ---------------------------------------------

    await loadEmpresaDashboard();
    // Por defecto cargar la solapa de clientes y mapa
    await switchEmpresaTab('clientes');
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

    try {
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
        } else if (tabName === 'operativo') {
            await loadControlOperativoDiario();
            await cargarHistorialCierres();
        }
    } catch (err) {
        console.error(`Error al cargar datos de solapa "${tabName}":`, err);
    }
}

function formatDateTimeStr(dtStr) {
    if (!dtStr) return 'Hoy';
    try {
        const matches = dtStr.match(/^(\d{4})[/-](\d{2})[/-](\d{2})(?:[ T](\d{2}):(\d{2}))?/);
        if (matches) {
            const yyyy = matches[1];
            const yy = yyyy.slice(-2);
            const mm = matches[2];
            const dd = matches[3];
            const hh = matches[4] || '00';
            const min = matches[5] || '00';
            return `${dd}/${mm}/${yy} ${hh}:${min}`;
        }
        const parts = dtStr.split(' ');
        if (parts.length >= 2) {
            const dateParts = parts[0].split(/[/-]/);
            const timeParts = parts[1].split(':');
            if (dateParts.length === 3 && timeParts.length >= 2) {
                const dd = dateParts[2].length === 2 ? dateParts[2] : dateParts[0];
                const yy = (dateParts[2].length === 4 ? dateParts[2] : dateParts[0]).slice(-2);
                const mm = dateParts[1];
                const hh = timeParts[0];
                const min = timeParts[1];
                return `${dd}/${mm}/${yy} ${hh}:${min}`;
            }
        }
    } catch (e) {
        console.error(e);
    }
    return dtStr;
}

// SOLAPA 1: CLIENTES Y GEOLOCALIZACIÓN
async function loadClientesAndMap() {
    const clientes = await api.get('/empresa/clientes');
    window.currentClientesCache = clientes;

    // Poblar selector de barrios unicos en Solapa 1
    const selectBarrio = document.getElementById('select-filter-barrio-map');
    if (selectBarrio) {
        const barrios = [...new Set(clientes.map(c => c.barrio).filter(Boolean))].sort();
        let html = '<option value="ALL">📍 Todos los Barrios / Zonas</option>';
        barrios.forEach(b => {
            html += `<option value="${b}">🏘️ ${b}</option>`;
        });
        selectBarrio.innerHTML = html;
    }

    filtrarClientesPorBarrioYTexto();
}

window.clientesPage = 1;
window.clientesPageSize = 100;

function setClientesPage(page) {
    window.clientesPage = page;
    filtrarClientesPorBarrioYTexto(false);
}

function setClientesPageSize(size) {
    window.clientesPageSize = parseInt(size, 10) || 100;
    window.clientesPage = 1;
    filtrarClientesPorBarrioYTexto(false);
}

window.setClientesPage = setClientesPage;
window.setClientesPageSize = setClientesPageSize;

function filtrarClientesPorBarrioYTexto(resetPage = true) {
    if (!window.currentClientesCache) return;

    if (resetPage) {
        window.clientesPage = 1;
    }

    const queryStr = (document.getElementById('input-search-clientes-map')?.value || '').toLowerCase().trim();
    const selectedBarrio = document.getElementById('select-filter-barrio-map')?.value || 'ALL';

    const filtered = window.currentClientesCache.filter(c => {
        const matchBarrio = selectedBarrio === 'ALL' || (c.barrio && c.barrio.toLowerCase() === selectedBarrio.toLowerCase());
        const fullText = `${c.nombre_apellido} ${c.direccion} ${c.barrio} ${c.dni} ${c.piso_dpto || ''} ${c.referencia_domicilio || ''}`.toLowerCase();
        const matchText = !queryStr || fullText.includes(queryStr);
        return matchBarrio && matchText;
    });

    renderClientesTable(filtered);

    // Solo cargar los pines en el mapa si hay una búsqueda activa
    const hasActiveFilter = queryStr !== '' || selectedBarrio !== 'ALL';
    if (hasActiveFilter) {
        initMap(filtered);
    } else {
        // Si no hay búsqueda o filtro activo, limpiar el mapa de marcadores
        initMap([]);
    }
}

function renderClientesTable(clientes) {
    const tbody = document.getElementById('tbody-clientes');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (clientes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No se encontraron clientes para esta búsqueda o zona.</td></tr>`;
        return;
    }

    const pageSize = window.clientesPageSize || 100;
    const totalPages = Math.ceil(clientes.length / pageSize) || 1;
    if (window.clientesPage > totalPages) window.clientesPage = totalPages;
    if (window.clientesPage < 1) window.clientesPage = 1;
    const currentPage = window.clientesPage;

    const fromIndex = (currentPage - 1) * pageSize;
    const toIndex = Math.min(fromIndex + pageSize, clientes.length);
    const visibleClientes = clientes.slice(fromIndex, toIndex);

    visibleClientes.forEach(c => {
        const tr = document.createElement('tr');
        const pisoStr = c.piso_dpto ? `<span style="color:#8b5cf6; font-weight:700;"> [🏢 ${c.piso_dpto}]</span>` : '';
        const refStr = c.referencia_domicilio ? `<div style="font-size:0.75rem; color:#d97706; font-weight:600;">🏠 Ref: ${c.referencia_domicilio}</div>` : '';
        const docLabel = 'DNI';
        const docValue = c.dni;
        const nombreDisplay = c.nombre_apellido;

        const clientJsonStr = JSON.stringify(c).replace(/'/g, "&apos;");

        let selectBgColor = '#10b981'; // green-500
        let selectTextColor = '#ffffff';
        if (c.calificacion === 'REGULAR') {
            selectBgColor = '#f59e0b'; // yellow-500
            selectTextColor = '#ffffff';
        } else if (c.calificacion === 'MOROSO') {
            selectBgColor = '#ef4444'; // red-500
            selectTextColor = '#ffffff';
        }

        const selectCalificacion = `
            <select onchange="cambiarCalificacionCliente(${c.id_cliente}, this.value)" 
                style="font-size: 0.78rem; padding: 0.25rem 0.5rem; font-weight: 700; border-radius: 6px; border: 1px solid var(--border-color); background-color: ${selectBgColor}; color: ${selectTextColor}; cursor: pointer; outline: none; transition: background-color 0.2s;">
                <option value="BUENO" ${c.calificacion === 'BUENO' ? 'selected' : ''}>🟢 Buen Cliente</option>
                <option value="REGULAR" ${c.calificacion === 'REGULAR' ? 'selected' : ''}>🟡 No paga a tiempo</option>
                <option value="MOROSO" ${c.calificacion === 'MOROSO' ? 'selected' : ''}>🔴 No paga</option>
            </select>
        `;

        let estadoDeudaHtml = '';
        if (c.ficheros_activos > 0) {
            estadoDeudaHtml = `<div style="font-size: 0.73rem; color: #10b981; font-weight: 700; margin-left: 1.1rem; margin-top: 0.15rem;">🟢 Activo (Restan ${c.cuotas_pendientes || 0} cuotas)</div>`;
        } else {
            estadoDeudaHtml = `<div style="font-size: 0.73rem; color: var(--text-muted); margin-left: 1.1rem; margin-top: 0.15rem;">⚪ Inactivo (Sin deuda)</div>`;
        }

        tr.innerHTML = `
            <td><strong style="color: var(--saas-purple); font-weight: 700;">${c.id_cliente}</strong></td>
            <td>
                <strong style="color: var(--primary); cursor: pointer; text-decoration: underline;" 
                    onclick="focusClientOnMap(${c.id_cliente})" 
                    title="Hacer clic para ubicar en el mapa">
                    📍 ${nombreDisplay}
                </strong>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-left: 1.1rem;">${docLabel}: ${docValue}</div>
                ${estadoDeudaHtml}
            </td>
            <td>📍 ${c.direccion}${pisoStr} (${c.barrio})${refStr}</td>
            <td>${c.telefono || '-'}</td>
            <td><span class="badge badge-purple" style="font-family: monospace;">${c.qr_token}</span></td>
            <td>${selectCalificacion}</td>
            <td>
                <div class="flex gap-1 items-center flex-wrap">
                    <button class="btn btn-outline" style="font-size: 0.78rem; padding: 0.35rem 0.65rem;" onclick='showQrModal(${clientJsonStr})'>
                        📱 Ver QR
                    </button>
                    <button class="btn btn-purple" style="font-size: 0.78rem; padding: 0.35rem 0.65rem;" onclick="editarClienteMudanza(${c.id_cliente}, '${nombreDisplay.replace(/'/g, "\\'")}', '${c.direccion.replace(/'/g, "\\'")}', '${c.barrio.replace(/'/g, "\\'")}', '${(c.telefono || '').replace(/'/g, "\\'")}', '${(c.referencia_domicilio || '').replace(/'/g, "\\'")}')" title="Actualizar datos del cliente (dirección, teléfono, fecha de pago)">
                        ✏️ Editar Datos
                    </button>
                    ${(window.currentUser && window.currentUser.rol !== 'VENDEDOR') ? `
                    <button class="btn btn-danger" style="font-size: 0.78rem; padding: 0.35rem 0.65rem;" onclick="eliminarClienteConfirmado(${c.id_cliente}, '${nombreDisplay.replace(/'/g, "\\'")}')" title="Eliminar cliente por error o cuando termina de pagar todo">
                        🗑️ Eliminar
                    </button>
                    ` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Paginador moderno por páginas
    const paginationTr = document.createElement('tr');
    paginationTr.id = 'tr-pagination-clientes';
    paginationTr.innerHTML = `
        <td colspan="7" class="text-center" style="padding: 0.9rem 1.2rem; background: rgba(99,102,241,0.05); border-top: 1px solid var(--border-color);">
            <div class="flex justify-between items-center flex-wrap gap-3">
                <div class="text-muted" style="font-size:0.88rem; font-weight:600;">
                    Mostrando <strong>${fromIndex + 1} - ${toIndex}</strong> de <strong>${clientes.length}</strong> clientes.
                </div>
                <div class="flex items-center gap-2">
                    <span style="font-size:0.82rem; font-weight:600; color:var(--text-muted);">Ver:</span>
                    <select class="form-control" style="font-size:0.8rem; padding:0.25rem 0.5rem; width:auto; border-radius: 6px;" onchange="setClientesPageSize(this.value)">
                        <option value="100" ${pageSize === 100 ? 'selected' : ''}>100 por pág</option>
                        <option value="200" ${pageSize === 200 ? 'selected' : ''}>200 por pág</option>
                    </select>
                </div>
                <div class="flex items-center gap-2">
                    <button class="btn btn-outline" style="font-size: 0.78rem; padding: 0.35rem 0.8rem;" ${currentPage === 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''} onclick="setClientesPage(${currentPage - 1})">
                        ◀ Anterior
                    </button>
                    <span style="font-size:0.88rem; font-weight:700; color:var(--saas-purple); padding: 0 0.4rem;">
                        Página ${currentPage} de ${totalPages}
                    </span>
                    <button class="btn btn-outline" style="font-size: 0.78rem; padding: 0.35rem 0.8rem;" ${currentPage === totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''} onclick="setClientesPage(${currentPage + 1})">
                        Siguiente ▶
                    </button>
                </div>
            </div>
        </td>
    `;
    tbody.appendChild(paginationTr);
}

function focusClientOnMap(id_cliente) {
    if (!mapInstance) return;

    // Buscar si el marcador ya existe en el mapa
    let marker = mapMarkers.find(m => m.id_cliente === id_cliente);

    // Si no existe, crearlo dinámicamente y agregarlo al mapa
    if (!marker && window.currentClientesCache) {
        const c = window.currentClientesCache.find(item => item.id_cliente === id_cliente);
        if (c && c.latitud && c.longitud) {
            const lat = parseFloat(c.latitud);
            const lng = parseFloat(c.longitud);

            const queryStr = (document.getElementById('input-search-clientes-map')?.value || '').toLowerCase().trim();
            const selectedBarrio = document.getElementById('select-filter-barrio-map')?.value || 'ALL';
            const hasActiveFilter = queryStr !== '' || selectedBarrio !== 'ALL';

            // Si no hay filtro activo de búsqueda, limpiar otros marcadores previos de selección individual
            if (!hasActiveFilter) {
                mapMarkers.forEach(m => mapInstance.removeLayer(m));
                mapMarkers = [];
            }

            marker = L.marker([lat, lng]).addTo(mapInstance);
            marker.id_cliente = c.id_cliente;

            const pisoStr = c.piso_dpto ? `<br><span>🏢 Piso/Dpto: ${c.piso_dpto}</span>` : '';
            const refStr = c.referencia_domicilio ? `<br><span style="font-size:0.75rem; color:#d97706;">🏠 Ref: ${c.referencia_domicilio}</span>` : '';

            marker.bindPopup(`
                <div style="font-family: Inter, sans-serif;">
                    <strong style="color:var(--primary); font-size:0.95rem;">${c.nombre_apellido}</strong><br>
                    <span>📍 ${c.direccion}${pisoStr} (${c.barrio})</span>${refStr}<br>
                    <span style="font-size:0.75rem; color:#6366f1;">QR Token: ${c.qr_token}</span>
                </div>
            `);
            mapMarkers.push(marker);
        }
    }

    if (marker) {
        mapInstance.setView(marker.getLatLng(), 16);
        marker.openPopup();
        const mapContainer = document.getElementById('map-container');
        if (mapContainer) {
            mapContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    } else {
        showAlert('El cliente seleccionado no posee coordenadas de geolocalización registradas.');
    }
}

function initMap(clientes) {
    const mapContainer = document.getElementById('map-container');
    if (!mapContainer || !window.L) return;

    if (!mapInstance) {
        mapInstance = L.map('map-container').setView([-34.6250, -58.4550], 13);

        // Capa Esri World Street Map HD (Máxima nitidez con numeración y etiquetas de calles claras para Argentina)
        const esriStreet = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Powered by Esri'
        });
        const esriSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Imagery &copy; Esri'
        });
        const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        });

        esriStreet.addTo(mapInstance);

        L.control.layers({
            "🗺️ Callejero HD (Esri)": esriStreet,
            "🛰️ Satelital HD (Esri)": esriSat,
            "🌐 OpenStreetMap": osm
        }).addTo(mapInstance);
    }

    // Limpiar marcadores previos
    mapMarkers.forEach(m => mapInstance.removeLayer(m));
    mapMarkers = [];

    const bounds = [];

    // Limitar el renderizado de marcadores en el mapa para evitar congelamiento
    const maxMarkers = 200;
    const clisWithCoords = clientes.filter(c => c.latitud && c.longitud);
    const visibleClis = clisWithCoords.slice(0, maxMarkers);

    visibleClis.forEach(c => {
        const lat = parseFloat(c.latitud);
        const lng = parseFloat(c.longitud);
        const marker = L.marker([lat, lng]).addTo(mapInstance);
        marker.id_cliente = c.id_cliente;

        const pisoStr = c.piso_dpto ? `<br><span>🏢 Piso/Dpto: ${c.piso_dpto}</span>` : '';
        const refStr = c.referencia_domicilio ? `<br><span style="font-size:0.75rem; color:#d97706;">🏠 Ref: ${c.referencia_domicilio}</span>` : '';

        marker.bindPopup(`
            <div style="font-family: Inter, sans-serif;">
                <strong style="color:var(--primary); font-size:0.95rem;">${c.nombre_apellido}</strong><br>
                <span>📍 ${c.direccion}${pisoStr} (${c.barrio})</span>${refStr}<br>
                <span style="font-size:0.75rem; color:#6366f1;">QR Token: ${c.qr_token}</span>
            </div>
        `);
        mapMarkers.push(marker);
        bounds.push([lat, lng]);
    });

    if (bounds.length > 0) {
        mapInstance.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
    }
}

function showQrModal(nombreOrCliente, tokenArg) {
    let nombre = nombreOrCliente;
    let token = tokenArg;
    let docText = '';

    if (typeof nombreOrCliente === 'object' && nombreOrCliente !== null) {
        const c = nombreOrCliente;
        nombre = c.nombre_apellido;
        token = c.qr_token;
        docText = `DNI: ${c.dni}`;
    } else {
        docText = `DNI: ${tokenArg || ''}`;
    }

    const nameElem = document.getElementById('modal-qr-client-name');
    if (nameElem) nameElem.innerText = nombre;

    const docElem = document.getElementById('modal-qr-client-doc');
    if (docElem) docElem.innerText = docText;

    const tokenElem = document.getElementById('modal-qr-token-text');
    if (tokenElem) tokenElem.innerText = token;

    // Generar código QR apuntando a la URL pública de la Cartilla del Cliente
    const fullPublicUrl = `${window.location.origin}/?qr_cartilla=${token}`;
    const qrImage = document.getElementById('modal-qr-image');
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(fullPublicUrl)}&color=0f172a&bgcolor=ffffff`;
    if (qrImage) qrImage.src = qrUrl;

    // Configurar botones de enlace público
    const linkInput = document.getElementById('modal-qr-public-link');
    if (linkInput) linkInput.value = fullPublicUrl;

    document.getElementById('modal-client-qr').classList.remove('hidden');
}

async function copiarLinkCartillaCliente() {
    const linkInput = document.getElementById('modal-qr-public-link');
    if (linkInput && linkInput.value) {
        navigator.clipboard.writeText(linkInput.value);
        await showAlert('📋 ¡Enlace público de la Cartilla copiado al portapapeles! Podés pegarlo y mandarlo a cualquier cliente.');
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

async function geocodeEsri(query) {
    try {
        const url = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&singleLine=${encodeURIComponent(query)}&maxLocations=3`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (data && data.candidates && data.candidates.length > 0) {
            const best = data.candidates[0];
            if (best.score >= 70) {
                return {
                    lat: best.location.y,
                    lng: best.location.x,
                    address: best.address,
                    score: best.score
                };
            }
        }
    } catch (e) {
        console.warn('Esri Geocode Error:', e);
    }
    return null;
}

async function verificarDireccionEnMapa() {
    const rawCalle = document.getElementById('new-cli-calle').value.trim();
    const rawAltura = document.getElementById('new-cli-altura').value.trim();
    const rawBarrio = document.getElementById('new-cli-barrio').value.trim();

    if (!rawCalle || !rawAltura || !rawBarrio) {
        await showAlert('Por favor, complete primero la calle, la altura y el barrio.');
        return;
    }

    const loader = document.getElementById('verificando-loader');
    if (loader) loader.style.display = 'inline';

    let calleFormatted = rawCalle;
    if (/^\d+[a-zA-Z]?$/.test(calleFormatted) || !/^(calle|av|avenida|pasaje|diagonal|ruta|camino|c\.)/i.test(calleFormatted)) {
        calleFormatted = `Calle ${calleFormatted}`;
    }

    // 1. Probar con Esri ArcGIS Geocode (Motor de máxima precisión para números de calle en Argentina)
    const queryEsri1 = `${calleFormatted} ${rawAltura}, ${rawBarrio}, Buenos Aires, Argentina`;
    const queryEsri2 = `${rawCalle} ${rawAltura}, ${rawBarrio}, Buenos Aires, Argentina`;

    try {
        let match = await geocodeEsri(queryEsri1);
        if (!match) match = await geocodeEsri(queryEsri2);

        if (match) {
            window.tempClientLat = match.lat;
            window.tempClientLng = match.lng;

            mostrarMapaVerificacion(match.lat, match.lng);
            console.log(`📍 Geocodificado por Esri ArcGIS (${match.score}%):`, match.address, match.lat, match.lng);
            return;
        }

        // 2. Fallback a OpenStreetMap Nominatim descartando límites municipales genéricos
        const isStreetResult = (r) => r && r.class !== 'boundary' && r.type !== 'administrative' && r.type !== 'city';
        const candidateQueries = [
            `${calleFormatted} ${rawAltura}, ${rawBarrio}, Buenos Aires, Argentina`,
            `${calleFormatted}, ${rawBarrio}, Buenos Aires, Argentina`
        ];

        for (let i = 0; i < candidateQueries.length; i++) {
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(candidateQueries[i])}`;
            const resp = await fetch(url);
            const results = await resp.json();
            const streetMatches = results.filter(isStreetResult);

            if (streetMatches.length > 0) {
                const best = streetMatches[0];
                const lat = parseFloat(best.lat);
                const lng = parseFloat(best.lon);
                window.tempClientLat = lat;
                window.tempClientLng = lng;
                mostrarMapaVerificacion(lat, lng);
                if (i === 1) {
                    await showAlert(`📍 Se ubicó el pin en "${calleFormatted.toUpperCase()}". Podés arrastrar el marcador rojo en el mapa para posicionarlo en la altura exacta (#${rawAltura}).`);
                }
                return;
            }
        }

        // 3. Fallback a Photon API (Komoot / OSM)
        const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(calleFormatted + ' ' + rawAltura + ' ' + rawBarrio + ' Buenos Aires')}`;
        const pResp = await fetch(photonUrl);
        const pData = await pResp.json();
        if (pData && pData.features && pData.features.length > 0) {
            const coords = pData.features[0].geometry.coordinates;
            const lat = coords[1];
            const lng = coords[0];
            window.tempClientLat = lat;
            window.tempClientLng = lng;
            mostrarMapaVerificacion(lat, lng);
            return;
        }

        // 4. Fallback final al barrio
        const queryBarrio = `${rawBarrio}, Buenos Aires, Argentina`;
        const respBarrio = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryBarrio)}`);
        const resB = await respBarrio.json();
        if (resB && resB.length > 0) {
            const latB = parseFloat(resB[0].lat);
            const lngB = parseFloat(resB[0].lon);
            window.tempClientLat = latB;
            window.tempClientLng = lngB;
            mostrarMapaVerificacion(latB, lngB);
            await showAlert(`⚠️ Se centró en el Barrio "${rawBarrio.toUpperCase()}". Arrastrá el marcador rojo al punto exacto.`);
        } else {
            await showAlert('❌ No se encontró la dirección. Podés abrir Google Maps y arrastrar el pin rojo.');
        }

    } catch (err) {
        console.error('Error al geolocalizar:', err);
        await showAlert('Error de conexión al buscar dirección.');
    } finally {
        if (loader) loader.style.display = 'none';
    }
}

function abrirBusquedaGoogleMaps() {
    const calle = document.getElementById('new-cli-calle').value.trim();
    const altura = document.getElementById('new-cli-altura').value.trim();
    const barrio = document.getElementById('new-cli-barrio').value.trim();

    let query = `${calle} ${altura} ${barrio}`.trim();
    if (!query) query = 'Berazategui Buenos Aires';

    const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    window.open(gmapsUrl, '_blank');
}

async function procesarEnlaceGoogleMaps() {
    const input = document.getElementById('new-cli-gmaps-link');
    if (!input) return;
    const val = input.value.trim();
    if (!val) return;

    let lat = null;
    let lng = null;

    const matchAt = val.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    const matchQ = val.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    const match3d = val.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    const matchDirect = val.match(/^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/);

    if (matchAt) {
        lat = parseFloat(matchAt[1]);
        lng = parseFloat(matchAt[2]);
    } else if (matchQ) {
        lat = parseFloat(matchQ[1]);
        lng = parseFloat(matchQ[2]);
    } else if (match3d) {
        lat = parseFloat(match3d[1]);
        lng = parseFloat(match3d[2]);
    } else if (matchDirect) {
        lat = parseFloat(matchDirect[1]);
        lng = parseFloat(matchDirect[2]);
    } else {
        const matchAny = val.match(/(-?\d{2}\.\d+)\s*,\s*(-?\d{2}\.\d+)/);
        if (matchAny) {
            lat = parseFloat(matchAny[1]);
            lng = parseFloat(matchAny[2]);
        }
    }

    if (lat !== null && lng !== null) {
        window.tempClientLat = lat;
        window.tempClientLng = lng;
        mostrarMapaVerificacion(lat, lng);
        await showAlert(`🎯 Marcador posicionado en las coordenadas exactas de Google Maps: (${lat.toFixed(6)}, ${lng.toFixed(6)})`);
    } else {
        await showAlert('⚠️ No se pudieron extraer coordenadas. Podés pegar el enlace completo de Google Maps o las coordenadas (ej: -34.7646, -58.2495).');
    }
}

function mostrarMapaVerificacion(lat, lng) {
    const mapDiv = document.getElementById('modal-map-container');
    if (mapDiv) mapDiv.style.display = 'block';

    if (!modalMapInstance) {
        modalMapInstance = L.map('modal-map-container').setView([lat, lng], 17);

        // Capa Esri World Street Map (Alta precisión y nitidez HD para Argentina)
        const esriStreet = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Powered by Esri & OpenStreetMap'
        });

        // Capa Esri Satelital (Vista Aérea HD como Google Earth)
        const esriSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Imagery &copy; Esri'
        });

        // Capa OpenStreetMap
        const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        });

        esriStreet.addTo(modalMapInstance);

        // Control de Capas (Callejero / Satelital)
        L.control.layers({
            "🗺️ Callejero HD (Esri)": esriStreet,
            "🛰️ Satelital HD (Satelital)": esriSat,
            "🌐 OpenStreetMap": osm
        }).addTo(modalMapInstance);

    } else {
        modalMapInstance.setView([lat, lng], 17);
    }

    if (modalMapMarker) {
        modalMapMarker.setLatLng([lat, lng]);
    } else {
        modalMapMarker = L.marker([lat, lng], { draggable: true }).addTo(modalMapInstance);

        modalMapMarker.on('dragend', function () {
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

    const calleVal = (document.getElementById('new-cli-calle')?.value || '').trim();
    const alturaVal = (document.getElementById('new-cli-altura')?.value || '').trim();
    const nombreVal = (document.getElementById('new-cli-nombre')?.value || '').trim();
    const dniVal = (document.getElementById('new-cli-dni')?.value || '').trim();
    const barrioVal = (document.getElementById('new-cli-barrio')?.value || '').trim();

    if (!nombreVal || !dniVal || !calleVal || !barrioVal) {
        await showAlert('⚠️ Por favor complete los campos obligatorios: Nombre, DNI, Calle y Barrio.');
        return;
    }

    const direccionCompleta = alturaVal ? `${calleVal} ${alturaVal}` : calleVal;

    const payload = {
        nombre_apellido: nombreVal,
        dni: dniVal,
        telefono: (document.getElementById('new-cli-tel')?.value || '').trim(),
        direccion: direccionCompleta,
        barrio: barrioVal,
        piso_dpto: (document.getElementById('new-cli-piso')?.value || '').trim(),
        referencia_domicilio: (document.getElementById('new-cli-ref')?.value || '').trim()
    };

    if (window.tempClientLat && window.tempClientLng) {
        payload.latitud = window.tempClientLat;
        payload.longitud = window.tempClientLng;
    }

    try {
        const res = await api.post('/empresa/clientes', payload);
        await showAlert('✅ Cliente registrado e indexado geográficamente con éxito.');
        document.getElementById('modal-new-cliente').classList.add('hidden');
        document.getElementById('form-new-cliente').reset();

        // Limpiar temporales
        window.tempClientLat = null;
        window.tempClientLng = null;
        const mapDiv = document.getElementById('modal-map-container');
        if (mapDiv) mapDiv.style.display = 'none';

        loadClientesAndMap();

        if (res && res.cliente && res.cliente.qr_token) {
            showQrModal(res.cliente.nombre_apellido, res.cliente.qr_token);
        }
    } catch (err) {
        await showAlert('❌ Error al crear cliente: ' + err.message);
    }
}

// SOLAPA 2: FICHEROS Y VENTAS
async function loadFicheros() {
    // 1. Cargar encargados de zona y cobradores
    try {
        const [encargados, cobradores] = await Promise.all([
            api.get('/empresa/encargados').catch(() => []),
            api.get('/empresa/cobradores').catch(() => [])
        ]);
        const combined = [];
        (encargados || []).forEach(e => {
            combined.push({
                id_usuario: e.id_usuario,
                nombre: e.nombre,
                rol: e.rol || 'ENCARGADO_ZONA',
                zona_asignada: e.zona_asignada
            });
        });
        (cobradores || []).forEach(c => {
            if (!combined.some(x => x.id_usuario === c.id_usuario)) {
                combined.push({
                    id_usuario: c.id_usuario,
                    nombre: c.nombre,
                    rol: 'COBRADOR',
                    zona_asignada: c.zona_asignada
                });
            }
        });
        window.allEncargadosCache = combined;
    } catch (e) {
        console.error('Error cargando encargados/cobradores:', e);
    }

    const ficheros = await api.get('/empresa/ficheros');
    window.currentFicherosListCache = ficheros;
    filtrarFicheros();

    // Cargar clientes en el select para el modal de nuevo fichero (reutilizando caché si existe)
    let clientes = window.currentClientesCache;
    if (!clientes) {
        clientes = await api.get('/empresa/clientes');
        window.currentClientesCache = clientes;
    }
    const select = document.getElementById('new-fich-cliente');
    if (select) {
        let html = '<option value="">-- Seleccionar Cliente --</option>';
        clientes.forEach(c => {
            html += `<option value="${c.id_cliente}">${c.nombre_apellido} (${c.dni}) - ${c.barrio}</option>`;
        });
        select.innerHTML = html;
    }

    const vendedores = await api.get('/empresa/vendedores');
    const selectVend = document.getElementById('new-fich-vendedor');
    if (selectVend) {
        let html = '<option value="General">-- General / Sin Especif. --</option>';
        vendedores.forEach(vd => {
            html += `<option value="${vd.nombre}">${vd.nombre} (${vd.zona_asignada || 'General'})</option>`;
        });
        html += '<option value="Otro">Otro Vendedor</option>';
        selectVend.innerHTML = html;
    }
}

function openNewFicheroModal() {
    document.getElementById('modal-new-fichero').classList.remove('hidden');
    loadFicheros();
}

window.ficherosPage = 1;
window.ficherosPageSize = 100;

function setFicherosPage(page) {
    window.ficherosPage = page;
    filtrarFicheros(false);
}

function setFicherosPageSize(size) {
    window.ficherosPageSize = parseInt(size, 10) || 100;
    window.ficherosPage = 1;
    filtrarFicheros(false);
}

window.setFicherosPage = setFicherosPage;
window.setFicherosPageSize = setFicherosPageSize;

function renderFicherosTable(ficheros) {
    const tbody = document.getElementById('tbody-ficheros');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (ficheros.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted">No hay ficheros de venta activos.</td></tr>`;
        return;
    }

    const pageSize = window.ficherosPageSize || 100;
    const totalPages = Math.ceil(ficheros.length / pageSize) || 1;
    if (window.ficherosPage > totalPages) window.ficherosPage = totalPages;
    if (window.ficherosPage < 1) window.ficherosPage = 1;
    const currentPage = window.ficherosPage;

    const fromIndex = (currentPage - 1) * pageSize;
    const toIndex = Math.min(fromIndex + pageSize, ficheros.length);
    const visibleFicheros = ficheros.slice(fromIndex, toIndex);

    const encargadosList = window.allEncargadosCache || [];

    visibleFicheros.forEach(f => {
        const tr = document.createElement('tr');
        let badgeStatus = 'badge-success';
        if (f.estado === 'FINALIZADO') badgeStatus = 'badge-purple';
        else if (f.estado === 'CANCELADO') badgeStatus = 'badge-danger';
        else if (f.estado === 'MOROSO') badgeStatus = 'badge-warning';

        let encargadoTdContent = `🛵 <strong>${f.encargado_zona || f.cobrador_nombre || 'Sin asignar'}</strong>`;

        if (!window.currentUser || window.currentUser.rol === 'ADMIN_EMPRESA' || window.currentUser.rol === 'SUPER_ADMIN' || window.currentUser.rol === 'SUPER_ENCARGADO') {
            let optionsHtml = `<option value="">-- Sin asignar --</option>`;
            encargadosList.forEach(enc => {
                const isSelected = (f.id_cobrador_asignado === enc.id_usuario || f.encargado_zona === enc.nombre);
                const prefix = enc.rol === 'COBRADOR' ? '🛵' : '👤';
                optionsHtml += `<option value="${enc.id_usuario}" ${isSelected ? 'selected' : ''}>${prefix} ${enc.nombre} (${enc.zona_asignada || 'General'})</option>`;
            });
            encargadoTdContent = `
                <select class="form-control" style="font-size:0.78rem; padding:0.25rem 0.4rem; font-weight:600; border:1px solid #8b5cf6; border-radius: var(--radius-md); max-width: 170px;" onchange="cambiarEncargadoFichero(${f.id_fichero}, this.value)">
                    ${optionsHtml}
                </select>
            `;
        }

        const refStr = f.referencia_domicilio ? `<div style="font-size:0.75rem; color:#d97706; font-weight:600;">🏠 Ref: ${f.referencia_domicilio}</div>` : '';

        tr.innerHTML = `
            <td><strong>#${f.id_fichero}</strong></td>
            <td>
                <strong>${f.producto_nombre}</strong>
            </td>
            <td>
                <strong>${f.cliente_nombre}</strong>
                <div style="font-size: 0.75rem;">📍 ${f.barrio}</div>
                ${refStr}
            </td>
            <td>${f.cantidad_cuotas} cuotas de <strong>$${Number(f.valor_cuota).toLocaleString('es-AR')}</strong></td>
            <td>
                <strong>$${Number(f.monto_total).toLocaleString('es-AR')}</strong>
                ${Number(f.saldo_favor || 0) > 0 ? `<div style="margin-top:4px;"><span class="badge badge-success" style="font-size:0.7rem; font-weight:700; background-color: var(--success); color: white;" title="Saldo a favor del cliente por pagar de más">💰 Saldo favor: $${Number(f.saldo_favor).toLocaleString('es-AR')}</span></div>` : ''}
            </td>
            <td>
                <div class="flex items-center gap-2">
                    <span style="font-size:0.8rem;">${f.cuotas_pagadas || 0} / ${f.cantidad_cuotas} pagadas</span>
                </div>
            </td>
            <td>${encargadoTdContent}</td>
            <td>
                <span class="badge ${badgeStatus}">${f.estado}</span>
                ${f.pagado_hoy > 0 ? `<div style="margin-top:4px;"><span class="badge badge-success" style="font-size:0.7rem; font-weight:700; background-color: var(--success); color: white;">✅ Pago cuota del mes:<br>${formatDateTimeStr(f.fecha_pago_hoy)}</span></div>` : ''}
            </td>
            <td>
                ${(window.currentUser && (window.currentUser.rol === 'ADMIN_EMPRESA' || window.currentUser.rol === 'SUPER_ADMIN')) ? `
                <button class="btn btn-danger" style="font-size:0.75rem; padding:0.3rem 0.6rem;" onclick="eliminarFicheroConfirmado(${f.id_fichero}, '${f.producto_nombre}')" title="Eliminar fichero por equivocación o cancelación">
                    🗑️ Eliminar
                </button>
                ` : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Paginador moderno por páginas
    const paginationTr = document.createElement('tr');
    paginationTr.id = 'tr-pagination-ficheros';
    paginationTr.innerHTML = `
        <td colspan="9" class="text-center" style="padding: 0.9rem 1.2rem; background: rgba(99,102,241,0.05); border-top: 1px solid var(--border-color);">
            <div class="flex justify-between items-center flex-wrap gap-3">
                <div class="text-muted" style="font-size:0.88rem; font-weight:600;">
                    Mostrando <strong>${fromIndex + 1} - ${toIndex}</strong> de <strong>${ficheros.length}</strong> ficheros.
                </div>
                <div class="flex items-center gap-2">
                    <span style="font-size:0.82rem; font-weight:600; color:var(--text-muted);">Ver:</span>
                    <select class="form-control" style="font-size:0.8rem; padding:0.25rem 0.5rem; width:auto; border-radius: 6px;" onchange="setFicherosPageSize(this.value)">
                        <option value="100" ${pageSize === 100 ? 'selected' : ''}>100 por pág</option>
                        <option value="200" ${pageSize === 200 ? 'selected' : ''}>200 por pág</option>
                    </select>
                </div>
                <div class="flex items-center gap-2">
                    <button class="btn btn-outline" style="font-size: 0.78rem; padding: 0.35rem 0.8rem;" ${currentPage === 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''} onclick="setFicherosPage(${currentPage - 1})">
                        ◀ Anterior
                    </button>
                    <span style="font-size:0.88rem; font-weight:700; color:var(--saas-purple); padding: 0 0.4rem;">
                        Página ${currentPage} de ${totalPages}
                    </span>
                    <button class="btn btn-outline" style="font-size: 0.78rem; padding: 0.35rem 0.8rem;" ${currentPage === totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''} onclick="setFicherosPage(${currentPage + 1})">
                        Siguiente ▶
                    </button>
                </div>
            </div>
        </td>
    `;
    tbody.appendChild(paginationTr);
}

async function cambiarEncargadoFichero(id_fichero, val) {
    const id_cobrador = val ? parseInt(val) : null;
    const selectedEnc = (window.allEncargadosCache || []).find(e => e.id_usuario === id_cobrador);
    const encName = selectedEnc ? selectedEnc.nombre : '';

    try {
        const res = await api.put(`/empresa/ficheros/${id_fichero}/asignar`, {
            id_cobrador_asignado: id_cobrador,
            encargado_zona: encName
        });
        await showAlert(res.message || '✅ Encargado de Cobro asignado con éxito.');
        await loadFicheros();
    } catch (err) {
        await showAlert('❌ Error al asignar Encargado de Cobro: ' + err.message);
    }
}

async function eliminarClienteConfirmado(id_cliente, nombre_apellido) {
    if (!await showConfirm(`⚠️ ¿Está seguro que desea eliminar al cliente "${nombre_apellido}"?\n\nEsta acción eliminará al cliente, sus ficheros de venta y su historial de cuotas asociadas.`)) {
        return;
    }

    try {
        const res = await api.delete(`/empresa/clientes/${id_cliente}`);
        if (res.success) {
            await showAlert(`✅ ${res.message}`);
            await loadClientesAndMap();
            await loadEmpresaDashboard();
        }
    } catch (err) {
        await showAlert('❌ Error al eliminar cliente: ' + err.message);
    }
}

async function eliminarFicheroConfirmado(id_fichero, producto_nombre) {
    if (!await showConfirm(`⚠️ ¿Está seguro que desea eliminar el Fichero #${id_fichero} ("${producto_nombre}")?\n\nEsta acción borrará la venta y su historial de casilleros.`)) {
        return;
    }

    try {
        const res = await api.delete(`/empresa/ficheros/${id_fichero}`);
        if (res.success) {
            await showAlert(`✅ ${res.message}`);
            await loadFicheros();
            await loadEmpresaDashboard();
        }
    } catch (err) {
        await showAlert('❌ Error al eliminar fichero: ' + err.message);
    }
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
        encargado_zona: 'Sin asignar',
        id_cobrador_asignado: null,
        fecha_entrega: document.getElementById('new-fich-fecha').value || new Date().toISOString().split('T')[0],
        cuotas_ya_pagadas: parseInt(document.getElementById('new-fich-ya-pagadas')?.value || 0, 10)
    };

    try {
        const res = await api.post('/empresa/ficheros', payload);
        await showAlert(res.message);
        document.getElementById('modal-new-fichero').classList.add('hidden');
        document.getElementById('form-new-fichero').reset();
        await loadFicheros();
        await loadEmpresaDashboard();
        switchEmpresaTab('ficheros');
    } catch (err) {
        await showAlert('Error al crear fichero: ' + err.message);
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
    window.currentCobradoresCache = cobradores;

    // Poblar filtro del mapa por cobrador
    const selectFilter = document.getElementById('select-filter-route-map');
    if (selectFilter) {
        selectFilter.innerHTML = '<option value="ALL">📍 Ver Todo el Personal</option>';
        cobradores.forEach(cb => {
            selectFilter.innerHTML += `<option value="${cb.id_usuario}">🛵 ${cb.nombre} (${cb.zona_asignada})</option>`;
        });
    }

    // Poblar filtro por barrio en Solapa 4
    const selectBarrio = document.getElementById('select-filter-route-barrio');
    if (selectBarrio) {
        const barrios = [...new Set(ficheros.map(f => f.barrio).filter(Boolean))].sort();
        selectBarrio.innerHTML = '<option value="ALL">📍 Todas las Zonas / Barrios</option>';
        barrios.forEach(b => {
            selectBarrio.innerHTML += `<option value="${b}">🏘️ ${b}</option>`;
        });
    }

    filtrarRutasPorBarrioYTexto();
}

function filtrarRutasPorBarrioYTexto() {
    if (!window.currentFicherosCache || !window.currentCobradoresCache) return;

    const queryStr = (document.getElementById('input-search-rutas')?.value || '').toLowerCase().trim();
    const selectedBarrio = document.getElementById('select-filter-route-barrio')?.value || 'ALL';

    const filtered = window.currentFicherosCache.filter(f => {
        const matchBarrio = selectedBarrio === 'ALL' || (f.barrio && f.barrio.toLowerCase() === selectedBarrio.toLowerCase());
        const fullText = `${f.cliente_nombre} ${f.direccion} ${f.barrio} ${f.producto_nombre} ${f.cobrador_nombre || ''}`.toLowerCase();
        const matchText = !queryStr || fullText.includes(queryStr);
        return matchBarrio && matchText;
    });

    renderAsignacionTable(filtered, window.currentCobradoresCache);
    drawRouteMap(filtered);
}

function formatFechaSimple(dateStr) {
    if (!dateStr) return '';
    try {
        const str = String(dateStr).trim();
        const matches = str.match(/^(\d{4})[/-](\d{2})[/-](\d{2})/);
        if (matches) {
            const yy = matches[1].slice(-2);
            const mm = matches[2];
            const dd = matches[3];
            return `${dd}/${mm}/${yy}`;
        }
        const matchesAlt = str.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
        if (matchesAlt) {
            const dd = matchesAlt[1];
            const mm = matchesAlt[2];
            const yy = matchesAlt[3].slice(-2);
            return `${dd}/${mm}/${yy}`;
        }
    } catch (e) {}
    return dateStr;
}

function renderAsignacionTable(ficheros, cobradores) {
    const tbody = document.getElementById('tbody-asignacion');
    if (!tbody) return;
    tbody.innerHTML = '';

    const activos = ficheros.filter(f => f.estado === 'ACTIVO');
    if (activos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No se encontraron visitas para esta búsqueda o zona.</td></tr>`;
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

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dd = String(tomorrow.getDate()).padStart(2, '0');
        const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
        const yy = String(tomorrow.getFullYear()).slice(-2);
        const fechaRecordatorio = `${dd}/${mm}/${yy}`;

        const cleanPhone = (f.cliente_telefono || '').replace(/\D/g, '');
        const waMsg = `Hola *${f.cliente_nombre}*, te recordamos que el cobrador pasará a cobrar tu cuota de *${f.producto_nombre}* el día *${fechaRecordatorio}*. ¡Muchas gracias!`;
        const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waMsg)}` : '#';

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
                ${f.pagado_hoy > 0 ? `<div style="margin-top:4px;"><span class="badge badge-success" style="font-size:0.72rem; font-weight:700; background-color: var(--success); color: white;">✅ Pago cuota del mes: ${formatDateTimeStr(f.fecha_pago_hoy)}</span></div>` : ''}
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
            <td>
                <div style="font-weight: 600;">${f.cliente_telefono || '<span class="text-muted">Sin número</span>'}</div>
                ${cleanPhone ? `
                <a href="${waUrl}" target="_blank" class="btn" style="background-color: #25D366; color: white; padding: 0.25rem 0.5rem; border-radius: 6px; text-decoration: none; font-size: 0.75rem; display: inline-flex; align-items: center; gap: 4px; font-weight: 600; margin-top: 4px;">
                    💬 Recordatorio
                </a>` : ''}
            </td>
            <td>
                <strong>${f.referencia_domicilio || '<span class="text-muted">No especificada</span>'}</strong>
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
        await showAlert(res.message);
        loadAsignacionRutas();
    } catch (err) {
        await showAlert('Error asignando cobrador: ' + err.message);
    }
}

async function updateFicheroOrden(id_fichero, nuevoOrden) {
    try {
        const res = await api.put(`/empresa/ficheros/${id_fichero}/orden`, { orden_visita: parseInt(nuevoOrden) || 0 });
        console.log('Orden guardado:', res.message);

        if (window.currentFicherosCache) {
            const fIdx = window.currentFicherosCache.findIndex(x => x.id_fichero === id_fichero);
            if (fIdx >= 0) {
                window.currentFicherosCache[fIdx].orden_visita = parseInt(nuevoOrden) || 0;
            }
        }
        filtrarRutasPorBarrioYTexto();
    } catch (err) {
        await showAlert('Error guardando prioridad de ruta: ' + err.message);
    }
}

function drawRouteMap(customFicherosList) {
    const container = document.getElementById('route-map-container');
    if (!container || !window.L) return;

    if (!routeMapInstance) {
        routeMapInstance = L.map('route-map-container').setView([-34.62, -58.45], 11);

        // Capa Esri World Street Map HD para mapa secuencial de rutas
        const esriStreet = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Powered by Esri'
        });
        const esriSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Imagery &copy; Esri'
        });
        const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        });

        esriStreet.addTo(routeMapInstance);

        L.control.layers({
            "🗺️ Callejero HD (Esri)": esriStreet,
            "🛰️ Satelital HD (Esri)": esriSat,
            "🌐 OpenStreetMap": osm
        }).addTo(routeMapInstance);
    }

    // Limpiar previo
    routeMapMarkers.forEach(m => routeMapInstance.removeLayer(m));
    routeMapMarkers = [];
    routeMapLines.forEach(l => routeMapInstance.removeLayer(l));
    routeMapLines = [];

    const selectedCobId = document.getElementById('select-filter-route-map')?.value || 'ALL';
    const targetFicheros = customFicherosList || window.currentFicherosCache;
    if (!targetFicheros) return;

    const coordsMap = {};
    targetFicheros.forEach(f => {
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
    try {
        const audit = await api.get('/empresa/auditoria');
        window.currentAuditCache = audit; // Guardamos en caché para exportación
        renderAuditSummary(audit && audit.cierres_cobrador ? audit.cierres_cobrador : []);
        renderAuditDetails(audit && audit.cobros_detallados ? audit.cobros_detallados : []);
    } catch (err) {
        console.error('Error al cargar auditoría de caja:', err);
        renderAuditSummary([]);
        renderAuditDetails([]);
    }
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

        let fechaStr = '-';
        if (q.fecha_pago) {
            fechaStr = formatDateTimeStr(q.fecha_pago);
        }

        const notasStr = q.notas ? `<div style="font-size:0.75rem; color:#854d0e; font-weight:600; margin-top:3px; background: #fef9c3; padding: 2px 6px; border-radius: 4px; display: inline-block;">📝 Cobrador: ${q.notas}</div>` : '';
        tr.innerHTML = `
            <td><strong>${fechaStr}</strong></td>
            <td>
                <strong>${q.cliente_nombre}</strong> (${q.barrio})
                ${notasStr}
            </td>
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
        const ranking = data.ranking_clientes || data.ranking_morosidad || [];

        const tbodyProm = document.getElementById('tbody-promesas-list');
        if (tbodyProm) {
            tbodyProm.innerHTML = '';
            if (promesas.length === 0) {
                tbodyProm.innerHTML = `<tr><td colspan="4" class="text-center text-muted">🎉 No hay promesas de pago pendientes.</td></tr>`;
            } else {
                promesas.forEach(p => {
                    const tr = document.createElement('tr');
                    const fechaProm = p.promesa_pago_fecha ? formatDateTimeStr(p.promesa_pago_fecha) : 'Sin fecha';
                    const nombreCli = p.cliente_nombre || p.nombre_apellido || 'Cliente';
                    tr.innerHTML = `
                        <td><strong style="color:#d97706;">📅 ${fechaProm}</strong></td>
                        <td><strong>${nombreCli}</strong><br><span style="font-size:0.75rem; color:var(--text-secondary);">${p.barrio || ''} (${p.telefono || 'Sin tel'})</span></td>
                        <td>Fichero #${p.id_fichero}<br><strong>Cuota #${p.nro_cuota} ($${Number(p.monto).toLocaleString('es-AR')})</strong></td>
                        <td><span class="badge badge-danger" style="font-size:0.72rem;">${p.motivo_no_cobro || 'NO COBRADO'}</span><br><span style="font-size:0.75rem; color:var(--text-secondary);">Cobrador: ${p.cobrador_nombre || p.nombre_cobrador || 'Calle'}</span></td>
                    `;
                    tbodyProm.appendChild(tr);
                });
            }
        }

        const tbodyRank = document.getElementById('tbody-ranking-clientes');
        if (tbodyRank) {
            tbodyRank.innerHTML = '';
            if (ranking.length === 0) {
                tbodyRank.innerHTML = `<tr><td colspan="4" class="text-center text-muted">Ningún cliente registra postergaciones reiteradas.</td></tr>`;
            } else {
                ranking.forEach(r => {
                    const tr = document.createElement('tr');
                    const countPostergaciones = r.total_postergaciones || r.postergaciones || 0;
                    tr.innerHTML = `
                        <td><strong>${r.nombre_apellido}</strong><br><span style="font-size:0.75rem; color:var(--text-secondary);">📞 ${r.telefono || 'Sin tel'}</span></td>
                        <td><span class="badge badge-purple">${r.barrio}</span></td>
                        <td><span class="badge badge-success">${r.calificacion || 'BUENO'}</span></td>
                        <td><span class="badge badge-danger" style="font-size:0.85rem; font-weight:800;">🚨 ${countPostergaciones} rechazos / promesas</span></td>
                    `;
                    tbodyRank.appendChild(tr);
                });
            }
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
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!notifs || notifs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Aún no se han generado notificaciones automáticas por WhatsApp en este turno.</td></tr>`;
            return;
        }

        notifs.forEach(w => {
            const tr = document.createElement('tr');
            const rawFecha = w.fecha_envio || w.fecha;
            const fechaStr = rawFecha ? new Date(rawFecha).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '-';
            const telStr = w.telefono || w.telefono_cliente || 'Sin tel';
            tr.innerHTML = `
                <td><strong>${fechaStr}</strong></td>
                <td><strong>${w.cliente_nombre || 'Cliente'}</strong><br><span style="font-size:0.75rem; color:var(--text-secondary);">📞 ${telStr}</span></td>
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
    await Promise.all([loadVendedoresRanking(), loadCobradoresCalle(), loadEncargadosZona()]);
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

            const btnBorrarVend = v.id_usuario
                ? `<button class="btn btn-danger" style="padding:0.35rem 0.65rem; font-size:0.75rem;" onclick="eliminarEmpleadoConfirmado(${v.id_usuario}, '${v.nombre}', 'VENDEDOR')" title="Eliminar Vendedor">🗑️ Eliminar</button>`
                : '';

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
                        <div class="flex gap-1 items-center">
                            ${btnBloqueo}
                            ${btnBorrarVend}
                        </div>
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
        await showAlert(res.message || 'Vendedor dado de alta exitosamente');
        document.getElementById('form-new-vendedor').reset();
        loadVendedoresRanking();
        loadFicheros();
    } catch (err) {
        await showAlert('Error al crear vendedor: ' + err.message);
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
                            <button class="btn btn-danger" style="padding:0.35rem 0.6rem; font-size:0.78rem;" onclick="eliminarEmpleadoConfirmado(${cb.id_usuario}, '${cb.nombre}', 'COBRADOR')" title="Eliminar Cobrador de la plantilla">
                                🗑️ Eliminar
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

async function eliminarEmpleadoConfirmado(id_usuario, nombre, tipo) {
    const rolTexto = tipo === 'VENDEDOR' ? 'al vendedor' : (tipo === 'COBRADOR' ? 'al cobrador' : 'al encargado');
    if (!await showConfirm(`⚠️ ¿Está seguro que desea eliminar ${rolTexto} "${nombre}"?\n\nEl empleado perderá su acceso a la plataforma.`)) {
        return;
    }

    try {
        const res = await api.delete(`/empresa/usuarios/${id_usuario}`);
        if (res.success) {
            await showAlert(`✅ ${res.message}`);
            await loadPersonal();
            await loadEmpresaDashboard();
        }
    } catch (err) {
        await showAlert('❌ Error al eliminar empleado: ' + err.message);
    }
}

async function loadEncargadosZona() {
    const tbody = document.getElementById('tbody-encargados-zona');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Cargando encargados...</td></tr>';

    try {
        const encargados = await api.get('/empresa/encargados');
        tbody.innerHTML = '';
        if (encargados.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No hay encargados registrados.</td></tr>';
            return;
        }

        encargados.forEach(enc => {
            const tr = document.createElement('tr');
            const badgeEstado = enc.activo ? '<span class="badge badge-success" style="font-size:0.7rem;">🟢 Activo</span>' : '<span class="badge badge-danger" style="font-size:0.7rem;">🔴 Bloqueado</span>';
            const btnBloqueo = `<button class="btn ${enc.activo ? 'btn-danger' : 'btn-success'}" style="padding:0.35rem 0.65rem; font-size:0.78rem;" onclick="toggleActivoEmpleado(${enc.id_usuario}, '${enc.nombre}')">${enc.activo ? '🛑 Bloquear' : '🟢 Desbloquear'}</button>`;

            tr.innerHTML = `
                <td>
                    <strong>👤 ${enc.nombre}</strong> ${badgeEstado}
                    <div style="font-size:0.75rem; color:var(--text-muted);">${enc.email}</div>
                </td>
                <td>
                    <strong>📍 ${enc.zona_asignada || 'General'}</strong>
                </td>
                <td>
                    <div style="font-size:0.75rem; color:var(--text-secondary);">📞 ${enc.telefono || '-'}</div>
                </td>
                <td>
                    ${enc.activo ? '<span style="color:#10b981; font-weight:700;">Habilitado</span>' : '<span style="color:#ef4444; font-weight:700;">Inactivo</span>'}
                </td>
                <td>
                    <div class="flex gap-1">
                        ${btnBloqueo}
                        <button class="btn btn-warning" style="padding:0.35rem 0.65rem; font-size:0.78rem;" onclick="resetPasswordEmpleado(${enc.id_usuario}, '${enc.nombre}')" title="Resetear contraseña">
                            🔑 Reset Clave
                        </button>
                        <button class="btn btn-danger" style="padding:0.35rem 0.65rem; font-size:0.78rem;" onclick="eliminarEmpleadoConfirmado(${enc.id_usuario}, '${enc.nombre}', 'ENCARGADO_ZONA')" title="Eliminar encargado">
                            🗑️ Eliminar
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Error cargando encargados zona:', err);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error al cargar encargados.</td></tr>';
    }
}

async function submitNewEncargadoForm(event) {
    event.preventDefault();
    const nombre = document.getElementById('new-enc-nombre').value;
    const email = document.getElementById('new-enc-email').value;
    const password = document.getElementById('new-enc-pass').value;
    const telefono = document.getElementById('new-enc-tel').value;
    const zona_asignada = document.getElementById('new-enc-zona').value;

    try {
        const res = await api.post('/empresa/encargados', { nombre, email, password, telefono, zona_asignada });
        await showAlert(res.message || 'Encargado de Cobro registrado exitosamente.');
        document.getElementById('form-new-encargado').reset();
        loadEncargadosZona();
    } catch (err) {
        await showAlert('Error al crear encargado: ' + err.message);
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
        await showAlert(res.message || 'Cobrador dado de alta exitosamente');
        document.getElementById('form-new-cobrador').reset();
        loadCobradoresCalle();
    } catch (err) {
        await showAlert('Error al crear cobrador: ' + err.message);
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
    if (!await showConfirm(`⚠️ ¿Estás seguro de regenerar la tarjeta QR de "${nombre}"?\n\nEl código QR viejo quedará REVOCADO e INVALIDADO inmediatamente (ante extravío o robo). Se generará uno nuevo seguro.`)) {
        return;
    }
    try {
        const res = await api.post(`/empresa/clientes/${id_cliente}/regenerar-qr`);
        await showAlert(res.message);
        loadClientesAndMap();
    } catch (err) {
        await showAlert('Error al regenerar QR: ' + err.message);
    }
}

async function toggleActivoEmpleado(id_usuario, nombre) {
    if (!await showConfirm(`⚠️ ¿Deseas cambiar el estado de acceso y bloqueo en calle para "${nombre}"?\n\nSi bloqueas a este empleado (por despido o renuncia), su sesión en la App Móvil se terminará instantáneamente y NO PODRÁ COBRAR NI UN PESO ni acceder a carteras de clientes.`)) {
        return;
    }
    try {
        const res = await api.put(`/empresa/usuarios/${id_usuario}/toggle-activo`);
        await showAlert(res.message);
        loadPersonal();
    } catch (err) {
        await showAlert('Error al cambiar estado de empleado: ' + err.message);
    }
}

async function editarClienteMudanza(id_cliente, nombre, dirActual, barrioActual, telActual, refActual) {
    const nuevaDir = prompt(`🏠 EDITAR DATOS DE "${nombre}":\n\nIngrese la nueva calle y número:`, dirActual);
    if (nuevaDir === null) return;

    const nuevoBarrio = prompt(`📍 Ingrese el Barrio o Zona:`, barrioActual);
    if (nuevoBarrio === null) return;

    const nuevoTel = prompt(`📞 Ingrese el Teléfono de contacto:`, telActual || '');
    if (nuevoTel === null) return;

    const nuevaRef = prompt(`📅 Ingrese la Fecha de Pago o Referencia (ej: 12 de cada mes):`, refActual || '');
    if (nuevaRef === null) return;

    try {
        const res = await api.put(`/empresa/clientes/${id_cliente}`, {
            direccion: nuevaDir.trim() || dirActual,
            barrio: nuevoBarrio.trim() || barrioActual,
            telefono: nuevoTel.trim() || telActual,
            referencia_domicilio: nuevaRef.trim() || refActual
        });
        await showAlert(res.message);
        loadClientesAndMap();
    } catch (err) {
        await showAlert('Error al actualizar datos del cliente: ' + err.message);
    }
}

async function resetPasswordEmpleado(id_usuario, nombre) {
    const nueva = prompt(`🔑 CAMBIO DE CONTRASEÑA REMOTO Y DESVALIDACIÓN DE SESIÓN:\n\nIngrese la nueva contraseña para "${nombre}" (por ejemplo ante robo o pérdida de celular en calle):`);
    if (!nueva || nueva.trim().length < 4) return;

    try {
        const res = await api.put(`/empresa/usuarios/${id_usuario}/reset-password`, { nueva_password: nueva.trim() });
        await showAlert(res.message);
    } catch (err) {
        await showAlert('Error al cambiar contraseña: ' + err.message);
    }
}

async function descargarBackupEmpresa() {
    try {
        const token = localStorage.getItem('hit_token');
        const res = await fetch('/api/empresa/backup', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('No se pudo generar el backup.');
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const dateStr = new Date().toISOString().split('T')[0];
        a.download = `backup_empresa_${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (err) {
        await showAlert('❌ Error descargando copia de seguridad: ' + err.message);
    }
}

async function cambiarCalificacionCliente(idCliente, nuevaCalificacion) {
    try {
        const res = await api.patch(`/empresa/clientes/${idCliente}/calificacion`, { calificacion: nuevaCalificacion });
        if (res.success) {
            // Actualizar en la caché local para no tener que recargar toda la base de datos
            if (window.currentClientesCache) {
                const cli = window.currentClientesCache.find(c => c.id_cliente === idCliente);
                if (cli) cli.calificacion = nuevaCalificacion;
            }
            await showAlert(`✅ Calificación actualizada con éxito a ${nuevaCalificacion}.`);
            // Recargar para aplicar los estilos de color
            if (window.currentClientesCache) {
                renderClientesTable(window.currentClientesCache);
            }
        }
    } catch (err) {
        await showAlert('❌ Error al actualizar calificación: ' + err.message);
        // Recargar la tabla para restaurar el valor anterior
        if (window.currentClientesCache) {
            renderClientesTable(window.currentClientesCache);
        }
    }
}

async function buscarClientePorIdODni() {
    const searchVal = document.getElementById('new-fich-buscar-cliente-id').value.trim();
    const infoPreview = document.getElementById('new-fich-cliente-info-preview');
    const selectCliente = document.getElementById('new-fich-cliente');

    if (!searchVal) {
        if (infoPreview) infoPreview.innerHTML = '<span style="color:#ef4444;">Por favor, ingrese un ID o DNI.</span>';
        return;
    }

    // Buscar en la caché de clientes
    const clientes = window.currentClientesCache || [];
    const clienteEncontrado = clientes.find(c => c.id_cliente.toString() === searchVal || c.dni.toString().trim() === searchVal);

    if (clienteEncontrado) {
        selectCliente.value = clienteEncontrado.id_cliente;
        if (infoPreview) {
            infoPreview.innerHTML = `✅ Cliente cargado: <strong style="color:var(--success);">${clienteEncontrado.nombre_apellido}</strong> (ID: ${clienteEncontrado.id_cliente} | DNI: ${clienteEncontrado.dni})`;
        }
    } else {
        if (infoPreview) {
            infoPreview.innerHTML = '<span style="color:#ef4444;">❌ Cliente no encontrado. Verifique el ID o DNI en la tabla de clientes.</span>';
        }
        selectCliente.value = "";
    }
}

// SOLAPA 8: CONTROL OPERATIVO DIARIO (RENDICIÓN ENCARGADO)
async function loadControlOperativoDiario() {
    try {
        const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }); // YYYY-MM-DD local
        const ficheros = await api.get('/empresa/ficheros') || [];
        const cobros = await api.get('/empresa/auditoria') || { cobros_detallados: [] };
        const promesasData = await api.get('/empresa/promesas') || { promesas: [] };

        const cobrosDetallados = cobros.cobros_detallados || [];
        const promesas = promesasData.promesas || [];

        // Filtrar datos según encargado_zona si el usuario tiene rol ENCARGADO_ZONA (Encargado de Cobro)
        const isEncargado = (window.currentUser && window.currentUser.rol === 'ENCARGADO_ZONA');
        const userNombre = (window.currentUser && window.currentUser.nombre) ? window.currentUser.nombre.toLowerCase() : '';

        const filterByEncargado = (item) => {
            if (!isEncargado) return true;
            const itemEnc = (item.encargado_zona || '').toLowerCase();
            return itemEnc.includes(userNombre);
        };

        const ficherosFiltrados = ficheros.filter(filterByEncargado);

        let totalAsignados = ficherosFiltrados.length;
        let totalCobrados = 0;
        let montoCobrado = 0;
        let totalPromesas = 0;
        let totalParciales = 0;
        let totalSaldoFavor = 0;

        const tbody = document.getElementById('tbody-control-operativo');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (ficherosFiltrados.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">Sin clientes ni ficheros asignados a esta zona hoy.</td></tr>`;
        } else {
            ficherosFiltrados.forEach((f, idx) => {
                const cobroFichero = cobrosDetallados.filter(c => c.id_fichero === f.id_fichero && c.fecha_pago && c.fecha_pago.startsWith(todayStr));
                const sortedCobros = [...cobroFichero].sort((a, b) => b.nro_cuota - a.nro_cuota);
                const ultimoCobro = sortedCobros.length > 0 ? sortedCobros[0] : null;
                const promesaFichero = promesas.find(p => p.id_fichero === f.id_fichero);

                let estadoHtml = `<span class="badge badge-warning">PENDIENTE</span>`;
                let montoStr = `$0`;
                let saldoStr = `$${Number(f.valor_cuota || 0).toLocaleString('es-AR')}`;
                let proxNota = `Prioridad #${f.orden_visita || (idx + 1)}`;

                if (ultimoCobro) {
                    if (ultimoCobro.estado === 'PAGADO') {
                        const paidCuotasHoy = cobroFichero.filter(c => c.estado === 'PAGADO');
                        totalCobrados += paidCuotasHoy.length;
                        const sumaMontoHoy = paidCuotasHoy.reduce((sum, c) => sum + Number(c.monto || 0), 0);
                        montoCobrado += sumaMontoHoy;
                        montoStr = `$${Number(sumaMontoHoy).toLocaleString('es-AR')}`;

                        // Extraer tags de descuento aplicado, deuda cubierta, saldo a favor generado, nueva deuda generada en las notas
                        let descuentoAplicado = 0;
                        let deudaCubierta = 0;
                        if (ultimoCobro.notas) {
                            const matchDesc = ultimoCobro.notas.match(/\[DESCUENTO_APLICADO:(\d+(\.\d+)?)\]/);
                            if (matchDesc) descuentoAplicado = parseFloat(matchDesc[1]) || 0;
                            
                            const matchDeuda = ultimoCobro.notas.match(/\[DEUDA_CUBIERTA:(\d+(\.\d+)?)\]/);
                            if (matchDeuda) deudaCubierta = parseFloat(matchDeuda[1]) || 0;
                        }

                        const totalAcreditado = Number(ultimoCobro.monto || 0) + descuentoAplicado - deudaCubierta;

                        if (totalAcreditado > Number(f.valor_cuota || 0)) {
                            const favor = totalAcreditado - Number(f.valor_cuota);
                            totalSaldoFavor += favor;
                            estadoHtml = `<span class="badge badge-success">✅ PAGADO + SALDO A FAVOR</span>`;
                            saldoStr = `<strong style="color:var(--success);">+$${favor.toLocaleString('es-AR')} a favor</strong>`;
                        } else if (totalAcreditado < Number(f.valor_cuota || 0) && totalAcreditado > 0) {
                            totalParciales++;
                            const resto = Number(f.valor_cuota) - totalAcreditado;
                            estadoHtml = `<span class="badge badge-purple">💵 PAGO PARCIAL</span>`;
                            saldoStr = `<strong style="color:#d97706;">Resta $${resto.toLocaleString('es-AR')}</strong>`;
                        } else {
                            estadoHtml = `<span class="badge badge-success">✅ PAGADO COMPLETO</span>`;
                            saldoStr = `$0 al día`;
                        }
                    } else if (ultimoCobro.estado === 'NO_COBRADO') {
                        totalPromesas++;
                        estadoHtml = `<span class="badge badge-danger">❌ NO COBRADO</span>`;
                        proxNota = `Motivo: ${ultimoCobro.motivo_no_cobro || 'Ausente'}`;
                    }

                    if (ultimoCobro.notas) {
                        let displayNotas = ultimoCobro.notas
                            .replace(/\[DESCUENTO_APLICADO:\d+(\.\d+)?\]/g, '')
                            .replace(/\[SALDO_A_FAVOR_GENERADO:\d+(\.\d+)?\]/g, '')
                            .replace(/\[DEUDA_CUBIERTA:\d+(\.\d+)?\]/g, '')
                            .replace(/\[NUEVA_DEUDA_GENERADA:\d+(\.\d+)?\]/g, '')
                            .trim();
                        if (displayNotas) {
                            proxNota += `<br><span style="color:#854d0e; font-weight:600;">📝 Cobrador: ${displayNotas}</span>`;
                        }
                    }
                } else if (promesaFichero) {
                    totalPromesas++;
                    estadoHtml = `<span class="badge badge-orange">📅 PROMESA PAGO</span>`;
                    proxNota = `Promesa: ${promesaFichero.promesa_pago_fecha ? new Date(promesaFichero.promesa_pago_fecha).toLocaleDateString() : 'Pendiente'}`;
                }

                const refStr = f.referencia_domicilio ? `<br><span style="font-size:0.75rem; color:#d97706; font-weight:600;">🏠 Ref: ${f.referencia_domicilio}</span>` : '';
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>#${f.id_fichero}</strong> — ${f.cliente_nombre || 'Cliente'}${refStr}</td>
                    <td>📍 ${f.direccion || ''} <br><span style="font-size:0.75rem; color:var(--text-secondary);">${f.barrio || ''}</span></td>
                    <td>🛵 <strong>${f.cobrador_nombre || f.encargado_zona || 'Sin Asignar'}</strong></td>
                    <td>${estadoHtml}</td>
                    <td><strong>${montoStr}</strong></td>
                    <td>${saldoStr}</td>
                    <td style="font-size:0.8rem; color:var(--text-secondary);">${proxNota}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        // Actualizar métricas del DOM
        const elAsig = document.getElementById('op-total-asignados');
        if (elAsig) elAsig.innerText = totalAsignados;
        const elCob = document.getElementById('op-total-cobrados');
        if (elCob) elCob.innerText = totalCobrados;
        const elMonto = document.getElementById('op-monto-cobrado');
        if (elMonto) elMonto.innerText = `$${montoCobrado.toLocaleString('es-AR')} ARS`;
        const elProm = document.getElementById('op-total-promesas');
        if (elProm) elProm.innerText = totalPromesas;
        const elParc = document.getElementById('op-total-parciales');
        if (elParc) elParc.innerText = totalParciales;
        const elFav = document.getElementById('op-total-saldofavor');
        if (elFav) elFav.innerText = `$${totalSaldoFavor.toLocaleString('es-AR')} ARS`;

    } catch (err) {
        console.error('Error cargando control operativo diario:', err);
    }
}

window.loadControlOperativoDiario = loadControlOperativoDiario;
window.cambiarCalificacionCliente = cambiarCalificacionCliente;
window.buscarClientePorIdODni = buscarClientePorIdODni;
window.initEmpresaPanel = initEmpresaPanel;
window.descargarBackupEmpresa = descargarBackupEmpresa;

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
window.submitNewEncargadoForm = submitNewEncargadoForm;
window.loadEncargadosZona = loadEncargadosZona;
window.enviarLugaresCobroWhatsapp = enviarLugaresCobroWhatsapp;
window.regenerarQrCliente = regenerarQrCliente;
window.toggleActivoEmpleado = toggleActivoEmpleado;
window.editarClienteMudanza = editarClienteMudanza;
window.resetPasswordEmpleado = resetPasswordEmpleado;
window.updateFicheroOrden = updateFicheroOrden;
window.cambiarEncargadoFichero = cambiarEncargadoFichero;
window.drawRouteMap = drawRouteMap;
window.openNewClienteModal = openNewClienteModal;
window.verificarDireccionEnMapa = verificarDireccionEnMapa;
window.focusClientOnMap = focusClientOnMap;

// ==========================================
// EXPORTACIÓN A CSV (EXCEL LOCAL)
// ==========================================
function exportToCSV(filename, headers, rows) {
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(val => {
            const escaped = ('' + (val ?? '')).replace(/"/g, '""');
            return `"${escaped}"`;
        }).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportarClientesCSV() {
    const clientes = window.currentClientesCache || [];
    if (clientes.length === 0) {
        showAlert('No hay clientes cargados para exportar.');
        return;
    }
    const headers = ['ID Cliente', 'Nombre y Apellido', 'DNI', 'Telefono', 'Direccion', 'Barrio', 'Piso/Depto', 'Fecha de Pago (Ref)', 'Calificacion', 'Encargado de Zona', 'Fecha de Alta'];
    const rows = clientes.map(c => [
        c.id_cliente,
        c.nombre_apellido,
        c.dni,
        c.telefono,
        c.direccion,
        c.barrio,
        c.piso_dpto,
        c.referencia_domicilio,
        c.calificacion,
        c.encargado_zona,
        c.fecha_alta
    ]);
    const dateStr = new Date().toISOString().split('T')[0];
    exportToCSV(`reporte_clientes_${dateStr}.csv`, headers, rows);
}

function exportarFicherosCSV() {
    const ficheros = window.currentFicherosCache || [];
    if (ficheros.length === 0) {
        showAlert('No hay ficheros de venta cargados para exportar.');
        return;
    }
    const headers = ['ID Fichero', 'ID Cliente', 'Cliente', 'Producto', 'Cantidad Cuotas', 'Valor Cuota', 'Monto Total', 'Cuotas Pagadas', 'Cuotas Pendientes', 'Cobrador Asignado', 'Encargado/Zona', 'Fecha de Entrega', 'Estado', 'Fecha de Creacion'];
    const rows = ficheros.map(f => [
        f.id_fichero,
        f.id_cliente,
        f.cliente_nombre,
        f.producto_nombre,
        f.cantidad_cuotas,
        f.valor_cuota,
        f.monto_total,
        f.cuotas_pagadas,
        f.cuotas_pendientes,
        f.cobrador_nombre,
        f.encargado_zona,
        f.fecha_entrega,
        f.estado,
        f.fecha_creacion
    ]);
    const dateStr = new Date().toISOString().split('T')[0];
    exportToCSV(`reporte_ficheros_${dateStr}.csv`, headers, rows);
}

function exportarCierresCajaCSV() {
    const audit = window.currentAuditCache;
    const cierres = audit && audit.cierres_cobrador ? audit.cierres_cobrador : [];
    if (cierres.length === 0) {
        showAlert('No hay cierres de caja registrados para exportar hoy.');
        return;
    }
    const headers = ['Cobrador', 'Zona Asignada', 'Efectivo en Mano', 'Transferencias', 'Cantidad Cobros', 'Visitas Rechazadas'];
    const rows = cierres.map(c => [
        c.cobrador_nombre,
        c.zona_asignada,
        c.recaudado_efectivo,
        c.recaudado_transferencia,
        c.cobros_realizados,
        c.visitas_no_cobradas
    ]);
    const dateStr = new Date().toISOString().split('T')[0];
    exportToCSV(`reporte_cierre_caja_${dateStr}.csv`, headers, rows);
}

// ==========================================
// RESTAURACIÓN DE COPIA DE SEGURIDAD (JSON)
// ==========================================
function triggerRestoreUpload() {
    const fileInput = document.getElementById('restore-file-input');
    if (fileInput) fileInput.click();
}

function procesarRestoreBackup(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const backupObj = JSON.parse(e.target.result);

            // Validar que sea un archivo de backup de HIT válido
            if (!backupObj.clientes || !backupObj.ficheros || !backupObj.cuotas) {
                await showAlert('❌ Archivo de copia de seguridad inválido. Debe contener clientes, ficheros y cuotas.');
                return;
            }

            const totalClientes = backupObj.clientes.length;
            const totalFicheros = backupObj.ficheros.length;

            const confirmacion = await showConfirm(
                `¿Estás absolutamente seguro de restaurar esta copia de seguridad?\n\n` +
                `⚠️ ADVERTENCIA: Esta acción BORRARÁ permanentemente todos los clientes, ficheros, cuotas y cierres de caja actuales en la aplicación y los reemplazará con los de este archivo.\n\n` +
                `Registros a restaurar:\n` +
                `- Clientes: ${totalClientes}\n` +
                `- Ficheros: ${totalFicheros}\n` +
                `- Fecha de Exportación: ${backupObj.fecha_exportacion || 'Desconocida'}`
            );

            if (!confirmacion) {
                event.target.value = '';
                return;
            }

            const token = localStorage.getItem('hit_token');
            const res = await fetch('/api/empresa/restore', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ backup: backupObj })
            });

            if (!res.ok) {
                let errMsg = 'Error del servidor al restaurar.';
                try {
                    const errData = await res.json();
                    errMsg = errData.error || errMsg;
                } catch (e) {
                    try {
                        const text = await res.text();
                        if (text) {
                            // Extraer texto legible si es una página HTML de error
                            const match = text.match(/<pre>([\s\S]*?)<\/pre>/i) || text.match(/<h1>([\s\S]*?)<\/h1>/i);
                            errMsg = match ? match[1].trim() : text.substring(0, 200);
                        }
                    } catch (e2) { }
                }
                throw new Error(errMsg);
            }

            const data = await res.json();
            await showAlert('✅ ' + data.message);
            window.location.reload();

        } catch (err) {
            await showAlert('❌ Error al restaurar la copia de seguridad: ' + err.message);
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsText(file);
}

// Exponer funciones utilitarias en window
window.exportarClientesCSV = exportarClientesCSV;
window.exportarFicherosCSV = exportarFicherosCSV;
window.exportarCierresCajaCSV = exportarCierresCajaCSV;
window.triggerRestoreUpload = triggerRestoreUpload;
window.procesarRestoreBackup = procesarRestoreBackup;

async function resetAsignacionesMensual() {
    const confirm = window.confirm("⚠️ ¿Está seguro de que desea reiniciar todas las asignaciones del mes? Esto desasignará a los cobradores y encargados de todos los ficheros.");
    if (!confirm) return;

    try {
        const res = await api.post('/empresa/reset-asignaciones-mensual');
        await showAlert(res.message || '✅ Asignaciones reiniciadas con éxito.');
        await loadAsignacionRutas();
    } catch (err) {
        console.error('Error al reiniciar asignaciones:', err);
        await showAlert(err.message || '❌ Error al reiniciar asignaciones.');
    }
}

async function registrarCierreJornada() {
    const confirm = window.confirm("¿Está seguro de que desea registrar el cierre de caja de hoy? Esto consolidará las métricas de cobro actuales.");
    if (!confirm) return;

    const obs = window.prompt("Ingrese observaciones o notas adicionales sobre el cierre de hoy (opcional):", "");
    if (obs === null) return; // cancelado

    try {
        const res = await api.post('/empresa/caja-cierre', { observaciones: obs });
        await showAlert(res.message || '✅ Cierre de caja registrado correctamente.');
        await loadControlOperativoDiario();
        await cargarHistorialCierres();
    } catch (err) {
        console.error('Error al registrar cierre:', err);
        await showAlert(err.message || '❌ Error al registrar cierre de caja.');
    }
}

async function cargarHistorialCierres() {
    try {
        const cierres = await api.get('/empresa/cierres-historial') || [];
        window.currentCierresHistorialCache = cierres;

        const tbody = document.getElementById('tbody-historial-cierres');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (cierres.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">Aún no se han registrado cierres de caja consolidados.</td></tr>`;
            return;
        }

        cierres.forEach(c => {
            const dateObj = new Date(c.fecha_caja);
            const weekStr = getWeekNumber(dateObj);

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="badge badge-purple" style="font-weight: 700;">${weekStr}</span></td>
                <td><strong>${formatFechaSimple(c.fecha_caja)}</strong></td>
                <td>
                    <strong>🛵 ${c.cobrador_nombre}</strong>
                    <div style="font-size:0.75rem; color:var(--text-muted);">${c.zona_asignada || 'General'}</div>
                </td>
                <td><strong>$${Number(c.total_efectivo || 0).toLocaleString('es-AR')}</strong></td>
                <td><strong>$${Number(c.total_transferencias || 0).toLocaleString('es-AR')}</strong></td>
                <td><span class="badge badge-success">${c.cantidad_cobros || 0} cuotas</span></td>
                <td style="font-size:0.8rem; color:var(--text-secondary); max-width: 250px; white-space: normal; word-break: break-word;">
                    ${c.observaciones || '<span class="text-muted">—</span>'}
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error('Error al cargar historial de cierres:', err);
    }
}

function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function exportarHistorialCierresCSV() {
    const cierres = window.currentCierresHistorialCache || [];
    if (cierres.length === 0) {
        showAlert('No hay historial de cierres registrado para exportar.');
        return;
    }
    const headers = ['Semana ISO', 'Fecha Cierre', 'Cobrador', 'Zona', 'Efectivo Rendido', 'Transferencias', 'Cant. Cobros', 'Observaciones'];
    const rows = cierres.map(c => {
        const dateObj = new Date(c.fecha_caja);
        const weekStr = getWeekNumber(dateObj);
        return [
            weekStr,
            c.fecha_caja,
            c.cobrador_nombre,
            c.zona_asignada || 'General',
            c.total_efectivo || 0,
            c.total_transferencias || 0,
            c.cantidad_cobros || 0,
            c.observaciones || ''
        ];
    });
    const dateStr = new Date().toISOString().split('T')[0];
    exportToCSV(`historial_cierres_caja_${dateStr}.csv`, headers, rows);
}

// Exponer en window
window.resetAsignacionesMensual = resetAsignacionesMensual;
window.registrarCierreJornada = registrarCierreJornada;
window.cargarHistorialCierres = cargarHistorialCierres;
window.exportarHistorialCierresCSV = exportarHistorialCierresCSV;

function filtrarFicheros(resetPage = true) {
    if (!window.currentFicherosListCache) return;

    if (resetPage) {
        window.ficherosPage = 1;
    }

    const queryStr = (document.getElementById('input-search-ficheros')?.value || '').toLowerCase().trim();
    const selectedEstado = document.getElementById('select-filter-ficheros-estado')?.value || 'ALL';

    const filtered = window.currentFicherosListCache.filter(f => {
        const matchEstado = selectedEstado === 'ALL' || f.estado === selectedEstado;
        const fullText = `${f.id_fichero} ${f.cliente_nombre} ${f.direccion} ${f.barrio} ${f.producto_nombre} ${f.encargado_zona || ''}`.toLowerCase();
        const matchText = !queryStr || fullText.includes(queryStr);
        return matchEstado && matchText;
    });

    renderFicherosTable(filtered);
}

window.filtrarFicheros = filtrarFicheros;
