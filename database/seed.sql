-- ============================================================================
-- HIT SaaS — Datos Iniciales de Demostración (Seed Data con UUIDs e Histórico)
-- ============================================================================

-- 1. EMPRESAS (Tenants)
INSERT OR IGNORE INTO empresas (id_empresa, nombre_comercial, cuit_rut, estado_suscripcion, logo_url, monto_abono_mensual) VALUES
(1, 'ElectroHogar S.A.', '30-71234567-8', 'ACTIVA', 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=150', 35000.00),
(2, 'Muebles & Confort del Sur', '30-79876543-2', 'ACTIVA', 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=150', 35000.00),
(3, 'Fiados La Económica', '30-65432109-1', 'BLOQUEADA', 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=150', 35000.00);

-- 2. USUARIOS (Súper Admin global, Admins de Empresa y Cobradores en calle)
INSERT OR IGNORE INTO usuarios (id_usuario, id_empresa, nombre, email, password_hash, rol, telefono, zona_asignada, activo) VALUES
(1, NULL, 'Martín (Súper Admin SaaS)', 'admin@hitsaas.com', '$2a$10$/m9u5kd9Nr7NvWBZ0C6KquFrrw.n4MDqjUzlnM3dX0JYu6vfJxh.O', 'SUPER_ADMIN', '+54 9 11 0000-0000', 'Global', true),
(2, 1, 'Roberto González (Admin ElectroHogar)', 'admin@electrohogar.com', '$2a$10$/m9u5kd9Nr7NvWBZ0C6KquFrrw.n4MDqjUzlnM3dX0JYu6vfJxh.O', 'ADMIN_EMPRESA', '+54 9 11 2233-4455', 'Oficina Central', true),
(3, 1, 'Juan Pérez (Cobrador Flores)', 'juan@electrohogar.com', '$2a$10$TXKkejXO.73TTotU1FbKj.RfwVClKyafPBY0P6LaEErrZ9fy2ng2S', 'COBRADOR', '+54 9 11 3344-5566', 'Flores / Caballito', true),
(4, 1, 'Diego Silva (Cobrador Avellaneda)', 'diego@electrohogar.com', '$2a$10$TXKkejXO.73TTotU1FbKj.RfwVClKyafPBY0P6LaEErrZ9fy2ng2S', 'COBRADOR', '+54 9 11 4455-6677', 'Avellaneda / Sur', true),
(5, 2, 'Elena Martínez (Admin Muebles Sur)', 'admin@mueblesdelsur.com', '$2a$10$/m9u5kd9Nr7NvWBZ0C6KquFrrw.n4MDqjUzlnM3dX0JYu6vfJxh.O', 'ADMIN_EMPRESA', '+54 9 11 5566-7788', 'Central Sur', true),
(6, 1, 'Milagros', 'milagros@electrohogar.com', '$2a$10$/m9u5kd9Nr7NvWBZ0C6KquFrrw.n4MDqjUzlnM3dX0JYu6vfJxh.O', 'VENDEDOR', '+54 9 11 9988-7766', 'Berazategui / Flores', true),
(7, 1, 'Carlos', 'carlos@electrohogar.com', '$2a$10$/m9u5kd9Nr7NvWBZ0C6KquFrrw.n4MDqjUzlnM3dX0JYu6vfJxh.O', 'VENDEDOR', '+54 9 11 8877-6655', 'Zona Sur / Caballito', true),
(8, 1, 'Carlos Gómez (Encargado Berazategui)', 'carlos_zona@electrohogar.com', '$2a$10$/m9u5kd9Nr7NvWBZ0C6KquFrrw.n4MDqjUzlnM3dX0JYu6vfJxh.O', 'ENCARGADO_ZONA', '+54 9 11 5566-7788', 'Berazategui', true),
(9, 1, 'Quilmes Manager (Encargado Quilmes)', 'quilmes_mgr@electrohogar.com', '$2a$10$/m9u5kd9Nr7NvWBZ0C6KquFrrw.n4MDqjUzlnM3dX0JYu6vfJxh.O', 'ENCARGADO_ZONA', '+54 9 11 6677-8899', 'Quilmes', true);

