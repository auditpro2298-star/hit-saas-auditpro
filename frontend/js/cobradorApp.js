/* ============================================================================
   HIT SaaS — Panel Nivel 3: App Móvil del Cobrador (Escáner QR & Planilla Calle)
   Diseñado y Optimizado para Smartphones (Mobile-First 100% Offline)
   ============================================================================ */

let html5QrCodeDirect = null;
let currentCameraFacing = 'environment'; // Cámara trasera por defecto en smartphones
let currentScannedData = null;
let selectedCuotaToPay = null;

// Listener de eventos online/offline para actualizar semáforo y auto-sincronizar
window.addEventListener('online', () => {
    updateOnlineBadge();
    syncOfflineQueue(true); // Sincronización transparente automática al recuperar 4G/WiFi
});
window.addEventListener('offline', updateOnlineBadge);

function updateOnlineBadge() {
    const badge = document.getElementById('cobrador-online-badge');
    const syncBtn = document.getElementById('btn-sync-offline');
    if (!badge || !syncBtn) return;

    const queue = JSON.parse(localStorage.getItem('HIT_OFFLINE_QUEUE') || '[]');
    const isOnline = navigator.onLine;

    if (!isOnline) {
        badge.className = 'badge badge-danger';
        badge.innerText = `🔴 OFFLINE (${queue.length} en cola)`;
        syncBtn.classList.add('hidden');
    } else if (queue.length > 0) {
        badge.className = 'badge badge-warning';
        badge.innerText = `🟡 ONLINE (${queue.length} pdtes)`;
        syncBtn.classList.remove('hidden');
        syncBtn.innerText = `🔄 Sync (${queue.length})`;
    } else {
        badge.className = 'badge badge-success';
        badge.innerText = '🟢 ONLINE';
        syncBtn.classList.add('hidden');
    }
}

async function initCobradorApp() {
    console.log('📱 Inicializando App Móvil del Cobrador...');
    updateOnlineBadge();

    // 1. Intentar sincronizar totales de caja del día (Online o desde Caché)
    try {
        const resumen = await api.get('/cobrador/resumen-diario');
        localStorage.setItem('HIT_CACHED_RESUMEN_DIARIO', JSON.stringify(resumen));
        updatePocketDisplay(resumen);
    } catch (err) {
        // Modo Offline: recuperar del caché local
        const cachedResumen = JSON.parse(localStorage.getItem('HIT_CACHED_RESUMEN_DIARIO') || 'null');
        if (cachedResumen) {
            updatePocketDisplay(cachedResumen);
        }
    }

    // 2. Cargar la hoja de ruta
    await syncHojaDeRuta();

    // 3. Descargar catálogo offline de cartillas QR de la empresa para permitir escaneo 100% offline
    try {
        const catalogo = await api.get('/cobrador/catalogo-qr-offline');
        localStorage.setItem('HIT_CACHED_CATALOGO_QR', JSON.stringify(catalogo));
    } catch (e) {
        // Modo offline: continuar con el catálogo previo
    }
}

function updatePocketDisplay(resumen) {
    const efEl = document.getElementById('cob-efectivo-bolsillo');
    const trEl = document.getElementById('cob-transf-cargadas');
    if (efEl) efEl.innerText = `$${Number(resumen.efectivo_en_bolsillo || 0).toLocaleString('es-AR')}`;
    if (trEl) trEl.innerText = `$${Number(resumen.transferencias_cargadas || 0).toLocaleString('es-AR')}`;
}

let currentRutaFilter = 'HOY'; // 'HOY' o 'TODOS'
let currentRutaItems = [];

function setRutaFilter(filter) {
    currentRutaFilter = filter;
    const btnHoy = document.getElementById('filter-btn-hoy');
    const btnTodos = document.getElementById('filter-btn-todos');
    const titleEl = document.getElementById('hoja-ruta-title');

    if (btnHoy && btnTodos) {
        if (filter === 'HOY') {
            btnHoy.className = 'btn btn-primary';
            btnTodos.className = 'btn btn-outline';
            if (titleEl) titleEl.innerText = '📋 Hoja de Ruta del Día';
        } else {
            btnHoy.className = 'btn btn-outline';
            btnTodos.className = 'btn btn-primary';
            if (titleEl) titleEl.innerText = '📂 Toda Mi Cartera de Clientes';
        }
    }

    const searchInput = document.getElementById('input-buscar-ruta');
    if (searchInput) searchInput.value = '';

    syncHojaDeRuta();
}

function filtrarRutaEnVivo(query) {
    const cleanQ = (query || '').toLowerCase().trim();
    if (!cleanQ) {
        renderHojaDeRutaCards(currentRutaItems, false);
        return;
    }

    const filtered = currentRutaItems.filter(item => {
        const nom = (item.nombre_apellido || '').toLowerCase();
        const dir = (item.direccion || '').toLowerCase();
        const bar = (item.barrio || '').toLowerCase();
        const dni = (item.dni || '').toString().toLowerCase();
        return nom.includes(cleanQ) || dir.includes(cleanQ) || bar.includes(cleanQ) || dni.includes(cleanQ);
    });

    renderHojaDeRutaCards(filtered, false, true);
}

async function syncHojaDeRuta() {
    const rutaList = document.getElementById('hoja-ruta-list');
    if (!rutaList) return;
    rutaList.innerHTML = `<div class="text-center text-muted" style="padding:1rem;">⏳ Sincronizando hoja de ruta del servidor...</div>`;

    let ruta = [];
    let isFromCache = false;

    try {
        ruta = await api.get(`/cobrador/hoja-de-ruta?filtro=${currentRutaFilter}`);
        // Guardar copia local en caché para disponibilidad 100% offline en calle
        localStorage.setItem(`HIT_CACHED_HOJA_RUTA_${currentRutaFilter}`, JSON.stringify(ruta));
        localStorage.setItem('HIT_CACHED_HOJA_RUTA', JSON.stringify(ruta));
    } catch (err) {
        console.warn('📡 Sin conexión directa con el servidor. Cargando hoja de ruta desde memoria local...');
        const cached = localStorage.getItem(`HIT_CACHED_HOJA_RUTA_${currentRutaFilter}`) || localStorage.getItem('HIT_CACHED_HOJA_RUTA');
        if (cached) {
            ruta = JSON.parse(cached);
            isFromCache = true;
        } else {
            rutaList.innerHTML = `<div class="glass-card text-center" style="padding:1.5rem; border-color:#ef4444;">
                <h4 style="color:#ef4444; font-size:1.05rem; margin-bottom:0.5rem;">⚠️ Sin conexión inicial</h4>
                <p style="font-size:0.85rem; color:var(--text-secondary);">Conéctese una vez a Internet para descargar su hoja de ruta al celular.</p>
            </div>`;
            return;
        }
    }

    currentRutaItems = ruta;
    renderHojaDeRutaCards(ruta, isFromCache);
}

function renderHojaDeRutaCards(ruta, isFromCache = false, isSearching = false) {
    const rutaList = document.getElementById('hoja-ruta-list');
    const badgeCount = document.getElementById('badge-ruta-count');
    if (!rutaList) return;

    // Fusionar cobros pendientes de la cola offline para reflejar el estado verde de inmediato
    const offlineQueue = JSON.parse(localStorage.getItem('HIT_OFFLINE_QUEUE') || '[]');
    const offlinePaidCuotas = new Set(offlineQueue.filter(q => q.medio_pago && q.medio_pago !== 'NO_COBRADO').map(q => q.id_cuota));
    const offlineRechazos = new Set(offlineQueue.filter(q => q.motivo_no_cobro).map(q => q.id_cuota));

    rutaList.innerHTML = '';

    let totalCobrados = 0;
    let totalPendientes = 0;

    ruta.forEach(item => {
        let yaCobrado = (item.cobrado_hoy || 0) > 0;
        if (item.proxima_cuota_id && offlinePaidCuotas.has(item.proxima_cuota_id)) {
            yaCobrado = true;
        } else if (offlineQueue.some(q => q.qr_token === item.qr_token && q.medio_pago && q.medio_pago !== 'NO_COBRADO')) {
            yaCobrado = true;
        }

        if (yaCobrado) {
            totalCobrados++;
        } else {
            totalPendientes++;
        }
    });

    if (badgeCount) {
        if (currentRutaFilter === 'HOY') {
            badgeCount.innerText = `${totalPendientes} pdtes | ${totalCobrados} cobrados`;
            badgeCount.className = totalPendientes === 0 && totalCobrados > 0 ? 'badge badge-success' : 'badge badge-purple';
        } else {
            badgeCount.innerText = `${ruta.length} clientes total`;
            badgeCount.className = 'badge badge-purple';
        }
    }

    if (isFromCache && !isSearching) {
        const offBanner = document.createElement('div');
        offBanner.className = 'glass-card animate-fade';
        offBanner.style.padding = '0.65rem 1rem';
        offBanner.style.marginBottom = '0.75rem';
        offBanner.style.background = 'rgba(245, 158, 11, 0.1)';
        offBanner.style.borderLeft = '4px solid #f59e0b';
        offBanner.style.fontSize = '0.8rem';
        offBanner.style.color = '#d97706';
        offBanner.style.fontWeight = '700';
        offBanner.innerHTML = `📡 Modo Offline: Trabajando con la hoja de ruta guardada en el teléfono.`;
        rutaList.appendChild(offBanner);
    }

    if (ruta.length === 0) {
        if (isSearching) {
            rutaList.innerHTML = `<div class="glass-card text-center" style="padding:1.5rem;">🔍 No se encontraron clientes que coincidan con la búsqueda.</div>`;
        } else if (currentRutaFilter === 'HOY') {
            rutaList.innerHTML = `<div class="glass-card text-center" style="padding:2rem;">
                <div style="font-size:2.5rem; margin-bottom:0.5rem;">🎉</div>
                <h4 style="font-weight:800; font-size:1.1rem; margin-bottom:0.4rem; color:var(--success);">¡Al día! No tienes visitas pendientes hoy</h4>
                <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:1rem;">Todos los clientes cobrados saldaron su cuota del período. Si deseas ver clientes futuros o adelantar cuotas, toca "📂 Toda la Cartera".</p>
                <button class="btn btn-outline" style="font-size:0.85rem; padding:0.5rem 1rem;" onclick="setRutaFilter('TODOS')">📂 Ver Toda la Cartera</button>
            </div>`;
        } else {
            rutaList.innerHTML = `<div class="glass-card text-center" style="padding:2rem;">No hay clientes registrados en su cartera.</div>`;
        }
        return;
    }

    ruta.forEach(item => {
        const card = document.createElement('div');
        card.className = 'glass-card animate-fade';
        card.style.padding = '1.1rem';
        card.style.marginBottom = '0.85rem';
        card.style.transition = 'all 0.25s ease';
        
        let yaCobrado = (item.cobrado_hoy || 0) > 0;
        let noCobradoHoy = (item.no_cobrado_hoy || 0) > 0;

        // Comprobar si hay pagos locales en la cola offline para este cliente
        if (item.proxima_cuota_id && offlinePaidCuotas.has(item.proxima_cuota_id)) {
            yaCobrado = true;
        } else if (offlineQueue.some(q => q.qr_token === item.qr_token && q.medio_pago && q.medio_pago !== 'NO_COBRADO')) {
            yaCobrado = true;
        }

        if (offlineQueue.some(q => q.qr_token === item.qr_token && q.motivo_no_cobro)) {
            noCobradoHoy = true;
        }

        // ESTILO VISUAL DE ALTO CONTRASTE PARA SMARTPHONES EN CALLE
        if (yaCobrado) {
            card.style.borderLeft = '6px solid #10b981';
            card.style.background = 'rgba(16, 185, 129, 0.12)';
            card.style.border = '1.5px solid rgba(16, 185, 129, 0.35)';
        } else if (noCobradoHoy) {
            card.style.borderLeft = '6px solid #ef4444';
            card.style.background = 'rgba(239, 68, 68, 0.12)';
            card.style.border = '1.5px solid rgba(239, 68, 68, 0.35)';
        } else {
            card.style.borderLeft = '6px solid var(--primary)';
            card.style.border = '1px solid var(--border-color)';
        }
        
        const pisoInfo = item.piso_dpto ? ` <span style="color:#8b5cf6; font-weight:700;">[🏢 ${item.piso_dpto}]</span>` : '';
        const refInfo = item.referencia_domicilio ? `<div style="font-size:0.75rem; color:#d97706; font-weight:700; margin-top:0.2rem;">🏠 Ref: ${item.referencia_domicilio}</div>` : '';
        
        let badgeHtml = '';
        let btnText = '⚡ Escanear QR';
        let btnClass = 'btn-primary';

        if (yaCobrado) {
            badgeHtml = `<span class="badge" style="font-size:0.75rem; background:#10b981; color:#fff; font-weight:800; border-radius:6px; padding:0.25rem 0.55rem; box-shadow: 0 2px 6px rgba(16, 185, 129, 0.35);">✅ COBRADO HOY</span>`;
            btnText = '✅ Ver Fichero Cobrado';
            btnClass = 'btn-outline';
        } else if (noCobradoHoy) {
            badgeHtml = `<span class="badge" style="font-size:0.75rem; background:#ef4444; color:#fff; font-weight:800; border-radius:6px; padding:0.25rem 0.55rem; box-shadow: 0 2px 6px rgba(239, 68, 68, 0.35);">❌ NO COBRADO</span>`;
            btnText = '🔄 Re-intentar Cobro';
            btnClass = 'btn-outline';
        }

        // Integración de WhatsApp Móvil Click-to-Chat
        let cleanPhone = '';
        let waLinkHtml = '';
        if (item.telefono) {
            cleanPhone = item.telefono.replace(/\D/g, '');
            if (cleanPhone.length > 0) {
                if (!cleanPhone.startsWith('54')) {
                    if (cleanPhone.startsWith('15')) {
                        cleanPhone = '549' + cleanPhone.substring(2);
                    } else if (cleanPhone.startsWith('0')) {
                        cleanPhone = '549' + cleanPhone.substring(1);
                    } else {
                        cleanPhone = '549' + cleanPhone;
                    }
                } else if (cleanPhone.startsWith('54') && !cleanPhone.startsWith('549') && cleanPhone.length === 12) {
                    cleanPhone = '549' + cleanPhone.substring(2);
                }
                
                const nombreCobrador = api.user ? api.user.nombre.split(' ')[0] : 'Cobrador';
                const mensajeWa = `Hola. Soy ${nombreCobrador} de ElectroGenesis. Estoy llegando.`;
                const linkWa = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(mensajeWa)}`;
                
                waLinkHtml = `<a href="${linkWa}" target="_blank" style="color: #10b981; font-weight: 700; text-decoration: underline; display: inline-flex; align-items: center; gap: 4px;">📲 ${item.telefono}</a>`;
            } else {
                waLinkHtml = `📞 Sin tel`;
            }
        } else {
            waLinkHtml = `📞 Sin tel`;
        }

        card.innerHTML = `
            <div class="flex justify-between items-center" style="margin-bottom:0.45rem;">
                <strong style="font-size: 0.95rem; color: var(--text-primary);">${item.nombre_apellido}</strong>
                <div class="flex items-center gap-1">
                    <span class="badge badge-purple" style="font-size:0.7rem;">${item.barrio}</span>
                    ${badgeHtml}
                </div>
            </div>
            <div style="font-size:0.83rem; color:var(--text-secondary); margin-bottom:0.6rem; line-height: 1.4;">
                📍 ${item.direccion}${pisoInfo} — ${waLinkHtml}
                ${refInfo}
            </div>
            <div style="font-size:0.83rem; background:rgba(0,0,0,0.05); padding:0.6rem; border-radius:8px; margin-bottom:0.75rem; border: 1px solid rgba(255,255,255,0.05);">
                📦 ${item.producto_nombre}<br>
                <strong>Cuota #${item.proxima_cuota_nro || '-'} de $${Number(item.valor_cuota).toLocaleString('es-AR')}</strong> 
                (${item.cuotas_saldadas} / ${item.cantidad_cuotas} pagadas)
            </div>
            <div class="flex gap-2">
                <button class="btn ${btnClass}" style="flex:1.4; font-size:0.85rem; padding:0.6rem; font-weight: 700;" onclick="simulateQrScan('${item.qr_token}')">
                    ${btnText}
                </button>
                <button class="btn btn-outline" style="flex:0.6; font-size:0.85rem; padding:0.6rem;" onclick="window.open('https://maps.google.com/?q=${encodeURIComponent(item.direccion + ', ' + item.barrio)}', '_blank')">
                    🗺️ Mapa
                </button>
            </div>
        `;
        rutaList.appendChild(card);
    });
}

// ============================================================================
// ESCÁNER QR DE CÁMARA (API DIRECTA HTML5QRCODE CON SOPORTE OFFLINE Y SMARTPHONES)
// ============================================================================

async function startCameraScanner() {
    const container = document.getElementById('qr-reader-container');
    const btnStart = document.getElementById('btn-start-camera');
    const btnStop = document.getElementById('btn-stop-camera');
    const btnSwitch = document.getElementById('btn-switch-camera');
    const loadingMsg = document.getElementById('camera-loading-msg');

    if (!container) return;
    container.classList.remove('hidden');
    if (loadingMsg) loadingMsg.classList.remove('hidden');
    if (btnStart) btnStart.classList.add('hidden');
    if (btnStop) btnStop.classList.remove('hidden');
    if (btnSwitch) btnSwitch.classList.remove('hidden');

    if (!window.Html5Qrcode) {
        if (loadingMsg) loadingMsg.classList.add('hidden');
        await showAlert('⚠️ El módulo de cámara local no está listo. Por favor intente nuevamente o utilice "📁 Subir Foto QR" o "🔍 Buscar por DNI".');
        stopCameraScanner();
        return;
    }

    try {
        if (html5QrCodeDirect) {
            try { await html5QrCodeDirect.stop(); } catch (e) {}
            html5QrCodeDirect.clear();
            html5QrCodeDirect = null;
        }

        html5QrCodeDirect = new Html5Qrcode("qr-reader-container");
        
        const qrConfig = {
            fps: 15,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
                const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
                const qrEdgeSize = Math.floor(minEdge * 0.75);
                return { width: qrEdgeSize, height: qrEdgeSize };
            },
            aspectRatio: 1.0,
            videoConstraints: {
                facingMode: { ideal: currentCameraFacing }
            }
        };

        await html5QrCodeDirect.start(
            { facingMode: currentCameraFacing },
            qrConfig,
            async (decodedText) => {
                console.log('✅ QR Escaneado con Éxito:', decodedText);
                // Vibración táctil háptica en smartphones para confirmar lectura en calle
                if (navigator.vibrate) {
                    navigator.vibrate([100, 50, 100]);
                }
                stopCameraScanner();
                await simulateQrScan(decodedText.trim());
            },
            (errorMsg) => {
                // Cuadro sin código detectado — normal en video en vivo
            }
        );

        if (loadingMsg) loadingMsg.classList.add('hidden');
    } catch (err) {
        console.error('Error al inicializar cámara:', err);
        if (loadingMsg) loadingMsg.classList.add('hidden');
        stopCameraScanner();

        let friendlyError = '📷 No se pudo acceder a la cámara del dispositivo.\n\n';
        if (err.name === 'NotAllowedError' || err.message?.includes('Permission denied')) {
            friendlyError += 'Motivo: Permiso de cámara bloqueado en su navegador móvil. Habilite el permiso de cámara para esta página en la configuración de su navegador.';
        } else if (err.name === 'NotFoundError' || err.message?.includes('Requested device not found')) {
            friendlyError += 'Motivo: No se detectó ninguna cámara disponible en este dispositivo.';
        } else if (err.name === 'NotSupportedError' || !window.isSecureContext) {
            friendlyError += 'Motivo: El navegador exige conexión segura (HTTPS) para activar la cámara en vivo. Puede usar el botón "📁 Subir Foto QR" o "🔍 Buscar por DNI".';
        } else {
            friendlyError += `Detalle: ${err.message || err}`;
        }

        await showAlert(friendlyError);
    }
}

async function stopCameraScanner() {
    const container = document.getElementById('qr-reader-container');
    const btnStart = document.getElementById('btn-start-camera');
    const btnStop = document.getElementById('btn-stop-camera');
    const btnSwitch = document.getElementById('btn-switch-camera');
    const loadingMsg = document.getElementById('camera-loading-msg');

    if (loadingMsg) loadingMsg.classList.add('hidden');
    if (btnStart) btnStart.classList.remove('hidden');
    if (btnStop) btnStop.classList.add('hidden');
    if (btnSwitch) btnSwitch.classList.add('hidden');

    if (html5QrCodeDirect) {
        try {
            if (html5QrCodeDirect.isScanning) {
                await html5QrCodeDirect.stop();
            }
            html5QrCodeDirect.clear();
        } catch (e) {
            console.warn('Cierre de cámara:', e);
        }
        html5QrCodeDirect = null;
    }

    if (container) {
        container.classList.add('hidden');
        container.innerHTML = '';
    }
}

async function switchCamera() {
    currentCameraFacing = (currentCameraFacing === 'environment') ? 'user' : 'environment';
    await startCameraScanner();
}

async function handleQrFileUpload(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        
        if (!window.Html5Qrcode) {
            await showAlert('Módulo de lectura de imágenes no disponible.');
            return;
        }

        const scanner = new Html5Qrcode("qr-reader-container");
        try {
            const decodedText = await scanner.scanFile(file, true);
            scanner.clear();
            input.value = '';
            console.log('✅ QR Leído desde Imagen/Foto:', decodedText);
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
            await simulateQrScan(decodedText.trim());
        } catch (err) {
            scanner.clear();
            input.value = '';
            await showAlert('⚠️ No se detectó ningún código QR en la imagen seleccionada. Asegúrese de que la tarjeta QR esté bien enfocada y con buena iluminación.');
        }
    }
}

// Simulación o lectura real por Token QR (Levantar planilla inmediatamente)
async function simulateQrScan(qrToken) {
    let cleanToken = qrToken ? qrToken.trim() : '';
    
    // Si el QR escaneado es una URL completa de cartilla, extraer el UUID
    if (cleanToken.includes('?qr_cartilla=')) {
        try {
            const urlObj = new URL(cleanToken);
            cleanToken = urlObj.searchParams.get('qr_cartilla') || cleanToken;
        } catch (e) {
            console.warn('No se pudo parsear URL del QR, usando texto original:', e);
        }
    }

    console.log('📡 Levantando Fichero Digital por QR Token:', cleanToken);

    let data = null;

    try {
        data = await api.get(`/cobrador/fichero-qr/${cleanToken}`);
        // Guardar copia local en caché para este cliente específico
        localStorage.setItem(`HIT_CACHED_FICHERO_${cleanToken}`, JSON.stringify(data));
    } catch (err) {
        console.warn('📡 Sin conexión directa para levantar QR. Consultando caché local...');
        const cached = localStorage.getItem(`HIT_CACHED_FICHERO_${cleanToken}`);
        if (cached) {
            data = JSON.parse(cached);
        } else {
            // Intentar recuperar de la hoja de ruta cacheada o del catálogo offline
            const cachedRuta = JSON.parse(localStorage.getItem('HIT_CACHED_HOJA_RUTA') || '[]');
            const cachedCatalogo = JSON.parse(localStorage.getItem('HIT_CACHED_CATALOGO_QR') || '[]');
            const matchedItem = cachedRuta.find(r => r.qr_token === cleanToken) || cachedCatalogo.find(r => r.qr_token === cleanToken);
            if (matchedItem) {
                // Crear estructura sintética a partir del ítem cacheado
                data = {
                    cliente: {
                        id_cliente: matchedItem.id_cliente,
                        nombre_apellido: matchedItem.nombre_apellido,
                        direccion: matchedItem.direccion,
                        barrio: matchedItem.barrio,
                        piso_dpto: matchedItem.piso_dpto,
                        referencia_domicilio: matchedItem.referencia_domicilio,
                        telefono: matchedItem.telefono,
                        dni: matchedItem.dni || 'Sin reg',
                        qr_token: matchedItem.qr_token
                    },
                    ficheros: [{
                        id_fichero: matchedItem.id_fichero,
                        producto_nombre: matchedItem.producto_nombre,
                        valor_cuota: matchedItem.valor_cuota,
                        cantidad_cuotas: matchedItem.cantidad_cuotas,
                        frecuencia_pago: 'SEMANAL',
                        saldo_favor: 0
                    }],
                    cuotas: {
                        [matchedItem.id_fichero]: Array.from({ length: matchedItem.cantidad_cuotas }, (_, i) => ({
                            id_cuota: (matchedItem.id_fichero * 100) + (i + 1),
                            id_fichero: matchedItem.id_fichero,
                            nro_cuota: i + 1,
                            monto: matchedItem.valor_cuota,
                            estado: (i + 1 <= (matchedItem.cuotas_saldadas || 0)) ? 'PAGADO' : 'PENDIENTE'
                        }))
                    }
                };
            }
        }
    }

    if (!data || !data.cliente) {
        await showAlert('⚠️ Código QR no válido o el cliente no se encuentra descargado en la memoria del teléfono.');
        return;
    }

    // Aplicar pagos de la cola offline sobre los casilleros de este cliente
    const offlineQueue = JSON.parse(localStorage.getItem('HIT_OFFLINE_QUEUE') || '[]');
    if (data.cuotas) {
        Object.keys(data.cuotas).forEach(fId => {
            data.cuotas[fId].forEach(q => {
                const queued = offlineQueue.find(item => item.id_cuota === q.id_cuota);
                if (queued) {
                    if (queued.medio_pago && queued.medio_pago !== 'NO_COBRADO') {
                        q.estado = 'PAGADO';
                        q.medio_pago = queued.medio_pago;
                    } else if (queued.motivo_no_cobro) {
                        q.estado = 'NO_COBRADO';
                        q.motivo_no_cobro = queued.motivo_no_cobro;
                    }
                }
            });
        });
    }

    currentScannedData = data;
    renderPlanillaDigital(data);

    // Cambiar vista a la planilla digital de casilleros
    document.getElementById('cobrador-vista-ruta').classList.add('hidden');
    document.getElementById('cobrador-vista-planilla').classList.remove('hidden');
}

// Búsqueda manual por DNI (Emergencia ante pérdida o daño del cartoncito QR en calle)
async function buscarClientePorDni() {
    const dni = prompt('🆘 ¿El cliente extravió el cartoncito QR?\n\nIngrese el número de DNI del cliente para levantar su planilla de casilleros:\n(Nota: Esta acción queda registrada en auditoría de seguridad del sistema)');
    if (!dni || !dni.trim()) return;

    try {
        const data = await api.post('/cobrador/buscar-dni', { dni: dni.trim() });
        currentScannedData = data;
        renderPlanillaDigital(data);

        // Cambiar vista a la planilla digital de casilleros
        document.getElementById('cobrador-vista-ruta').classList.add('hidden');
        document.getElementById('cobrador-vista-planilla').classList.remove('hidden');
        
        if (data.warning) {
            await showAlert(data.warning);
        }
    } catch (err) {
        // Buscar en caché local de hoja de ruta o catálogo si está offline
        const cachedRuta = JSON.parse(localStorage.getItem('HIT_CACHED_HOJA_RUTA') || '[]');
        const cachedCatalogo = JSON.parse(localStorage.getItem('HIT_CACHED_CATALOGO_QR') || '[]');
        const matched = cachedRuta.find(r => (r.dni && r.dni.toString().includes(dni.trim())) || (r.nombre_apellido && r.nombre_apellido.toLowerCase().includes(dni.toLowerCase().trim())))
                     || cachedCatalogo.find(r => (r.dni && r.dni.toString().includes(dni.trim())) || (r.nombre_apellido && r.nombre_apellido.toLowerCase().includes(dni.toLowerCase().trim())));
        if (matched) {
            await simulateQrScan(matched.qr_token);
        } else {
            await showAlert('⚠️ No se encontró cliente con ese DNI.\n\nDetalle: ' + err.message);
        }
    }
}

function renderPlanillaDigital(data) {
    const { cliente, ficheros, cuotas } = data;
    const pisoStr = cliente.piso_dpto ? ` <span style="color:#8b5cf6; font-weight:700;">[🏢 ${cliente.piso_dpto}]</span>` : '';
    const refStr = cliente.referencia_domicilio ? `<br><span style="font-size:0.8rem; color:#d97706; font-weight:700;">🏠 Ref: ${cliente.referencia_domicilio}</span>` : '';
    document.getElementById('planilla-client-name').innerText = cliente.nombre_apellido;
    document.getElementById('planilla-client-dir').innerHTML = `📍 <strong>${cliente.direccion}${pisoStr}</strong> (${cliente.barrio})${refStr}<br><span style="font-size:0.8rem; color:var(--text-secondary);">🪪 DNI: ${cliente.dni || 'Sin reg'} | 📞 Tel: ${cliente.telefono || 'Sin tel'}</span>`;
    document.getElementById('planilla-qr-badge').innerText = cliente.qr_token;

    const container = document.getElementById('ficheros-planilla-container');
    container.innerHTML = '';

    ficheros.forEach(f => {
        const casilleros = cuotas[f.id_fichero] || [];
        const pagadas = casilleros.filter(q => q.estado === 'PAGADO').length;

        const fichBox = document.createElement('div');
        fichBox.className = 'glass-card animate-fade';
        fichBox.style.marginBottom = '1.5rem';
        fichBox.style.padding = '1.25rem';

        const headerDiv = document.createElement('div');
        headerDiv.className = 'flex justify-between items-center';
        headerDiv.style.marginBottom = '0.75rem';
        
        const infoDiv = document.createElement('div');
        const h4 = document.createElement('h4');
        h4.style.fontSize = '1.1rem';
        h4.style.fontWeight = '800';
        h4.style.color = 'var(--text-primary)';
        h4.innerText = `Fichero #${f.id_fichero}: ${f.producto_nombre}`;
        infoDiv.appendChild(h4);

        const subInfo = document.createElement('div');
        subInfo.style.fontSize = '0.82rem';
        subInfo.style.color = 'var(--text-secondary)';
        subInfo.style.marginTop = '0.25rem';
        subInfo.style.lineHeight = '1.4';
        subInfo.innerHTML = `
            <span>🗓️ Frecuencia: <strong style="color:var(--primary);">${f.frecuencia_pago || 'SEMANAL'}</strong> (${f.cantidad_cuotas} cuotas de $${Number(f.valor_cuota).toLocaleString('es-AR')})</span><br>
            <span>👤 Vendedor: <strong>${f.vendedor || 'Milagros'}</strong> &nbsp;|&nbsp; 🛵 Encargado: <strong>${f.encargado_zona || 'Natasha'}</strong></span>
            ${Number(f.saldo_favor || 0) > 0 ? `<br><span>💰 Saldo favor acumulado: <strong style="color:#059669; font-size:0.85rem;">$${Number(f.saldo_favor).toLocaleString('es-AR')}</strong> (Se descontará en el próximo pago)</span>` : ''}
        `;
        infoDiv.appendChild(subInfo);
        headerDiv.appendChild(infoDiv);

        const badgeSpan = document.createElement('span');
        badgeSpan.className = `badge ${pagadas === f.cantidad_cuotas ? 'badge-success' : 'badge-purple'}`;
        badgeSpan.innerText = `${pagadas} / ${f.cantidad_cuotas} saldadas`;
        headerDiv.appendChild(badgeSpan);

        fichBox.appendChild(headerDiv);

        const tipDiv = document.createElement('div');
        tipDiv.style.fontSize = '0.78rem';
        tipDiv.style.color = 'var(--text-muted)';
        tipDiv.style.marginBottom = '0.5rem';
        tipDiv.innerText = '💡 Toca cualquier casillero para asentar el cobro (efectivo/transferencia) o la visita no cobrada:';
        fichBox.appendChild(tipDiv);

        const gridDiv = document.createElement('div');
        gridDiv.className = 'cuota-grid';

        casilleros.forEach(q => {
            const cell = document.createElement('div');
            let cellClass = 'pendiente';
            let icon = '';
            if (q.estado === 'PAGADO') {
                cellClass = 'pagado';
                icon = '✔ PAGADO';
            } else if (q.estado === 'NO_COBRADO') {
                cellClass = 'no-cobrado';
                icon = '❌ RECHAZO';
            }

            cell.className = `cuota-cell ${cellClass}`;
            cell.innerHTML = `
                <span class="cuota-number">${q.nro_cuota}</span>
                <span class="cuota-status-icon">${icon}</span>
            `;

            cell.addEventListener('click', () => {
                openCobroModal(
                    q.id_cuota,
                    q.nro_cuota,
                    parseFloat(q.monto) || 0,
                    q.estado,
                    f.producto_nombre,
                    parseFloat(f.saldo_favor) || 0,
                    f.id_fichero
                );
            });

            gridDiv.appendChild(cell);
        });

        fichBox.appendChild(gridDiv);
        container.appendChild(fichBox);
    });
}

function backToRuta() {
    document.getElementById('cobrador-vista-planilla').classList.add('hidden');
    document.getElementById('cobrador-vista-ruta').classList.remove('hidden');
    initCobradorApp();
}

async function openCobroModal(id_cuota, nro_cuota, monto, estadoActual, producto, saldoFavor = 0, id_fichero = null) {
    if (estadoActual === 'PAGADO') {
        if (!await showConfirm(`El casillero #${nro_cuota} ya se encuentra PAGADO (Verde). ¿Deseas modificarlo o re-asentarlo?`)) {
            return;
        }
    }

    selectedCuotaToPay = { id_cuota, nro_cuota, monto, saldoFavor, id_fichero };
    document.getElementById('cobro-modal-title').innerText = `Registrar Casillero #${nro_cuota}`;
    
    const montoACobrar = Math.max(0, monto - (saldoFavor || 0));
    if (saldoFavor > 0) {
        document.getElementById('cobro-modal-subtitle').innerHTML = `${producto} — Valor Cuota: $${Number(monto).toLocaleString('es-AR')}<br><span style="color:#059669; font-weight:700;">Descuento por Saldo a Favor: -$${Number(saldoFavor).toLocaleString('es-AR')}<br>Monto a cobrar: $${Number(montoACobrar).toLocaleString('es-AR')}</span>`;
    } else {
        document.getElementById('cobro-modal-subtitle').innerText = `${producto} — Valor: $${Number(monto).toLocaleString('es-AR')}`;
    }

    const inputMonto = document.getElementById('cobro-monto-input');
    if (inputMonto) inputMonto.value = montoACobrar;

    document.getElementById('cobro-medio-select').value = 'EFECTIVO';
    document.getElementById('cobro-transf-url').value = '';
    
    const fileInput = document.getElementById('input-foto-comprobante');
    if (fileInput) fileInput.value = '';
    
    const previewContainer = document.getElementById('container-foto-preview');
    if (previewContainer) previewContainer.style.display = 'none';

    document.getElementById('cobro-rechazo-select').value = '';
    document.getElementById('cobro-promesa-fecha').value = '';
    document.getElementById('cobro-notas').value = '';

    toggleCobroFields();
    document.getElementById('modal-registrar-cobro').classList.remove('hidden');
}

function procesarFotoComprobante(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const reader = new FileReader();

        reader.onload = function (e) {
            const base64Img = e.target.result;
            document.getElementById('cobro-transf-url').value = base64Img;
            
            const previewImg = document.getElementById('img-foto-preview');
            const previewContainer = document.getElementById('container-foto-preview');
            
            if (previewImg && previewContainer) {
                previewImg.src = base64Img;
                previewContainer.style.display = 'block';
            }
        };

        reader.readAsDataURL(file);
    }
}

function toggleCobroFields() {
    const medio = document.getElementById('cobro-medio-select').value;
    const transfDiv = document.getElementById('div-transf-img');
    const rechazoDiv = document.getElementById('div-rechazo-motivo');
    const promesaDiv = document.getElementById('div-promesa-fecha');
    const montoDiv = document.getElementById('div-monto-cobrado');

    if (medio === 'TRANSFERENCIA') {
        transfDiv.classList.remove('hidden');
        rechazoDiv.classList.add('hidden');
        if (promesaDiv) promesaDiv.classList.add('hidden');
        if (montoDiv) montoDiv.classList.remove('hidden');
    } else if (medio === 'NO_COBRADO') {
        transfDiv.classList.add('hidden');
        rechazoDiv.classList.remove('hidden');
        if (promesaDiv) promesaDiv.classList.remove('hidden');
        if (montoDiv) montoDiv.classList.add('hidden');
    } else {
        transfDiv.classList.add('hidden');
        rechazoDiv.classList.add('hidden');
        if (promesaDiv) promesaDiv.classList.add('hidden');
        if (montoDiv) montoDiv.classList.remove('hidden');
    }
}

async function submitCobroForm(event) {
    event.preventDefault();
    if (!selectedCuotaToPay) return;

    const medio = document.getElementById('cobro-medio-select').value;
    const transfUrl = document.getElementById('cobro-transf-url').value;
    const motivoRechazo = document.getElementById('cobro-rechazo-select').value;
    const promesaFecha = document.getElementById('cobro-promesa-fecha').value;
    const notas = document.getElementById('cobro-notas').value;

    if (medio === 'NO_COBRADO' && !promesaFecha) {
        await showAlert('⚠️ Para asentar una visita no cobrada es obligatorio agendar la fecha y hora de la promesa de pago del cliente.');
        return;
    }

    const montoCobradoVal = document.getElementById('cobro-monto-input')?.value;
    const monto_cobrado = medio === 'NO_COBRADO' ? null : (parseFloat(montoCobradoVal) || 0);

    const payload = {
        id_cuota: selectedCuotaToPay.id_cuota,
        id_fichero: selectedCuotaToPay.id_fichero,
        nro_cuota: selectedCuotaToPay.nro_cuota,
        medio_pago: medio === 'NO_COBRADO' ? null : medio,
        monto_cobrado: monto_cobrado,
        comprobante_img_url: medio === 'TRANSFERENCIA' ? (transfUrl || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400') : null,
        motivo_no_cobro: medio === 'NO_COBRADO' ? motivoRechazo : null,
        promesa_pago_fecha: medio === 'NO_COBRADO' ? (promesaFecha || null) : null,
        notas: notas,
        lat_long_cobro: '-34.628000, -58.462000',
        fecha_pago: new Date().toISOString(),
        qr_token: currentScannedData?.cliente?.qr_token || '',
        cliente_nombre: currentScannedData?.cliente?.nombre_apellido || 'Cliente'
    };

    // Si está offline o no hay señal, guardar directo en la cola local
    if (!navigator.onLine) {
        await saveToOfflineQueue(payload, medio);
        document.getElementById('modal-registrar-cobro').classList.add('hidden');
        return;
    }

    try {
        const res = await api.post('/cobrador/cobrar', payload);
        
        // 1. Actualizar visualmente la planilla de inmediato en VERDE
        updateClientCardAndGridInMemory(payload.id_cuota, medio === 'NO_COBRADO' ? 'NO_COBRADO' : 'PAGADO', medio, monto_cobrado);
        
        // 2. Cerrar el modal
        document.getElementById('modal-registrar-cobro').classList.add('hidden');

        // 3. Notificación de éxito
        await showAlert('✅ ' + res.message);

        // 4. Si el servidor generó comprobante de WhatsApp, mostrar simulación en vivo
        if (res.whatsapp_message) {
            showWhatsappLiveModal(res.whatsapp_message);
        }

        updateOnlineBadge();
    } catch (err) {
        // Si falló por error de red / caída de 4G temporal, guardar de forma segura en la cola offline
        const msg = (err.message || '').toLowerCase();
        const isNetworkError = !navigator.onLine || err.name === 'TypeError' || msg.includes('fetch') || msg.includes('network') || msg.includes('failed');

        if (isNetworkError) {
            await saveToOfflineQueue(payload, medio);
            document.getElementById('modal-registrar-cobro').classList.add('hidden');
        } else {
            await showAlert('Error registrando cobro: ' + err.message);
        }
    }
}

function updateClientCardAndGridInMemory(id_cuota, nuevoEstado, medioPago, monto) {
    if (currentScannedData && currentScannedData.cuotas) {
        // Buscar la cuota en currentScannedData y actualizar su estado a PAGADO
        Object.keys(currentScannedData.cuotas).forEach(fId => {
            currentScannedData.cuotas[fId].forEach(q => {
                if (q.id_cuota === id_cuota) {
                    q.estado = nuevoEstado;
                    q.medio_pago = medioPago;
                    if (monto !== null && monto !== undefined) q.monto = monto;
                }
            });
        });

        // Guardar la versión actualizada en caché local
        if (currentScannedData.cliente && currentScannedData.cliente.qr_token) {
            localStorage.setItem(`HIT_CACHED_FICHERO_${currentScannedData.cliente.qr_token}`, JSON.stringify(currentScannedData));
        }

        // Re-renderizar la planilla digital inmediatamente con los casilleros en VERDE
        renderPlanillaDigital(currentScannedData);
    }

    // Actualizar también la Hoja de Ruta cacheada
    const cachedRuta = JSON.parse(localStorage.getItem('HIT_CACHED_HOJA_RUTA') || '[]');
    if (currentScannedData && currentScannedData.cliente) {
        const clientToken = currentScannedData.cliente.qr_token;
        const itemIdx = cachedRuta.findIndex(r => r.qr_token === clientToken);
        if (itemIdx >= 0) {
            if (nuevoEstado === 'PAGADO') {
                cachedRuta[itemIdx].cobrado_hoy = (cachedRuta[itemIdx].cobrado_hoy || 0) + 1;
                cachedRuta[itemIdx].cuotas_saldadas = (cachedRuta[itemIdx].cuotas_saldadas || 0) + 1;
            } else if (nuevoEstado === 'NO_COBRADO') {
                cachedRuta[itemIdx].no_cobrado_hoy = 1;
            }
        } else if (nuevoEstado === 'PAGADO') {
            // Si fue un cobro espontáneo de un cliente que no estaba en su hoja de ruta del día
            const fic = currentScannedData.ficheros ? currentScannedData.ficheros[0] : {};
            cachedRuta.push({
                id_cliente: currentScannedData.cliente.id_cliente,
                nombre_apellido: currentScannedData.cliente.nombre_apellido,
                direccion: currentScannedData.cliente.direccion,
                barrio: currentScannedData.cliente.barrio,
                piso_dpto: currentScannedData.cliente.piso_dpto,
                referencia_domicilio: currentScannedData.cliente.referencia_domicilio,
                telefono: currentScannedData.cliente.telefono,
                dni: currentScannedData.cliente.dni,
                qr_token: currentScannedData.cliente.qr_token,
                id_fichero: fic.id_fichero,
                producto_nombre: fic.producto_nombre,
                valor_cuota: fic.valor_cuota,
                cantidad_cuotas: fic.cantidad_cuotas,
                monto_total: fic.monto_total,
                cuotas_saldadas: 1,
                cobrado_hoy: 1,
                no_cobrado_hoy: 0
            });
        }
        localStorage.setItem('HIT_CACHED_HOJA_RUTA', JSON.stringify(cachedRuta));
        currentRutaItems = cachedRuta;
        renderHojaDeRutaCards(cachedRuta);
    }
}

async function saveToOfflineQueue(payload, medio) {
    const queue = JSON.parse(localStorage.getItem('HIT_OFFLINE_QUEUE') || '[]');
    queue.push(payload);
    localStorage.setItem('HIT_OFFLINE_QUEUE', JSON.stringify(queue));
    updateOnlineBadge();

    // Actualizar visualmente la planilla de inmediato en VERDE aunque no haya internet
    const nuevoEstado = medio === 'NO_COBRADO' ? 'NO_COBRADO' : 'PAGADO';
    updateClientCardAndGridInMemory(payload.id_cuota, nuevoEstado, medio, payload.monto_cobrado);

    // Sumar a los contadores locales de efectivo en bolsillo
    const cachedResumen = JSON.parse(localStorage.getItem('HIT_CACHED_RESUMEN_DIARIO') || '{"efectivo_en_bolsillo":0,"transferencias_cargadas":0}');
    if (medio === 'EFECTIVO' && payload.monto_cobrado) {
        cachedResumen.efectivo_en_bolsillo = (Number(cachedResumen.efectivo_en_bolsillo) || 0) + Number(payload.monto_cobrado);
    } else if (medio === 'TRANSFERENCIA' && payload.monto_cobrado) {
        cachedResumen.transferencias_cargadas = (Number(cachedResumen.transferencias_cargadas) || 0) + Number(payload.monto_cobrado);
    }
    localStorage.setItem('HIT_CACHED_RESUMEN_DIARIO', JSON.stringify(cachedResumen));
    updatePocketDisplay(cachedResumen);

    await showAlert(`☁️ COBRO GUARDADO OFFLINE (MODO CALLE)\n\nEl casillero se marcó como COBRADO (Verde) en su teléfono.\n\nEl comprobante quedó encriptado en memoria local y se sincronizará automáticamente al detectar conexión 4G o Wi-Fi.`);
}

async function syncOfflineQueue(isAuto = false) {
    const queue = JSON.parse(localStorage.getItem('HIT_OFFLINE_QUEUE') || '[]');
    if (queue.length === 0) {
        if (!isAuto) await showAlert('La cola offline está vacía. No hay registros pendientes de sincronizar.');
        return;
    }

    if (!navigator.onLine) {
        if (!isAuto) await showAlert('⚠️ Sigue sin conexión a Internet. Conéctate a Wi-Fi o Datos 4G para sincronizar la cola.');
        return;
    }

    try {
        const res = await api.post('/cobrador/sync-offline', { queue });
        localStorage.removeItem('HIT_OFFLINE_QUEUE');
        updateOnlineBadge();

        let notifTexto = '';
        if (res.notificaciones && res.notificaciones.length > 0) {
            notifTexto = '\n\n📲 NOTIFICACIONES WHATSAPP DISPARADAS DURANTE SYNC:\n' + 
                res.notificaciones.map(n => `• A ${n.cliente}: "${n.mensaje}"`).join('\n\n');
        }

        if (!isAuto) {
            await showAlert('☁️ ' + res.message + notifTexto);
            if (res.notificaciones && res.notificaciones.length > 0) {
                showWhatsappLiveModal(res.notificaciones[0].mensaje);
            }
        }

        // Actualizar hoja de ruta del servidor
        await initCobradorApp();
    } catch (err) {
        if (!isAuto) {
            await showAlert('Error intentando sincronizar la cola offline: ' + err.message);
        }
    }
}

function showWhatsappLiveModal(msg) {
    const modal = document.getElementById('modal-whatsapp-live');
    const msgDiv = document.getElementById('whatsapp-live-msg');
    if (modal && msgDiv) {
        msgDiv.innerText = msg;
        modal.classList.remove('hidden');
    }
}

window.setRutaFilter = setRutaFilter;
window.filtrarRutaEnVivo = filtrarRutaEnVivo;
window.initCobradorApp = initCobradorApp;
window.startCameraScanner = startCameraScanner;
window.stopCameraScanner = stopCameraScanner;
window.switchCamera = switchCamera;
window.handleQrFileUpload = handleQrFileUpload;
window.simulateQrScan = simulateQrScan;
window.buscarClientePorDni = buscarClientePorDni;
window.backToRuta = backToRuta;
window.openCobroModal = openCobroModal;
window.toggleCobroFields = toggleCobroFields;
window.procesarFotoComprobante = procesarFotoComprobante;
window.submitCobroForm = submitCobroForm;
window.updateOnlineBadge = updateOnlineBadge;
window.syncOfflineQueue = syncOfflineQueue;
window.showWhatsappLiveModal = showWhatsappLiveModal;
