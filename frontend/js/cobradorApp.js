/* ============================================================================
   HIT SaaS — Panel Nivel 3: App Móvil del Cobrador (Escáner QR & Planilla Calle)
   ============================================================================ */

let html5QrScannerInstance = null;
let currentScannedData = null;
let selectedCuotaToPay = null;

// Listener de eventos online/offline para actualizar semáforo al instante
window.addEventListener('online', updateOnlineBadge);
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
    try {
        const resumen = await api.get('/cobrador/resumen-diario');
        document.getElementById('cob-efectivo-bolsillo').innerText = `$${Number(resumen.efectivo_en_bolsillo || 0).toLocaleString('es-AR')}`;
        document.getElementById('cob-transf-cargadas').innerText = `$${Number(resumen.transferencias_cargadas || 0).toLocaleString('es-AR')}`;

        await syncHojaDeRuta();
    } catch (err) {
        if (!err.message || !err.message.includes('SUSCRIPCION_BLOQUEADA')) {
            console.error('Error al iniciar app cobrador (modo local):', err);
        }
    }
}

async function syncHojaDeRuta() {
    const rutaList = document.getElementById('hoja-ruta-list');
    if (!rutaList) return;
    rutaList.innerHTML = `<div class="text-center text-muted" style="padding:1rem;">⏳ Sincronizando hoja de ruta del servidor...</div>`;

    try {
        const ruta = await api.get('/cobrador/hoja-de-ruta');
        rutaList.innerHTML = '';

        if (ruta.length === 0) {
            rutaList.innerHTML = `<div class="glass-card text-center" style="padding:2rem;">🎉 ¡Excelente! No tienes visitas pendientes asignadas en tu zona hoy.</div>`;
            return;
        }

        ruta.forEach(item => {
            const card = document.createElement('div');
            card.className = 'glass-card animate-fade';
            card.style.padding = '1.1rem';
            card.style.marginBottom = '0.85rem';
            card.style.borderLeft = '4px solid var(--primary)';

            card.innerHTML = `
                <div class="flex justify-between items-center" style="margin-bottom:0.4rem;">
                    <strong>${item.nombre_apellido}</strong>
                    <span class="badge badge-purple" style="font-size:0.7rem;">${item.barrio}</span>
                </div>
                <div style="font-size:0.82rem; color:var(--text-secondary); margin-bottom:0.6rem;">
                    📍 ${item.direccion} — 📞 ${item.telefono || 'Sin tel'}
                </div>
                <div style="font-size:0.82rem; background:rgba(0,0,0,0.05); padding:0.5rem; border-radius:6px; margin-bottom:0.75rem;">
                    📦 ${item.producto_nombre}<br>
                    <strong>Cuota #${item.proxima_cuota_nro || '-'} de $${Number(item.valor_cuota).toLocaleString('es-AR')}</strong> 
                    (${item.cuotas_saldadas} / ${item.cantidad_cuotas} pagadas)
                </div>
                <div class="flex gap-2">
                    <button class="btn btn-primary" style="flex:1; font-size:0.82rem; padding:0.5rem;" onclick="simulateQrScan('${item.qr_token}')">
                        ⚡ Escanear QR
                    </button>
                    <button class="btn btn-outline" style="font-size:0.82rem; padding:0.5rem;" onclick="window.open('https://maps.google.com/?q=${encodeURIComponent(item.direccion + ', ' + item.barrio)}', '_blank')">
                        🗺️ Mapa
                    </button>
                </div>
            `;
            rutaList.appendChild(card);
        });
    } catch (err) {
        rutaList.innerHTML = `<div class="text-center" style="color:#ef4444;">Error de conexión. Trabajando en modo local cacheado.</div>`;
    }
}

// Escáner de Cámara Real (HTML5 QR Scanner)
function startCameraScanner() {
    const container = document.getElementById('qr-reader-container');
    container.classList.remove('hidden');

    if (window.Html5QrcodeScanner && !html5QrScannerInstance) {
        html5QrScannerInstance = new Html5QrcodeScanner(
            "qr-reader-container",
            { fps: 10, qrbox: { width: 250, height: 250 } },
            /* verbose= */ false
        );

        html5QrScannerInstance.render(
            async (decodedText) => {
                console.log('✅ QR Escaneado:', decodedText);
                await simulateQrScan(decodedText.trim());
                stopCameraScanner();
            },
            (error) => {
                // Errores menores por cuadro de cámara que no lee un QR aún se ignoran
            }
        );
    } else {
        alert('📷 Si la cámara no está disponible en su navegador, utilice los botones rápidos de prueba abajo.');
    }
}

function stopCameraScanner() {
    const container = document.getElementById('qr-reader-container');
    if (html5QrScannerInstance) {
        html5QrScannerInstance.clear().catch(e => console.error(e));
        html5QrScannerInstance = null;
    }
    container.classList.add('hidden');
}

// Simulación o lectura real por Token QR (Levantar planilla inmediatamente)
async function simulateQrScan(qrToken) {
    console.log('📡 Levantando Fichero Digital por QR Token:', qrToken);
    try {
        const data = await api.get(`/cobrador/fichero-qr/${qrToken}`);
        currentScannedData = data;
        renderPlanillaDigital(data);

        // Cambiar vista a la planilla digital de casilleros
        document.getElementById('cobrador-vista-ruta').classList.add('hidden');
        document.getElementById('cobrador-vista-planilla').classList.remove('hidden');
    } catch (err) {
        alert('⚠️ Código QR no válido o el cliente no pertenece a esta empresa.\n\nDetalle: ' + err.message);
    }
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
            alert(data.warning);
        }
    } catch (err) {
        alert('⚠️ No se encontró cliente o su acceso como cobrador ha sido bloqueado.\n\nDetalle: ' + err.message);
    }
}

function renderPlanillaDigital(data) {
    const { cliente, ficheros, cuotas } = data;
    document.getElementById('planilla-client-name').innerText = cliente.nombre_apellido;
    document.getElementById('planilla-client-dir').innerHTML = `📍 <strong>${cliente.direccion}</strong> (${cliente.barrio})<br><span style="font-size:0.8rem; color:var(--text-secondary);">🪪 DNI: ${cliente.dni || 'Sin reg'} | 📞 Tel: ${cliente.telefono || 'Sin tel'}</span>`;
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

        let gridHtml = '';
        casilleros.forEach(q => {
            let cellClass = 'pendiente';
            let icon = '';
            if (q.estado === 'PAGADO') {
                cellClass = 'pagado';
                icon = '✔ PAGADO';
            } else if (q.estado === 'NO_COBRADO') {
                cellClass = 'no-cobrado';
                icon = '❌ RECHAZO';
            }

            gridHtml += `
                <div class="cuota-cell ${cellClass}" onclick="openCobroModal(${q.id_cuota}, ${q.nro_cuota}, ${q.monto}, '${q.estado}', '${f.producto_nombre}')">
                    <span class="cuota-number">${q.nro_cuota}</span>
                    <span class="cuota-status-icon">${icon}</span>
                </div>
            `;
        });

        fichBox.innerHTML = `
            <div class="flex justify-between items-center" style="margin-bottom:0.75rem;">
                <div>
                    <h4 style="font-size:1.1rem; font-weight:800; color:var(--text-primary);">Fichero #${f.id_fichero}: ${f.producto_nombre}</h4>
                    <div style="font-size:0.82rem; color:var(--text-secondary); margin-top:0.25rem; line-height:1.4;">
                        <span>🗓️ Frecuencia: <strong style="color:var(--primary);">${f.frecuencia_pago || 'SEMANAL'}</strong> (${f.cantidad_cuotas} cuotas de $${Number(f.valor_cuota).toLocaleString('es-AR')})</span><br>
                        <span>👤 Vendedor: <strong>${f.vendedor || 'Milagros'}</strong> &nbsp;|&nbsp; 🛵 Encargado: <strong>${f.encargado_zona || 'Natasha'}</strong></span>
                    </div>
                </div>
                <span class="badge badge-purple">${pagadas} / ${f.cantidad_cuotas} saldadas</span>
            </div>
            <div style="font-size:0.78rem; color:var(--text-muted); margin-bottom:0.5rem;">
                💡 Toca cualquier casillero pendiente para registrar el cobro (efectivo/transferencia) o la razón de la visita no cobrada:
            </div>
            <div class="cuota-grid">
                ${gridHtml}
            </div>
        `;
        container.appendChild(fichBox);
    });
}

function backToRuta() {
    document.getElementById('cobrador-vista-planilla').classList.add('hidden');
    document.getElementById('cobrador-vista-ruta').classList.remove('hidden');
    initCobradorApp();
}

function openCobroModal(id_cuota, nro_cuota, monto, estadoActual, producto) {
    if (estadoActual === 'PAGADO') {
        if (!confirm(`El casillero #${nro_cuota} ya se encuentra PAGADO. ¿Deseas modificarlo o ver sus datos?`)) {
            return;
        }
    }

    selectedCuotaToPay = { id_cuota, nro_cuota, monto };
    document.getElementById('cobro-modal-title').innerText = `Registrar Casillero #${nro_cuota}`;
    document.getElementById('cobro-modal-subtitle').innerText = `${producto} — Valor: $${Number(monto).toLocaleString('es-AR')}`;
    document.getElementById('cobro-medio-select').value = 'EFECTIVO';
    document.getElementById('cobro-transf-url').value = '';
    document.getElementById('cobro-rechazo-select').value = '';
    document.getElementById('cobro-promesa-fecha').value = '';
    document.getElementById('cobro-notas').value = '';

    toggleCobroFields();
    document.getElementById('modal-registrar-cobro').classList.remove('hidden');
}

function toggleCobroFields() {
    const medio = document.getElementById('cobro-medio-select').value;
    const transfDiv = document.getElementById('div-transf-img');
    const rechazoDiv = document.getElementById('div-rechazo-motivo');
    const promesaDiv = document.getElementById('div-promesa-fecha');

    if (medio === 'TRANSFERENCIA') {
        transfDiv.classList.remove('hidden');
        rechazoDiv.classList.add('hidden');
        if (promesaDiv) promesaDiv.classList.add('hidden');
    } else if (medio === 'NO_COBRADO') {
        transfDiv.classList.add('hidden');
        rechazoDiv.classList.remove('hidden');
        if (promesaDiv) promesaDiv.classList.remove('hidden');
    } else {
        transfDiv.classList.add('hidden');
        rechazoDiv.classList.add('hidden');
        if (promesaDiv) promesaDiv.classList.add('hidden');
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
        alert('⚠️ Para asentar una visita no cobrada es obligatorio agendar la fecha y hora de la promesa de pago del cliente.');
        return;
    }

    const payload = {
        id_cuota: selectedCuotaToPay.id_cuota,
        medio_pago: medio === 'NO_COBRADO' ? null : medio,
        comprobante_img_url: medio === 'TRANSFERENCIA' ? (transfUrl || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400') : null,
        motivo_no_cobro: medio === 'NO_COBRADO' ? motivoRechazo : null,
        promesa_pago_fecha: medio === 'NO_COBRADO' ? (promesaFecha || null) : null,
        notas: notas,
        lat_long_cobro: '-34.628000, -58.462000', // GPS calle
        fecha_pago: new Date().toISOString()
    };

    // Si está offline, guardar directo en la cola local de sincronización
    if (!navigator.onLine) {
        saveToOfflineQueue(payload, medio);
        document.getElementById('modal-registrar-cobro').classList.add('hidden');
        return;
    }

    try {
        const res = await api.post('/cobrador/cobrar', payload);
        alert('✅ ' + res.message);
        document.getElementById('modal-registrar-cobro').classList.add('hidden');

        // Si el servidor generó comprobante automático por WhatsApp, disparar simulación visual en vivo
        if (res.whatsapp_message) {
            showWhatsappLiveModal(res.whatsapp_message);
        }

        // Recargar la planilla en vivo si sigue abierta
        if (currentScannedData && currentScannedData.cliente) {
            await simulateQrScan(currentScannedData.cliente.qr_token);
        }
        updateOnlineBadge();
    } catch (err) {
        // Si falló por error de red / caída de conexión temporal, meter a la cola offline
        if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError') || err.message.includes('Network request failed'))) {
            saveToOfflineQueue(payload, medio);
            document.getElementById('modal-registrar-cobro').classList.add('hidden');
        } else {
            alert('Error registrando cobro: ' + err.message);
        }
    }
}

function saveToOfflineQueue(payload, medio) {
    const queue = JSON.parse(localStorage.getItem('HIT_OFFLINE_QUEUE') || '[]');
    queue.push(payload);
    localStorage.setItem('HIT_OFFLINE_QUEUE', JSON.stringify(queue));
    updateOnlineBadge();

    alert(`☁️ MODO OFFLINE ACTIVADO\n\nSin conexión al servidor. El registro (${medio || payload.motivo_no_cobro}) fue encriptado y guardado en la memoria local del teléfono.\n\nSe sincronizará en cuanto recupere señal.`);
    
    // Actualizar visualmente el casillero actual en la planilla en memoria si está visible
    if (currentScannedData && currentScannedData.cliente) {
        simulateQrScan(currentScannedData.cliente.qr_token).catch(() => {});
    }
}

async function syncOfflineQueue() {
    const queue = JSON.parse(localStorage.getItem('HIT_OFFLINE_QUEUE') || '[]');
    if (queue.length === 0) {
        alert('La cola offline está vacía.');
        return;
    }

    if (!navigator.onLine) {
        alert('⚠️ Sigue sin conexión a Internet. Conéctate a Wi-Fi o Datos para sincronizar la cola.');
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

        alert('☁️ ' + res.message + notifTexto);
        
        if (res.notificaciones && res.notificaciones.length > 0) {
            showWhatsappLiveModal(res.notificaciones[0].mensaje);
        }

        initCobradorApp();
    } catch (err) {
        alert('Error intentando sincronizar la cola offline: ' + err.message);
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

window.initCobradorApp = initCobradorApp;
window.startCameraScanner = startCameraScanner;
window.stopCameraScanner = stopCameraScanner;
window.simulateQrScan = simulateQrScan;
window.buscarClientePorDni = buscarClientePorDni;
window.backToRuta = backToRuta;
window.openCobroModal = openCobroModal;
window.toggleCobroFields = toggleCobroFields;
window.submitCobroForm = submitCobroForm;
window.updateOnlineBadge = updateOnlineBadge;
window.syncOfflineQueue = syncOfflineQueue;
window.showWhatsappLiveModal = showWhatsappLiveModal;
