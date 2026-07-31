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
            await showAlert('Error al cargar panel Súper Admin: ' + err.message);
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
        const actionBtnText = t.estado_suscripcion === 'ACTIVA' ? '🚫 Bloquear' : '✅ Activar';
        const actionBtnClass = t.estado_suscripcion === 'ACTIVA' ? 'btn-danger' : 'btn-success';
        const nextStatus = t.estado_suscripcion === 'ACTIVA' ? 'BLOQUEADA' : 'ACTIVA';

        tr.innerHTML = `
            <td>
                <div class="flex items-center gap-2">
                    <img src="${t.logo_url}" alt="Logo" style="width: 32px; height: 32px; border-radius: 6px; object-fit: cover; cursor: pointer;" title="Click para cambiar logo" onclick="changeTenantLogo(${t.id_empresa}, '${t.nombre_comercial}', '${t.logo_url}')">
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
                <div class="flex gap-1" style="flex-wrap: wrap;">
                    <button class="btn ${actionBtnClass}" style="font-size: 0.78rem; padding: 0.35rem 0.6rem;" onclick="toggleTenantStatus(${t.id_empresa}, '${nextStatus}', '${t.nombre_comercial}')">
                        ${actionBtnText}
                    </button>
                    <button class="btn btn-outline" style="font-size: 0.78rem; padding: 0.35rem 0.6rem;" title="Editar logo" onclick="changeTenantLogo(${t.id_empresa}, '${t.nombre_comercial}', '${t.logo_url}')">
                        🖼️ Logo
                    </button>
                    <button class="btn" style="font-size: 0.78rem; padding: 0.35rem 0.6rem; background-color: #ef4444; color: white;" title="Eliminar empresa" onclick="deleteTenant(${t.id_empresa}, '${t.nombre_comercial}')">
                        🗑️ Borrar
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function toggleTenantStatus(id_empresa, nuevoEstado, nombre) {
    const confirmMsg = nuevoEstado === 'BLOQUEADA'
        ? `⚠️ ¿Estás seguro de BLOQUEAR a la empresa "${nombre}"?\nSus administradores y cobradores no podrán ingresar al sistema ni cobrar en calle.`
        : `✅ ¿Deseas REACTIVAR la suscripción del software para "${nombre}"?`;

    if (!await showConfirm(confirmMsg)) return;

    try {
        const res = await api.put(`/superadmin/tenants/${id_empresa}/status`, { estado_suscripcion: nuevoEstado });
        await showAlert(res.message);
        initSuperAdminPanel();
    } catch (err) {
        await showAlert('Error al cambiar estado: ' + err.message);
    }
}

async function changeTenantLogo(id_empresa, nombre, currentLogoUrl) {
    const newLogoUrl = prompt(`🖼️ Cambiar logotipo de "${nombre}":\n\nIngrese la URL de la nueva imagen para el logo:`, currentLogoUrl);
    if (newLogoUrl === null) return; // Cancelado
    if (newLogoUrl.trim() === '') {
        await showAlert('Debe especificar una URL válida.');
        return;
    }

    try {
        const res = await api.put(`/superadmin/tenants/${id_empresa}/logo`, { logo_url: newLogoUrl.trim() });
        await showAlert(res.message);
        initSuperAdminPanel();
    } catch (err) {
        await showAlert('Error al cambiar logo: ' + err.message);
    }
}

async function deleteTenant(id_empresa, nombre) {
    const confirmMsg = `⚠️ ADVERTENCIA CRÍTICA: ¿Estás seguro de ELIMINAR COMPLETAMENTE a la empresa "${nombre}"?\n\nEsta acción borrará irreversiblemente todos los clientes, cobradores, ficheros, cuotas y registros históricos asociados a esta empresa.\n\nEscriba la palabra "ELIMINAR" para confirmar:`;
    const input = prompt(confirmMsg);
    if (input !== 'ELIMINAR') {
        if (input !== null) await showAlert('Eliminación cancelada. Confirmación incorrecta.');
        return;
    }

    try {
        const res = await api.delete(`/superadmin/tenants/${id_empresa}`);
        await showAlert(res.message);
        initSuperAdminPanel();
    } catch (err) {
        await showAlert('Error al eliminar empresa: ' + err.message);
    }
}

async function changeTenantLogo(id_empresa, nombre, currentLogoUrl) {
    const newLogoUrl = prompt(`🖼️ Cambiar logotipo de "${nombre}":\n\nIngrese la URL de la nueva imagen para el logo:`, currentLogoUrl);
    if (newLogoUrl === null) return; // Cancelado
    if (newLogoUrl.trim() === '') {
        alert('Debe especificar una URL válida.');
        return;
    }

    try {
        const res = await api.put(`/superadmin/tenants/${id_empresa}/logo`, { logo_url: newLogoUrl.trim() });
        alert(res.message);
        initSuperAdminPanel();
    } catch (err) {
        alert('Error al cambiar logo: ' + err.message);
    }
}

async function deleteTenant(id_empresa, nombre) {
    const confirmMsg = `⚠️ ADVERTENCIA CRÍTICA: ¿Estás seguro de ELIMINAR COMPLETAMENTE a la empresa "${nombre}"?\n\nEsta acción borrará irreversiblemente todos los clientes, cobradores, ficheros, cuotas y registros históricos asociados a esta empresa.\n\nEscriba la palabra "ELIMINAR" para confirmar:`;
    const input = prompt(confirmMsg);
    if (input !== 'ELIMINAR') {
        if (input !== null) alert('Eliminación cancelada. Confirmación incorrecta.');
        return;
    }

    try {
        const res = await api.delete(`/superadmin/tenants/${id_empresa}`);
        alert(res.message);
        initSuperAdminPanel();
    } catch (err) {
        alert('Error al eliminar empresa: ' + err.message);
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
        await showAlert(res.message);
        document.getElementById('modal-new-tenant').classList.add('hidden');
        document.getElementById('form-new-tenant').reset();
        initSuperAdminPanel();
    } catch (err) {
        await showAlert('Error al crear empresa: ' + err.message);
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
window.changeTenantLogo = changeTenantLogo;
window.deleteTenant = deleteTenant;
window.submitNewTenantForm = submitNewTenantForm;
