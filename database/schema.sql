-- ============================================================================
-- HIT SaaS — Software as a Service Multi-Tenant
-- Esquema de Base de Datos para PostgreSQL (Producción) & SQLite (Desarrollo)
-- ============================================================================

-- Reinicio limpio en desarrollo / re-seed
DROP TABLE IF EXISTS whatsapp_notifications;
DROP TABLE IF EXISTS auditoria_caja;
DROP TABLE IF EXISTS cuotas;
DROP TABLE IF EXISTS ficheros;
DROP TABLE IF EXISTS clientes;
DROP TABLE IF EXISTS usuarios;
DROP TABLE IF EXISTS empresas;

-- ----------------------------------------------------------------------------
-- 1. TABLA: empresas (Tenants - Inquilinos del SaaS)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS empresas (
    id_empresa INTEGER PRIMARY KEY AUTOINCREMENT, -- En PostgreSQL cambiar a SERIAL PRIMARY KEY
    nombre_comercial VARCHAR(150) NOT NULL,
    cuit_rut VARCHAR(50) NOT NULL UNIQUE,
    estado_suscripcion VARCHAR(30) NOT NULL DEFAULT 'ACTIVA', -- Valores: 'ACTIVA', 'VENCIDA', 'BLOQUEADA', 'PRUEBA'
    logo_url VARCHAR(500) DEFAULT 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=150',
    monto_abono_mensual DECIMAL(12,2) DEFAULT 35000.00,
    fecha_alta TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ultimo_pago TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 2. TABLA: usuarios (Credenciales para Súper Admin, Admin Empresa y Cobradores)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
    id_empresa INTEGER NULL, -- NULL para el SUPER_ADMIN del SaaS
    nombre VARCHAR(120) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    rol VARCHAR(30) NOT NULL, -- Valores: 'SUPER_ADMIN', 'ADMIN_EMPRESA', 'COBRADOR'
    telefono VARCHAR(50),
    zona_asignada VARCHAR(100) DEFAULT 'General',
    activo BOOLEAN DEFAULT 1,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_empresa) REFERENCES empresas(id_empresa) ON DELETE CASCADE
);

-- ----------------------------------------------------------------------------
-- 3. TABLA: clientes (Cartera de clientes con GPS y QR UUID v4 no predecible)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clientes (
    id_cliente INTEGER PRIMARY KEY AUTOINCREMENT,
    id_empresa INTEGER NOT NULL,
    nombre_apellido VARCHAR(150) NOT NULL,
    dni VARCHAR(30) NOT NULL,
    telefono VARCHAR(50),
    direccion VARCHAR(200) NOT NULL,
    barrio VARCHAR(100) NOT NULL,
    piso_dpto VARCHAR(50) NULL,
    referencia_domicilio VARCHAR(255) NULL,
    latitud DECIMAL(10,8) NULL,
    longitud DECIMAL(11,8) NULL,
    qr_token VARCHAR(100) NOT NULL UNIQUE, -- UUID v4 aleatorio e irrepetible para máxima seguridad
    calificacion VARCHAR(20) DEFAULT 'BUENO', -- 'BUENO', 'REGULAR', 'MOROSO'
    fecha_alta TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_empresa) REFERENCES empresas(id_empresa) ON DELETE CASCADE
);

-- ----------------------------------------------------------------------------
-- 4. TABLA: ficheros (Calco digital del Fichero de Papel - Origen de deuda)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ficheros (
    id_fichero INTEGER PRIMARY KEY AUTOINCREMENT,
    id_cliente INTEGER NOT NULL,
    id_empresa INTEGER NOT NULL,
    producto_nombre VARCHAR(200) NOT NULL,
    cantidad_cuotas INTEGER NOT NULL DEFAULT 34,
    valor_cuota DECIMAL(12,2) NOT NULL,
    frecuencia_pago VARCHAR(30) DEFAULT 'SEMANAL', -- 'SEMANAL', 'QUINCENAL', 'MENSUAL'
    monto_total DECIMAL(12,2) NOT NULL,
    vendedor VARCHAR(120),
    encargado_zona VARCHAR(120),
    id_cobrador_asignado INTEGER NULL,
    fecha_entrega DATE NOT NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'ACTIVO', -- 'ACTIVO', 'FINALIZADO', 'CANCELADO', 'MOROSO'
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    orden_visita INTEGER DEFAULT 0,
    FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente) ON DELETE CASCADE,
    FOREIGN KEY (id_empresa) REFERENCES empresas(id_empresa) ON DELETE CASCADE,
    FOREIGN KEY (id_cobrador_asignado) REFERENCES usuarios(id_usuario) ON DELETE SET NULL
);

-- ----------------------------------------------------------------------------
-- 5. TABLA: cuotas (Registro individual del casillero: 1 al 34 + Histórico Cobrador & Promesas)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cuotas (
    id_cuota INTEGER PRIMARY KEY AUTOINCREMENT,
    id_fichero INTEGER NOT NULL,
    id_empresa INTEGER NOT NULL,
    nro_cuota INTEGER NOT NULL, -- Casillero 1, 2, 3... hasta 34+
    monto DECIMAL(12,2) NOT NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE', -- 'PENDIENTE', 'PAGADO', 'NO_COBRADO'
    fecha_vencimiento DATE NOT NULL,
    fecha_pago TIMESTAMP NULL,
    medio_pago VARCHAR(30) NULL, -- 'EFECTIVO', 'TRANSFERENCIA'
    comprobante_img_url TEXT NULL, -- URL o base64 de captura bancaria
    motivo_no_cobro VARCHAR(100) NULL, -- 'AUSENTE', 'DOMICILIO_CERRADO', 'PASA_MAÑANA', 'SIN_DINERO'
    promesa_pago_fecha DATETIME NULL, -- Fecha y hora agendada en caso de promesa de pago
    id_cobrador INTEGER NULL,
    nombre_cobrador VARCHAR(120) NULL, -- Histórico inviolable del nombre del cobrador en ese momento
    lat_long_cobro VARCHAR(100) NULL,
    notas TEXT NULL,
    FOREIGN KEY (id_fichero) REFERENCES ficheros(id_fichero) ON DELETE CASCADE,
    FOREIGN KEY (id_empresa) REFERENCES empresas(id_empresa) ON DELETE CASCADE,
    FOREIGN KEY (id_cobrador) REFERENCES usuarios(id_usuario) ON DELETE SET NULL
);

-- ----------------------------------------------------------------------------
-- 6. TABLA: auditoria_caja (Arqueos diarios por cobrador y cierres)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auditoria_caja (
    id_caja INTEGER PRIMARY KEY AUTOINCREMENT,
    id_empresa INTEGER NOT NULL,
    id_cobrador INTEGER NOT NULL,
    fecha_caja DATE NOT NULL,
    total_efectivo DECIMAL(12,2) DEFAULT 0.00,
    total_transferencias DECIMAL(12,2) DEFAULT 0.00,
    cantidad_cobros INTEGER DEFAULT 0,
    estado_caja VARCHAR(30) DEFAULT 'ABIERTA', -- 'ABIERTA', 'CERRADA_CONCILIADA'
    observaciones TEXT,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_empresa) REFERENCES empresas(id_empresa) ON DELETE CASCADE,
    FOREIGN KEY (id_cobrador) REFERENCES usuarios(id_usuario) ON DELETE CASCADE
);

-- ----------------------------------------------------------------------------
-- 7. TABLA: whatsapp_notifications (Registro de alertas automáticas enviadas al cliente)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS whatsapp_notifications (
    id_notificacion INTEGER PRIMARY KEY AUTOINCREMENT,
    id_empresa INTEGER NOT NULL,
    id_cliente INTEGER NOT NULL,
    id_cuota INTEGER NOT NULL,
    telefono_cliente VARCHAR(50) NOT NULL,
    mensaje TEXT NOT NULL,
    estado VARCHAR(30) DEFAULT 'ENVIADO', -- 'ENVIADO', 'PENDIENTE_SYNC'
    fecha_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_empresa) REFERENCES empresas(id_empresa) ON DELETE CASCADE,
    FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente) ON DELETE CASCADE,
    FOREIGN KEY (id_cuota) REFERENCES cuotas(id_cuota) ON DELETE CASCADE
);

-- Índices de búsqueda para rendimiento
CREATE INDEX IF NOT EXISTS idx_clientes_empresa ON clientes(id_empresa);
CREATE INDEX IF NOT EXISTS idx_clientes_qr ON clientes(qr_token);
CREATE INDEX IF NOT EXISTS idx_ficheros_empresa ON ficheros(id_empresa);
CREATE INDEX IF NOT EXISTS idx_ficheros_cobrador ON ficheros(id_cobrador_asignado);
CREATE INDEX IF NOT EXISTS idx_cuotas_fichero ON cuotas(id_fichero);
CREATE INDEX IF NOT EXISTS idx_cuotas_empresa ON cuotas(id_empresa);
CREATE INDEX IF NOT EXISTS idx_cuotas_promesa ON cuotas(promesa_pago_fecha);
CREATE INDEX IF NOT EXISTS idx_whatsapp_empresa ON whatsapp_notifications(id_empresa);
