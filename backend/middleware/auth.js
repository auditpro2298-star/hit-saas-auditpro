const jwt = require('jsonwebtoken');
const { get } = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'HIT_SAAS_SUPER_SECRET_KEY_2026';

// Middleware para verificar autenticación y estado de suscripción del Tenant
async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Acceso denegado. No se proporcionó token de autenticación.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;

        // 1. Verificación de seguridad en tiempo real: ¿El cobrador / usuario sigue activo o lo bloquearon/echáron?
        const usuarioDb = await get('SELECT id_usuario, activo FROM usuarios WHERE id_usuario = ?', [req.user.id_usuario]);
        if (!usuarioDb || !usuarioDb.activo) {
            return res.status(403).json({
                error: 'USUARIO_INACTIVO',
                message: '🚫 Tu acceso como usuario / cobrador ha sido deshabilitado instantáneamente por la administración.'
            });
        }

        // 2. Verificación de seguridad multi-tenant en tiempo real: ¿La empresa pagó la suscripción o está bloqueada?
        if (req.user.id_empresa) {
            const empresa = await get('SELECT id_empresa, nombre_comercial, estado_suscripcion FROM empresas WHERE id_empresa = ?', [req.user.id_empresa]);
            if (!empresa) {
                return res.status(404).json({ error: 'Empresa no encontrada.' });
            }
            if (empresa.estado_suscripcion === 'BLOQUEADA' || empresa.estado_suscripcion === 'VENCIDA') {
                return res.status(403).json({
                    error: 'SUSCRIPCION_BLOQUEADA',
                    message: `⚠️ La suscripción del sistema para "${empresa.nombre_comercial}" se encuentra ${empresa.estado_suscripcion}. Por favor comuníquese con el Súper Administrador para regularizar el abono.`
                });
            }
        }

        next();
    } catch (err) {
        return res.status(403).json({ error: 'Token inválido o expirado.' });
    }
}

// Middleware de autorización por Rol
function requireRole(roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.rol)) {
            return res.status(403).json({
                error: 'ACCESO_NO_AUTORIZADO',
                message: `Requiere uno de los siguientes roles: ${roles.join(', ')}. Tu rol actual es: ${req.user ? req.user.rol : 'Ninguno'}`
            });
        }
        next();
    };
}

module.exports = {
    authenticateToken,
    requireRole,
    JWT_SECRET
};
