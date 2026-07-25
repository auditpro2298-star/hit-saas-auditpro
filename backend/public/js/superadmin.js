/* ============================================================================
   HIT SaaS — Panel Nivel 1: Súper Admin (Tu Control Global)
   ============================================================================ */

let saasChartInstance = null;

async function initSuperAdminPanel() {
    console.log('👑 Inicializando Panel Súper Admin...');
    try {
        const metrics = await api.get('/superadmin/metrics');
        renderSuperMetrics(metrics);
        renderSaaSChart(metrics);

        const tenants = await api.get('/superadmin/tenants');
        renderTenantsTable(tenants);
    } catch (err) {
        if (!err.message.includes('SUSCRIPCION_BLOQUEADA')) {
            alert('Error al cargar panel Súper Admin: ' + err.message);
        }
    }
}

function renderSuperMetrics(metrics) {
    document.getElementById('super-mrr').innerText = `$${Number(metrics.mrr || 0).toLocaleString('es-AR')}`;
    document.getElementById('super-tenants-total').innerText = metrics.tenants.total || 0;
    document.getElementById('super-tenants-activas').innerText = metrics.tenants.activas || 0;
    document.getElementById('super-tenants-bloqueadas').innerText = metrics.tenants.bloqueadas || 0;
    document.getElementById('super-total-recaudado').innerText = `$${Number(metrics.operaciones.total_recaudado || 0).toLocaleString('es-AR')}`;
}

function renderTenantsTable(tenants) {
    const tbody = document.getElementById('tbody-tenants');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (tenants.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No hay empresas registradas aún.</td></tr>`;
        return;
    }

    tenants.forEach(t => {
        const tr = document.createElement('tr');
        const badgeClass = t.estado_suscripcion === 'ACTIVA' ? 'badge-success' : 'badge-danger';
        const actionBtnText = t.estado_suscripcion === 'ACTIVA' ? '🚫 Bloquear Cuenta' : '✅ Reactivar Cuenta';
        const actionBtnClass = t.estado_suscripcion === 'ACTIVA' ? 'btn-danger' : 'btn-success';
        const nextStatus = t.estado_suscripcion === 'ACTIVA' ? 'BLOQUEADA' : 'ACTIVA';

        tr.innerHTML = `
            <td>
                <div class="flex items-center gap-2">
                    <img src="${t.logo_url}" alt="Logo" style="width: 32px; height: 32px; border-radius: 6px; object-fit: cover;">
                    <div>
                        <strong>${t.nombre_comercial}</strong>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">ID: #${t.id_empresa}</div>
                    </div>
                </div>
            </td>
            <td>${t.cuit_rut}</td>
            <td><strong>$${Number(t.monto_abono_mensual).toLocaleString('es-AR')} / mes</strong></td>
            <td>
                <div style="font-size: 0.8rem;">
                    <div>👥 Clientes: <strong>${t.total_clientes}</strong></div>
                    <div>📁 Ficheros: <strong>${t.total_ficheros}</strong></div>
                    <div>🛵 Cobradores: <strong>${t.total_cobradores}</strong></div>
                </div>
            </td>
            <td><span class="badge ${badgeClass}">${t.estado_suscripcion}</span></td>
            <td>
                <button class="btn ${actionBtnClass}" style="font-size: 0.78rem; padding: 0.35rem 0.75rem;" onclick="toggleTenantStatus(${t.id_empresa}, '${nextStatus}', '${t.nombre_comercial}')">
                    ${actionBtnText}
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function toggleTenantStatus(id_empresa, nuevoEstado, nombre) {
    const confirmMsg = nuevoEstado === 'BLOQUEADA'
        ? `⚠️ ¿Estás seguro de BLOQUEAR a la empresa "${nombre}"?\nSus administradores y cobradores no podrán ingresar al sistema ni cobrar en calle.`
        : `✅ ¿Deseas REACTIVAR la suscripción del software para "${nombre}"?`;

    if (!confirm(confirmMsg)) return;

    try {
        const res = await api.put(`/superadmin/tenants/${id_empresa}/status`, { estado_suscripcion: nuevoEstado });
        alert(res.message);
        initSuperAdminPanel();
    } catch (err) {
        alert('Error al cambiar estado: ' + err.message);
    }
}

async function submitNewTenantForm(event) {
    event.preventDefault();
    const payload = {
        nombre_comercial: document.getElementById('new-tenant-nombre').value,
        cuit_rut: document.getElementById('new-tenant-cuit').value,
        monto_abono_mensual: parseFloat(document.getElementById('new-tenant-abono').value || 35000),
        admin_nombre: document.getElementById('new-tenant-admin-nombre').value,
        admin_email: document.getElementById('new-tenant-admin-email').value,
        admin_password: document.getElementById('new-tenant-admin-pass').value
    };

    try {
        const res = await api.post('/superadmin/tenants', payload);
        alert(res.message);
        document.getElementById('modal-new-tenant').classList.add('hidden');
        document.getElementById('form-new-tenant').reset();
        initSuperAdminPanel();
    } catch (err) {
        alert('Error al crear empresa: ' + err.message);
    }
}

function renderSaaSChart(metrics) {
    const ctx = document.getElementById('chart-saas-mrr');
    if (!ctx || !window.Chart) return;

    if (saasChartInstance) saasChartInstance.destroy();

    saasChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Suscripciones Activas', 'Abono Promedio ($)', 'MRR Mensual Estimado ($)'],
            datasets: [{
                label: 'Métricas de Rentabilidad SaaS ($ ARS)',
                data: [metrics.tenants.activas, 35000, metrics.mrr],
                backgroundColor: ['#3b82f6', '#10b981', '#8b5cf6'],
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });
}

window.initSuperAdminPanel = initSuperAdminPanel;
window.toggleTenantStatus = toggleTenantStatus;
window.submitNewTenantForm = submitNewTenantForm;
