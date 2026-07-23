/* ============================================================================
   HIT SaaS — Panel Nivel 4: Cartilla Virtual del Cliente (Público vía QR)
   ============================================================================ */

async function loadCartillaPublica(qrTokenInput) {
    const token = qrTokenInput || document.getElementById('input-cliente-qr').value.trim();
    if (!token) {
        alert('Por favor ingrese o escanee el código QR de su tarjeta o cartilla.');
        return;
    }

    const resultContainer = document.getElementById('cartilla-resultado');
    if (!resultContainer) return;
    resultContainer.innerHTML = `<div class="text-center text-muted" style="padding:2rem;">⏳ Consultando estado en tiempo real...</div>`;

    try {
        const data = await api.get(`/cliente/cartilla/${token}`);
        
        // Si se carga la cartilla con éxito, ocultar el buscador para maximizar pantalla en celulares de clientes
        const searchWrapper = document.getElementById('cartilla-search-wrapper');
        if (searchWrapper) {
            searchWrapper.classList.add('hidden');
        }

        renderCartillaUI(data);
    } catch (err) {
        resultContainer.innerHTML = `
            <div class="glass-card text-center" style="padding:2rem; border-color:#ef4444;">
                <h4 style="color:#ef4444; font-size:1.2rem; margin-bottom:0.5rem;">❌ No se encontró la cartilla virtual</h4>
                <p style="font-size:0.9rem; color:var(--text-secondary);">
                    El código QR "<strong>${token}</strong>" no existe o fue desactivado. Verifique que sea igual al impreso en su tarjeta.
                </p>
            </div>
        `;
    }
}

function renderCartillaUI(data) {
    const { cliente, empresa, resumen_global, cartillas } = data;
    const container = document.getElementById('cartilla-resultado');
    container.innerHTML = '';

    // Tarjeta 1: Código QR de Cobro Escaneable (para mostrarle al Cobrador en puerta)
    const qrCard = document.createElement('div');
    qrCard.className = 'cartilla-card animate-fade';
    qrCard.style.marginBottom = '1.5rem';
    qrCard.style.textAlign = 'center';
    qrCard.style.background = 'rgba(139, 92, 246, 0.08)';
    qrCard.style.border = '2px dashed var(--saas-purple)';
    qrCard.style.padding = '1.5rem';

    // Generar la URL de la cartilla que el cobrador puede escanear
    const qrUrl = cliente.qr_token; // El cobrador procesa el QR token crudo para levantar el fichero

    qrCard.innerHTML = `
        <div style="font-size:0.95rem; font-weight:800; color:var(--saas-purple); margin-bottom:0.35rem; text-transform:uppercase; letter-spacing:0.05em;">
            📲 QR DE COBRO DIGITAL
        </div>
        <div style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:1.15rem; line-height:1.35; max-width:400px; margin-left:auto; margin-right:auto;">
            Presente esta pantalla al cobrador en calle para que registre su pago al instante en su planilla.
        </div>
        <div style="display:inline-block; padding:0.85rem; background:white; border-radius:12px; box-shadow:var(--shadow-md); transition: transform 0.2s ease;" class="hover-scale">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=170x170&color=0f172a&data=${encodeURIComponent(qrUrl)}" style="width:170px; height:170px; display:block;" alt="QR del Cliente">
        </div>
        <div style="font-size:0.75rem; font-family:monospace; color:var(--text-secondary); margin-top:0.75rem; opacity:0.85; word-break: break-all;">
            Código: ${cliente.qr_token}
        </div>
    `;
    container.appendChild(qrCard);

    // Tarjeta 2: Carnet Superior (Información del Titular)
    const headerCard = document.createElement('div');
    headerCard.className = 'cartilla-card animate-fade';
    headerCard.style.marginBottom = '1.75rem';

    headerCard.innerHTML = `
        <div class="flex justify-between items-center" style="margin-bottom:1.25rem;">
            <div class="flex items-center gap-2">
                <img src="${empresa.logo_url || 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=150'}" style="width:40px; height:40px; border-radius:8px; object-fit:cover; border:2px solid rgba(255,255,255,0.2);">
                <div>
                    <h3 style="font-size:1.2rem; font-weight:800; line-height:1.1;">${empresa.nombre_comercial}</h3>
                    <span style="font-size:0.75rem; opacity:0.8;">Cartilla Digital de Cuotas</span>
                </div>
            </div>
            <span class="cartilla-qr-badge">${cliente.qr_token}</span>
        </div>
        
        <div style="margin-bottom:1.25rem;">
            <div style="font-size:0.78rem; text-transform:uppercase; letter-spacing:0.05em; opacity:0.7;">Titular del Fichero</div>
            <div style="font-size:1.6rem; font-weight:800; letter-spacing:-0.02em;">${cliente.nombre_apellido}</div>
            <div style="font-size:0.85rem; opacity:0.85; margin-top:0.3rem; line-height:1.4;">
                📍 Dirección: <strong>${cliente.direccion}</strong> (${cliente.barrio})<br>
                🪪 DNI / Doc: <strong>${cliente.dni || 'Sin reg'}</strong> &nbsp;|&nbsp; 📞 Tel: <strong>${cliente.telefono || 'Sin tel'}</strong><br>
                ⭐ Calificación de Pago: <strong style="color:#34d399;">${cliente.calificacion || 'BUENO'}</strong>
            </div>
        </div>

        <div class="grid" style="grid-template-columns: repeat(3, 1fr); gap:1rem; border-top:1px solid rgba(255,255,255,0.15); padding-top:1rem;">
            <div>
                <div style="font-size:0.72rem; opacity:0.7;">Ficheros Activos</div>
                <div style="font-size:1.2rem; font-weight:800;">${resumen_global.ficheros_activos}</div>
            </div>
            <div>
                <div style="font-size:0.72rem; opacity:0.7;">Total Pagado</div>
                <div style="font-size:1.2rem; font-weight:800; color:#34d399;">$${Number(resumen_global.total_saldado).toLocaleString('es-AR')}</div>
            </div>
            <div>
                <div style="font-size:0.72rem; opacity:0.7;">Saldo Pendiente</div>
                <div style="font-size:1.2rem; font-weight:800; color:#fbbf24;">$${Number(resumen_global.total_pendiente).toLocaleString('es-AR')}</div>
            </div>
        </div>
    `;
    container.appendChild(headerCard);

    // Renderizar cada Fichero y su cuadrícula visual
    cartillas.forEach(item => {
        const f = item.fichero;
        const res = item.resumen_fichero;
        
        const fichBox = document.createElement('div');
        fichBox.className = 'glass-card animate-fade';
        fichBox.style.marginBottom = '1.5rem';

        let gridHtml = '';
        item.cuotas.forEach(q => {
            let cellClass = 'pendiente';
            let icon = '';
            let titleExtra = 'Pendiente';
            if (q.estado === 'PAGADO') {
                cellClass = 'pagado';
                icon = '✔';
                titleExtra = `Pagado el ${new Date(q.fecha_pago).toLocaleDateString()} (${q.medio_pago || 'EFECTIVO'})`;
            } else if (q.estado === 'NO_COBRADO') {
                cellClass = 'no-cobrado';
                icon = '❌';
                titleExtra = `No cobrado: ${q.motivo_no_cobro || 'Rechazo'}`;
            }

            gridHtml += `
                <div class="cuota-cell ${cellClass}" title="Casillero #${q.nro_cuota} - $${q.monto} | ${titleExtra}">
                    <span class="cuota-number">${q.nro_cuota}</span>
                    <span class="cuota-status-icon">${icon}</span>
                </div>
            `;
        });

        fichBox.innerHTML = `
            <div class="flex justify-between items-center" style="margin-bottom:0.6rem;">
                <div>
                    <h4 style="font-size:1.15rem; font-weight:800; color:var(--text-primary);">📦 ${f.producto_nombre}</h4>
                    <div style="font-size:0.82rem; color:var(--text-secondary); margin-top:0.25rem; line-height:1.4;">
                        <span>🗓️ Frecuencia: <strong style="color:var(--primary);">${f.frecuencia_pago || 'SEMANAL'}</strong> (${f.cantidad_cuotas} cuotas de $${Number(f.valor_cuota).toLocaleString('es-AR')})</span><br>
                        <span>👤 Vendedor: <strong>${f.vendedor || 'Milagros'}</strong> &nbsp;|&nbsp; 🛵 Encargado de Zona: <strong>${f.encargado_zona || 'Natasha'}</strong></span>
                    </div>
                </div>
                <span class="badge badge-success" style="font-size:0.85rem;">Progreso: ${res.porcentaje_progreso}%</span>
            </div>

            <div style="width:100%; height:8px; background:var(--border-color); border-radius:99px; overflow:hidden; margin:0.75rem 0 1rem 0;">
                <div style="width:${res.porcentaje_progreso}%; height:100%; background:linear-gradient(90deg, #3b82f6, #10b981); transition:width 0.5s ease;"></div>
            </div>

            <div style="font-size:0.8rem; font-weight:700; color:var(--text-secondary); margin-bottom:0.5rem;">
                Casilleros del Fichero (1 al ${f.cantidad_cuotas} | Verde = Cobrado | Blanco = Pendiente):
            </div>
            <div class="cuota-grid">
                ${gridHtml}
            </div>

            <div style="margin-top:1.25rem; padding:0.85rem; background:rgba(255,255,255,0.04); border-radius:8px; border-left:3px solid #f59e0b; font-size:0.75rem; color:var(--text-secondary); line-height:1.45;">
                <strong style="color:#f59e0b;">⚠️ Nota operativa y legal (Calco Digital de Calle):</strong><br>
                • Los pagos por <strong>Mercado Pago, Cuenta DNI o medio digital</strong> solo quedarán registrados con el comprobante donde figure fecha, hora y número de operación.<br>
                • La empresa se reserva el derecho de dominio sobre el producto hasta su cancelación total.<br>
                • Queda debidamente notificado. Art. 886 Cód. Civil y Comercial.
            </div>
        `;
        container.appendChild(fichBox);
    });
}

window.loadCartillaPublica = loadCartillaPublica;
