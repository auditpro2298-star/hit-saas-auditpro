-- ============================================================================
-- HIT SaaS — Datos Iniciales de Demostración (Seed Data con UUIDs e Histórico)
-- ============================================================================

-- Limpiar datos previos si se re-ejecuta en entorno de desarrollo local
DELETE FROM whatsapp_notifications;
DELETE FROM cuotas;
DELETE FROM ficheros;
DELETE FROM clientes;
DELETE FROM usuarios;
DELETE FROM empresas;

-- 1. EMPRESAS (Tenants)
INSERT INTO empresas (id_empresa, nombre_comercial, cuit_rut, estado_suscripcion, logo_url, monto_abono_mensual) VALUES
(1, 'ElectroHogar S.A.', '30-71234567-8', 'ACTIVA', 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=150', 35000.00),
(2, 'Muebles & Confort del Sur', '30-79876543-2', 'ACTIVA', 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=150', 35000.00),
(3, 'Fiados La Económica', '30-65432109-1', 'BLOQUEADA', 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=150', 35000.00);

-- 2. USUARIOS (Súper Admin global, Admins de Empresa y Cobradores en calle)
INSERT INTO usuarios (id_usuario, id_empresa, nombre, email, password_hash, rol, telefono, zona_asignada, activo) VALUES
(1, NULL, 'Martín (Súper Admin SaaS)', 'admin@hitsaas.com', '$2a$10$X7.m.E.g.a.b.c.d.e.f.g.h.i.j.k.l.m.n.o.p.q.r.s.t.u.v', 'SUPER_ADMIN', '+54 9 11 0000-0000', 'Global', 1),
(2, 1, 'Roberto González (Admin ElectroHogar)', 'admin@electrohogar.com', '$2a$10$X7.m.E.g.a.b.c.d.e.f.g.h.i.j.k.l.m.n.o.p.q.r.s.t.u.v', 'ADMIN_EMPRESA', '+54 9 11 2233-4455', 'Oficina Central', 1),
(3, 1, 'Juan Pérez (Cobrador Flores)', 'juan@electrohogar.com', '$2a$10$X7.m.E.g.a.b.c.d.e.f.g.h.i.j.k.l.m.n.o.p.q.r.s.t.u.v', 'COBRADOR', '+54 9 11 3344-5566', 'Flores / Caballito', 1),
(4, 1, 'Diego Silva (Cobrador Avellaneda)', 'diego@electrohogar.com', '$2a$10$X7.m.E.g.a.b.c.d.e.f.g.h.i.j.k.l.m.n.o.p.q.r.s.t.u.v', 'COBRADOR', '+54 9 11 4455-6677', 'Avellaneda / Sur', 1),
(5, 2, 'Elena Martínez (Admin Muebles Sur)', 'admin@mueblesdelsur.com', '$2a$10$X7.m.E.g.a.b.c.d.e.f.g.h.i.j.k.l.m.n.o.p.q.r.s.t.u.v', 'ADMIN_EMPRESA', '+54 9 11 5566-7788', 'Central Sur', 1),
(6, 1, 'Milagros', 'milagros@electrohogar.com', '$2a$10$X7.m.E.g.a.b.c.d.e.f.g.h.i.j.k.l.m.n.o.p.q.r.s.t.u.v', 'VENDEDOR', '+54 9 11 9988-7766', 'Berazategui / Flores', 1),
(7, 1, 'Carlos', 'carlos@electrohogar.com', '$2a$10$X7.m.E.g.a.b.c.d.e.f.g.h.i.j.k.l.m.n.o.p.q.r.s.t.u.v', 'VENDEDOR', '+54 9 11 8877-6655', 'Zona Sur / Caballito', 1);

-- 3. CLIENTES (Cartera de ElectroHogar S.A. con UUIDs v4 aleatorios e irrepetibles para máxima seguridad QR)
INSERT INTO clientes (id_cliente, id_empresa, nombre_apellido, dni, telefono, direccion, barrio, latitud, longitud, qr_token, calificacion) VALUES
(1, 1, 'Marcelo Gómez', '28912345', '+54 9 11 8877-6655', 'Av. Rivadavia 6500', 'Flores', -34.628000, -58.462000, '4f3b9a12-e82b-4cc3-a123-456789abcdef', 'BUENO'),
(2, 1, 'Lucía Fernández', '32456789', '+54 9 11 7766-5544', 'José María Moreno 420', 'Caballito', -34.618000, -58.442000, '9b8c7d6e-5f4a-3b2c-1d0e-9a8b7c6d5e4f', 'BUENO'),
(3, 1, 'Carlos Mendoza', '25111222', '+54 9 11 6655-4433', 'Boyacá 1100', 'Flores', -34.631000, -58.468000, 'd92e1a84-7f1c-4b3d-8e4a-5678901234cd', 'REGULAR'),
(4, 2, 'Sofía Ramírez', '39888777', '+54 9 11 5544-3322', 'Av. Mitre 1500', 'Avellaneda', -34.662000, -58.364000, 'c34f8d91-2a1e-4b7c-9d3e-1234567890ef', 'BUENO');

-- 4. FICHEROS / VENTAS (Venta en 34 cuotas semanales de Electrodomésticos y Muebles)
INSERT INTO ficheros (id_fichero, id_cliente, id_empresa, producto_nombre, cantidad_cuotas, valor_cuota, frecuencia_pago, monto_total, vendedor, encargado_zona, id_cobrador_asignado, fecha_entrega, estado) VALUES
(101, 1, 1, 'Smart TV 50" 4K Samsung + Soporte', 34, 4500.00, 'SEMANAL', 153000.00, 'Milagros', 'Natasha', 3, '2026-06-01', 'ACTIVO'),
(102, 2, 1, 'Heladera No Frost 380L Inox', 34, 6200.00, 'SEMANAL', 210800.00, 'Milagros', 'Natasha', 3, '2026-06-15', 'ACTIVO'),
(103, 3, 1, 'Lavarropas Automático 8Kg Inverter', 20, 5000.00, 'QUINCENAL', 100000.00, 'Vendedora Ana', 'Natasha', 3, '2026-06-20', 'ACTIVO'),
(104, 4, 2, 'Juego de Comedor Mesa + 6 Sillas', 24, 5500.00, 'MENSUAL', 132000.00, 'Vendedor Marcos', 'Elena Martínez', 5, '2026-06-10', 'ACTIVO');

-- 5. CUOTAS (Detalle de los casilleros para Fichero #101 con histórico de cobrador y promesas de pago)
INSERT INTO cuotas (id_fichero, id_empresa, nro_cuota, monto, estado, fecha_vencimiento, fecha_pago, medio_pago, comprobante_img_url, motivo_no_cobro, promesa_pago_fecha, id_cobrador, nombre_cobrador, notas) VALUES
(101, 1, 1, 4500.00, 'PAGADO', '2026-06-08', '2026-06-08 11:30:00', 'EFECTIVO', NULL, NULL, NULL, 3, 'Juan Pérez (Cobrador Flores)', 'Cobrado en puerta en efectivo'),
(101, 1, 2, 4500.00, 'PAGADO', '2026-06-15', '2026-06-15 12:15:00', 'TRANSFERENCIA', 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=400', NULL, NULL, 3, 'Juan Pérez (Cobrador Flores)', 'Transferencia comprobante verificado'),
(101, 1, 3, 4500.00, 'NO_COBRADO', '2026-06-22', '2026-06-22 17:00:00', NULL, NULL, 'PASA_MAÑANA - Pide pasar el jueves', '2026-06-25 10:00:00', 3, 'Juan Pérez (Cobrador Flores)', 'Cliente pide pasar el jueves próximo a la mañana'),
(101, 1, 4, 4500.00, 'PENDIENTE', '2026-06-29', NULL, NULL, NULL, NULL, NULL, 3, NULL, NULL),
(101, 1, 5, 4500.00, 'PENDIENTE', '2026-07-06', NULL, NULL, NULL, NULL, NULL, 3, NULL, NULL),
(101, 1, 6, 4500.00, 'PENDIENTE', '2026-07-13', NULL, NULL, NULL, NULL, NULL, 3, NULL, NULL),
(101, 1, 7, 4500.00, 'PENDIENTE', '2026-07-20', NULL, NULL, NULL, NULL, NULL, 3, NULL, NULL),
(101, 1, 8, 4500.00, 'PENDIENTE', '2026-07-27', NULL, NULL, NULL, NULL, NULL, 3, NULL, NULL);

-- Cuotas para Fichero #102 (Lucía Fernández)
INSERT INTO cuotas (id_fichero, id_empresa, nro_cuota, monto, estado, fecha_vencimiento, fecha_pago, medio_pago, comprobante_img_url, motivo_no_cobro, promesa_pago_fecha, id_cobrador, nombre_cobrador) VALUES
(102, 1, 1, 6200.00, 'PAGADO', '2026-06-22', '2026-06-22 10:00:00', 'EFECTIVO', NULL, NULL, NULL, 3, 'Juan Pérez (Cobrador Flores)'),
(102, 1, 2, 6200.00, 'PENDIENTE', '2026-06-29', NULL, NULL, NULL, NULL, NULL, 3, NULL),
(102, 1, 3, 6200.00, 'PENDIENTE', '2026-07-06', NULL, NULL, NULL, NULL, NULL, 3, NULL);

-- Cuotas para Fichero #103 (Carlos Mendoza) - Con promesa de pago incumplida de muestra
INSERT INTO cuotas (id_fichero, id_empresa, nro_cuota, monto, estado, fecha_vencimiento, fecha_pago, medio_pago, comprobante_img_url, motivo_no_cobro, promesa_pago_fecha, id_cobrador, nombre_cobrador, notas) VALUES
(103, 1, 1, 5000.00, 'NO_COBRADO', '2026-06-27', '2026-06-27 18:00:00', NULL, NULL, 'SIN_DINERO - Dijo que no tiene hoy', '2026-06-30 15:00:00', 3, 'Juan Pérez (Cobrador Flores)', 'Prometió pagar a fin de mes'),
(103, 1, 2, 5000.00, 'PENDIENTE', '2026-07-04', NULL, NULL, NULL, NULL, NULL, 3, NULL, NULL);

-- 6. NOTIFICACIONES WHATSAPP SEMILLA (Demostración transparente de envíos automáticos)
INSERT INTO whatsapp_notifications (id_empresa, id_cliente, id_cuota, telefono_cliente, mensaje, estado) VALUES
(1, 1, 1, '+54 9 11 8877-6655', 'Hola Marcelo Gómez, HIT detectó tu pago de la cuota 1 por $4,500 en EFECTIVO. Saldo restante: $148,500. Mirá tu cartilla acá: http://localhost:3000/?qr_cartilla=4f3b9a12-e82b-4cc3-a123-456789abcdef', 'ENVIADO'),
(1, 1, 2, '+54 9 11 8877-6655', 'Hola Marcelo Gómez, HIT detectó tu pago de la cuota 2 por $4,500 en TRANSFERENCIA. Saldo restante: $144,000. Mirá tu cartilla acá: http://localhost:3000/?qr_cartilla=4f3b9a12-e82b-4cc3-a123-456789abcdef', 'ENVIADO'),
(1, 2, 1, '+54 9 11 7766-5544', 'Hola Lucía Fernández, HIT detectó tu pago de la cuota 1 por $6,200 en EFECTIVO. Saldo restante: $204,600. Mirá tu cartilla acá: http://localhost:3000/?qr_cartilla=9b8c7d6e-5f4a-3b2c-1d0e-9a8b7c6d5e4f', 'ENVIADO');
