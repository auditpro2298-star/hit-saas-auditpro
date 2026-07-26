const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./database');

// Importar rutas de los 4 niveles y autenticación
const authRoutes = require('./routes/auth.routes');
const superAdminRoutes = require('./routes/superadmin.routes');
const empresaRoutes = require('./routes/empresa.routes');
const cobradorRoutes = require('./routes/cobrador.routes');
const clienteRoutes = require('./routes/cliente.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de middlewares globales
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const fs = require('fs');

// Sincronizar frontend a backend/public para despliegue en Render / Nube
const rootFrontendPath = path.join(__dirname, '..', 'frontend');
const backendPublicPath = path.join(__dirname, 'public');
if (fs.existsSync(path.join(rootFrontendPath, 'index.html'))) {
    try {
        fs.cpSync(rootFrontendPath, backendPublicPath, { recursive: true });
    } catch (err) {
        // Ignorar error si no hay permisos de escritura
    }
}

// Encontrar dinámicamente la ruta del directorio frontend
const possibleFrontendPaths = [
    backendPublicPath,
    path.join(__dirname, 'frontend'),
    rootFrontendPath,
    path.join(process.cwd(), 'public'),
    path.join(process.cwd(), 'frontend'),
    path.join(process.cwd(), '..', 'frontend')
];

let frontendPath = possibleFrontendPaths.find(p => fs.existsSync(path.join(p, 'index.html')));

if (!frontendPath) {
    console.error('⚠️ ALERTA: No se encontró index.html en las rutas frontend conocidas.');
    frontendPath = backendPublicPath;
} else {
    console.log(`📁 Carpeta Frontend vinculada con éxito: ${frontendPath}`);
}

// Servir el Frontend Multi-Portal (Archivos estáticos CSS, JS, HTML y Assets)
app.use(express.static(frontendPath));

// Montar Rutas API
app.use('/api/auth', authRoutes);
app.use('/api/superadmin', superAdminRoutes);
app.use('/api/empresa', empresaRoutes);
app.use('/api/cobrador', cobradorRoutes);
app.use('/api/cliente', clienteRoutes);

// Ruta de fallback para SPA (Single Page Application): Cualquier otra ruta redirige a index.html
app.get('*', (req, res) => {
    const indexPath = path.join(frontendPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('<h1>HIT SaaS — Error 404</h1><p>No se encontró el archivo index.html en el servidor.</p>');
    }
});

// Iniciar servidor tras asegurar inicialización de Base de Datos
(async () => {
    try {
        await initDatabase();
        app.listen(PORT, () => {
            console.log('\n======================================================');
            console.log('🌟 HIT SaaS Multi-Tenant API & Web App en Ejecución');
            console.log(`🌐 Servidor: http://localhost:${PORT}`);
            console.log('======================================================\n');
        });
    } catch (err) {
        console.error('❌ Error crítico al iniciar servidor:', err);
    }
})();

module.exports = app;
