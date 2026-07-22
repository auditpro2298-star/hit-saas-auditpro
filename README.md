# ⚡ HIT — Software as a Service (SaaS) Multi-Tenant

**HIT** es una plataforma universal y moderna tipo **SaaS (Software as a Service)** diseñada específicamente para casas de venta en cuotas, fiados y micro-créditos. Su arquitectura multi-inquilino (*Multi-tenant*) permite que múltiples empresas coexistan de forma segura y aislada en una misma base de datos, pagando una suscripción mensual.

---

## 🏛️ Estructura de 4 Niveles de Acceso

1. **👑 Nivel 1: Súper Admin (Tu Control SaaS)**
   - Panel de control global para dar de alta nuevas empresas y gestionar su abono mensual.
   - **Bloqueo en 1 clic**: Si una empresa no abona su cuota, al cambiar su estado a `BLOQUEADA`, se deshabilita instantáneamente el acceso a sus administradores y cobradores con aviso en pantalla.
   - Métricas en tiempo real: MRR (Ingreso Mensual Recurrente), volumen total recaudado y empresas activas.

2. **🏢 Nivel 2: Admin de Empresa (Casa de Cuotas / Dueños)**
   - **Geolocalización & Cartera de Clientes**: Alta de clientes con coordenadas GPS en mapa interactivo y generación automática de tarjeta/código QR único e imprimible.
   - **Ficheros Digitales (Calco del Fichero de Papel)**: Creación de planes de cuotas (ej: 34 cuotas semanales de $5,000) con vencimientos automáticos.
   - **Asignación Dinámica de Rutas**: Drag & drop / selección visual para asignar ficheros a cobradores específicos por zona.
   - **Auditoría de Caja Diaria**: Arqueo segregado por cobrador (Efectivo vs. Transferencias) y conciliación de comprobantes con fotos de capturas bancarias.

3. **📱 Nivel 3: App Móvil del Cobrador (Calle)**
   - **Sincronización de Hoja de Ruta**: Lista de clientes priorizada por zona con semáforo de próximos vencimientos.
   - **Escáner de Tarjetas QR en Vivo**: Lector de cámara integrado. Al apuntar a la tarjeta física del cliente, abre de inmediato la planilla del fichero digital.
   - **Casilleros Interactivos (1 al 34+)**: Registro de cobro en **Efectivo** (GPS + hora), **Transferencia** (con subida obligatoria de foto/comprobante) o **Visita No Cobrada** con motivos estandarizados (*Ausente*, *Pasa mañana*, *Domicilio cerrado*, etc.).

4. **💳 Nivel 4: Vista de Cliente (Cartilla Virtual QR / Solo Lectura)**
   - Acceso instantáneo por escaneo del código QR sin necesidad de contraseñas ni instalar aplicaciones pesadas.
   - Visualización de cuotas pagadas en verde, cuotas pendientes, porcentaje de progreso y saldo restante.

---

## 🚀 Instalación y Puesta en Marcha (Local & GitHub)

El sistema está preconfigurado con un motor dual que utiliza **SQLite autoinicializable (`database.js`)** para desarrollo local inmediato y es 100% compatible con **PostgreSQL (`schema.sql`)** para producción en la nube.

### 1. Clonar o descargar el repositorio
```bash
git clone https://github.com/auditpro2298-star/auditpro2298.git
cd auditpro2298
```

### 2. Instalar dependencias del servidor
```bash
cd backend
npm install
```

### 3. Iniciar el servidor local
```bash
npm run dev
```

Abre tu navegador web en: **[http://localhost:3000](http://localhost:3000)**

Al iniciar por primera vez, el backend creará la base de datos `backend/hit_saas.sqlite` e importará automáticamente el esquema (`database/schema.sql`) y los datos semilla de demostración (`database/seed.sql`).

---

## 🧪 Datos de Prueba para Demostración

La interfaz web incluye botones de **cambio rápido de nivel (pills superiores)** que te conectan automáticamente a los siguientes usuarios de demostración:

- **👑 Súper Admin SaaS**: `admin@hitsaas.com` / Contraseña: `admin123`
- **🏢 Admin Empresa (ElectroHogar S.A.)**: `admin@electrohogar.com` / Contraseña: `admin123`
- **📱 Cobrador en Calle (Juan - Zona Flores)**: `juan@electrohogar.com` / Contraseña: `cobrador123`
- **💳 Cartillas QR de Demo**: Tokens `HIT-QR-8821-A90F` (Marcelo Gómez) y `HIT-QR-9932-B81C` (Lucía Fernández)

---

## 🗄️ Esquema de Base de Datos para Producción (PostgreSQL)

El archivo oficial **[`database/schema.sql`](file:///C:/Users/cholo/Desktop/auditpro2298/database/schema.sql)** contiene la definición relacional con claves foráneas e índices optimizados:
- `empresas` (Tenants multi-inquilino)
- `usuarios` (Roles y zonas)
- `clientes` (Coordenadas geográficas y tokens QR)
- `ficheros` (Contratos de venta / planes de cuotas)
- `cuotas` (Casilleros individuales del 1 al 34 con medio de pago y foto de comprobante)
- `auditoria_caja` (Rendición diaria segregada)
