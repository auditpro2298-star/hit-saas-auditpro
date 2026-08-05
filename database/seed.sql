-- ============================================================================
-- HIT SaaS — Datos Iniciales de Demostración (Seed Data con UUIDs e Histórico)
-- ============================================================================

-- 1. EMPRESAS (Tenants)
INSERT OR IGNORE INTO empresas (id_empresa, nombre_comercial, cuit_rut, estado_suscripcion, logo_url, monto_abono_mensual) VALUES
(1, 'Electro Genesis', '30-71234567-8', 'ACTIVA', '/logo_electro_genesis.jpg', 35000.00),
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
(9, 1, 'Quilmes Manager (Encargado Quilmes)', 'quilmes_mgr@electrohogar.com', '$2a$10$/m9u5kd9Nr7NvWBZ0C6KquFrrw.n4MDqjUzlnM3dX0JYu6vfJxh.O', 'ENCARGADO_ZONA', '+54 9 11 6677-8899', 'Quilmes', true),
(10, 1, 'Admin Genesis', 'admin@genesis.com', '$2a$10$/m9u5kd9Nr7NvWBZ0C6KquFrrw.n4MDqjUzlnM3dX0JYu6vfJxh.O', 'ADMIN_EMPRESA', '+54 9 11 2233-4455', 'Oficina Central', true),
(11, 1, 'Nico Cobrador', 'nico@genesis.com', '$2a$10$TXKkejXO.73TTotU1FbKj.RfwVClKyafPBY0P6LaEErrZ9fy2ng2S', 'COBRADOR', '+54 9 11 3344-5566', 'Flores / Berazategui / General', true),
(12, 1, 'Coco Encargado', 'coco@genesis.com', '$2a$10$/m9u5kd9Nr7NvWBZ0C6KquFrrw.n4MDqjUzlnM3dX0JYu6vfJxh.O', 'ENCARGADO_ZONA', '+54 9 11 5566-7788', 'Flores / Berazategui / General', true);

-- 3. CLIENTES
INSERT OR IGNORE INTO clientes (id_cliente, id_empresa, nombre_apellido, dni, telefono, direccion, barrio, piso_dpto, referencia_domicilio, latitud, longitud, qr_token, calificacion, encargado_zona) VALUES
(1, 1, 'Marcelo Gómez', '30123456', '+54 9 11 4455-6677', 'Av. San Martín 1234', 'Flores', '2 B', 'Frente a la plaza central', '-34.628', '-58.462', '4f3b9a12-e82b-4cc3-a123-456789abcdef', 'BUENO', 'Coco Encargado'),
(2, 1, 'Lucía Fernández', '32987654', '+54 9 11 8877-6655', 'Calle 14 nro 456', 'Berazategui', 'PB', 'Portón blanco', '-34.764', '-58.249', '9b8c7d6e-5f4a-3b2c-1d0e-9a8b7c6d5e4f', 'EXCELENTE', 'Coco Encargado');

-- 4. FICHEROS (Ventas)
INSERT OR IGNORE INTO ficheros (id_fichero, id_cliente, id_empresa, producto_nombre, cantidad_cuotas, valor_cuota, frecuencia_pago, monto_total, vendedor, encargado_zona, id_cobrador_asignado, orden_visita, fecha_entrega, estado) VALUES
(1, 1, 1, 'Smart TV 55 Samsung', 16, 22000.00, 'SEMANAL', 352000.00, 'Milagros', 'Coco Encargado', 11, 1, date('now'), 'ACTIVO');

-- 5. CUOTAS (Casilleros y cobros realizados hoy)
INSERT OR IGNORE INTO cuotas (id_cuota, id_fichero, id_empresa, nro_cuota, monto, estado, medio_pago, fecha_pago, fecha_vencimiento, id_cobrador, nombre_cobrador) VALUES
(101, 1, 1, 1, 22000.00, 'PAGADO', 'EFECTIVO', datetime('now'), date('now'), 11, 'Nico Cobrador'),
(102, 1, 1, 2, 22000.00, 'PAGADO', 'TRANSFERENCIA', datetime('now'), date('now'), 11, 'Nico Cobrador'),
(103, 1, 1, 3, 22000.00, 'NO_COBRADO', 'NINGUNO', NULL, date('now'), 11, 'Nico Cobrador');

-- 6. WHATSAPP NOTIFICATIONS
INSERT OR IGNORE INTO whatsapp_notifications (id_notificacion, id_empresa, id_cliente, id_cuota, telefono_cliente, mensaje, estado, fecha_envio) VALUES
(1, 1, 1, 101, '+54 9 11 4455-6677', '✅ Comprobante Virtual HIT SaaS: Cuota #1 abonada ($22.000 ARS en EFECTIVO). Cobrador: Nico. Saldo pendiente: $308.000 ARS.', 'ENVIADO', datetime('now')),
(2, 1, 1, 102, '+54 9 11 4455-6677', '📸 Comprobante Virtual HIT SaaS: Cuota #2 abonada ($22.000 ARS por TRANSFERENCIA BANCARIA). Comprobante en verificación por tesorería. ¡Muchas gracias!', 'ENVIADO', datetime('now'));


