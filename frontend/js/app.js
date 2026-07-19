/* ============================================================================
   HIT SaaS — Gestor Global SPA & Enrutador por Nivel de Acceso
   ============================================================================ */

let currentRoleView = 'superadmin';

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 HIT SaaS Multi-Tenant Web & Mobile Experience cargado.');

    // Configurar modo oscuro o claro según preferencia previa
    initTheme();

    // Si la URL tiene parámetro ?qr_cartilla=... abrir directamente el Nivel 4 (Vista Cliente)
    const urlParams = new URLSearchParams(window.location.search);
    const cartillaToken = urlParams.get('qr_cartilla');
    if (cartillaToken) {
        switchRoleView('cliente', cartillaToken);
        return;
    }

    // Por defecto iniciar con la demostración en Nivel 1 (Súper Admin) autologueado
    await autoLoginAndSwitch('superadmin');
});

// Enrutador visual entre los 4 Niveles de Acceso del SaaS
async function switchRoleView(role, extraParam = null) {
    currentRoleView = role;

    // Actualizar pills de navegación
    document.querySelectorAll('.role-switcher .role-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-role') === role) btn.classList.add('active');
    });

    // Ocultar todos los paneles del SPA
    document.querySelectorAll('.role-panel').forEach(panel => panel.classList.add('hidden'));

    if (role === 'superadmin') {
        await autoLoginAndSwitch('superadmin');
        document.getElementById('panel-superadmin').classList.remove('hidden');
        if (window.initSuperAdminPanel) window.initSuperAdminPanel();
    } else if (role === 'empresa') {
        await autoLoginAndSwitch('empresa');
        document.getElementById('panel-empresa').classList.remove('hidden');
        if (window.initEmpresaPanel) window.initEmpresaPanel();
    } else if (role === 'cobrador') {
        await autoLoginAndSwitch('cobrador');
        document.getElementById('panel-cobrador').classList.remove('hidden');
        if (window.initCobradorApp) window.initCobradorApp();
    } else if (role === 'cliente') {
        document.getElementById('panel-cliente').classList.remove('hidden');
        if (window.loadCartillaPublica) {
            window.loadCartillaPublica(extraParam || 'HIT-QR-8821-A90F');
        }
    }
}

// Autologueo por rol para demostración rápida y fluida al hacer clic en las pestañas
async function autoLoginAndSwitch(role) {
    let creds = { email: '', password: '' };
    if (role === 'superadmin') {
        creds = { email: 'admin@hitsaas.com', password: 'admin123' };
    } else if (role === 'empresa') {
        creds = { email: 'admin@electrohogar.com', password: 'admin123' };
    } else if (role === 'cobrador') {
        creds = { email: 'juan@electrohogar.com', password: 'cobrador123' };
    }

    if (!creds.email) return;

    try {
        const res = await api.post('/auth/login', creds);
        if (res && res.token) {
            api.setAuth(res.token, res.user);
            updateUserBadge(res.user);
        }
    } catch (err) {
        console.warn('Fallo autologin para demo:', err.message);
    }
}

function updateUserBadge(user) {
    const badge = document.getElementById('user-status-badge');
    if (badge && user) {
        badge.innerHTML = `👤 ${user.nombre} <span style="opacity:0.65;">(${user.rol})</span>`;
    }
}

// Botón para restablecer y poblar la base de datos con datos semilla limpios
async function triggerDemoReset() {
    if (!confirm('🔄 ¿Deseas restablecer la base de datos con los datos de prueba iniciales (2 empresas, clientes, ficheros, cuotas y cobradores)?')) {
        return;
    }
    try {
        const res = await api.post('/auth/login', { email: 'admin@hitsaas.com', password: 'admin123' });
        if (res.token) api.setAuth(res.token, res.user);

        const resetRes = await api.post('/auth/demo-reset', {});
        alert('🎉 ' + resetRes.message);
        switchRoleView(currentRoleView);
    } catch (err) {
        alert('Error restablecendo datos: ' + err.message);
    }
}

// Modo Oscuro / Claro
function initTheme() {
    const savedTheme = localStorage.getItem('hit_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeBtn(savedTheme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('hit_theme', next);
    updateThemeBtn(next);
}

function updateThemeBtn(theme) {
    const btn = document.getElementById('btn-theme-toggle');
    if (btn) {
        btn.innerHTML = theme === 'dark' ? '☀️ Modo Claro' : '🌙 Modo Oscuro';
    }
}

window.switchRoleView = switchRoleView;
window.triggerDemoReset = triggerDemoReset;
window.toggleTheme = toggleTheme;
