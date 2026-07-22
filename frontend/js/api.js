/* ============================================================================
   HIT SaaS — Cliente HTTP & Manejo de Autenticación JWT
   ============================================================================ */

const API_BASE = '/api';

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
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                // Si el error es por suscripción bloqueada o cobrador desactivado, cerrarle la sesión en el acto y alertar
                if (data.error === 'SUSCRIPCION_BLOQUEADA' || data.error === 'USUARIO_INACTIVO') {
                    this.setAuth(null, null); // Cerrar sesión y borrar caché del celular/navegador en 1 clic
                    this.showBlockModal(data.message);
                }
                throw new Error(data.message || data.error || `Error HTTP ${response.status}`);
            }

            return data;
        } catch (err) {
            console.error(`Error en API (${endpoint}):`, err.message);
            throw err;
        }
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

    showBlockModal(message) {
        // Ocultar paneles para evitar que sigan viendo datos o cobrando si los echaron o deshabilitaron
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
            alert('🚫 ALERTA SAAS:\n\n' + message);
        }
    }
}

const api = new APIClient();
window.api = api;
