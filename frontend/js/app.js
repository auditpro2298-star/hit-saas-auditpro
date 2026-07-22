/* ============================================================================
   HIT SaaS — Gestor Global SPA & Enrutador por Nivel de Acceso Seguro
   ============================================================================ */

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 HIT SaaS Multi-Tenant Web & Mobile Experience cargado.');

    initTheme();

    // 1. Si la URL tiene ?qr_cartilla=... abrir la Cartilla Pública de Cliente (Nivel 4 sin login)
    const urlParams = new URLSearchParams(window.location.search);
    const cartillaToken = urlParams.get('qr_cartilla');
    if (cartillaToken) {
        showPanel('panel-cliente');
        if (window.loadCartillaPublica) window.loadCartillaPublica(cartillaToken);
        return;
    }

    // 2. Verificar si hay token previo guardado en localStorage
    if (api.token) {
        try {
            const res = await api.get('/auth/me');
            if (res && res.user) {
                routeUserByRole(res.user);
                return;
            }
        } catch (err) {
            console.warn('Sesión expirada o inválida:', err.message);
            api.setAuth(null, null);
        }
    }

    // 3. Si no hay sesión activa, mostrar pantalla de Login Obligatoria
    showLoginPanel();
});

function showLoginPanel() {
    currentUser = null;
    showPanel('panel-login');
    const badge = document.getElementById('user-status-badge');
    if (badge) badge.innerText = '👤 No conectado';
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) logoutBtn.classList.add('hidden');
    const switcher = document.getElementById('role-switcher-bar');
    if (switcher) switcher.classList.add('hidden');
}

function showPanel(panelId) {
    document.querySelectorAll('.role-panel').forEach(p => p.classList.add('hidden'));
    const target = document.getElementById(panelId);
    if (target) target.classList.remove('hidden');
}

function routeUserByRole(user) {
    currentUser = user;
    updateUserBadge(user);

    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) logoutBtn.classList.remove('hidden');

    if (user.rol === 'SUPERADMIN') {
        showPanel('panel-superadmin');
        const switcher = document.getElementById('role-switcher-bar');
        if (switcher) switcher.classList.remove('hidden'); // Solo visible si eres Súper Admin
        if (window.initSuperAdminPanel) window.initSuperAdminPanel();
    } else if (user.rol === 'ADMIN_EMPRESA' || user.rol === 'VENDEDOR') {
        showPanel('panel-empresa');
        if (window.initEmpresaPanel) window.initEmpresaPanel();
    } else if (user.rol === 'COBRADOR') {
        showPanel('panel-cobrador');
        if (window.initCobradorApp) window.initCobradorApp();
    } else {
        showLoginPanel();
    }
}

async function submitLoginForm(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-pass').value.trim();

    try {
        const res = await api.post('/auth/login', { email, password });
        if (res.success && res.token) {
            api.setAuth(res.token, res.user);
            routeUserByRole(res.user);
        } else {
            alert('⚠️ Error de autenticación: ' + (res.error || 'Credenciales no válidas'));
        }
    } catch (err) {
        alert('🚫 Error al iniciar sesión: ' + err.message);
    }
}

function fillLoginFields(email, pass) {
    document.getElementById('login-email').value = email;
    document.getElementById('login-pass').value = pass;
}

function logout() {
    api.setAuth(null, null);
    showLoginPanel();
}

function updateUserBadge(user) {
    const badge = document.getElementById('user-status-badge');
    if (badge && user) {
        badge.innerHTML = `👤 ${user.nombre} <span style="opacity:0.65;">(${user.rol})</span>`;
    }
}

// Compatibilidad para cambio manual si sos Súper Admin
async function switchRoleView(role, extraParam = null) {
    if (!currentUser || currentUser.rol !== 'SUPERADMIN') {
        alert('🔒 Acción reservada únicamente al Súper Administrador.');
        return;
    }
    if (role === 'superadmin') routeUserByRole({ ...currentUser, rol: 'SUPERADMIN' });
    else if (role === 'empresa') routeUserByRole({ ...currentUser, rol: 'ADMIN_EMPRESA' });
    else if (role === 'cobrador') routeUserByRole({ ...currentUser, rol: 'COBRADOR' });
    else if (role === 'cliente') {
        showPanel('panel-cliente');
        if (window.loadCartillaPublica) window.loadCartillaPublica(extraParam || 'HIT-QR-8821-A90F');
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

function consultarCartillaPublicaDirecta() {
    const input = document.getElementById('public-qr-input');
    const val = input ? input.value.trim() : '';
    if (!val) {
        alert('⚠️ Por favor ingrese su código QR o DNI para consultar su libreta de cuotas.');
        return;
    }
    showPanel('panel-cliente');
    if (window.loadCartillaPublica) {
        window.loadCartillaPublica(val);
    }
}

window.submitLoginForm = submitLoginForm;
window.fillLoginFields = fillLoginFields;
window.logout = logout;
window.switchRoleView = switchRoleView;
window.toggleTheme = toggleTheme;
window.consultarCartillaPublicaDirecta = consultarCartillaPublicaDirecta;
