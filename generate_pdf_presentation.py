import os
import sys
from fpdf import FPDF

class PresentationPDF(FPDF):
    def __init__(self):
        super().__init__(orientation='L', unit='mm', format='A4')
        self.set_auto_page_break(False)
        # Intentar cargar fuentes de Windows para soporte unicode nativo (tildes)
        font_dir = r"C:\Windows\Fonts"
        arial_path = os.path.join(font_dir, "arial.ttf")
        arialbd_path = os.path.join(font_dir, "arialbd.ttf")
        ariali_path = os.path.join(font_dir, "ariali.ttf")
        
        if os.path.exists(arial_path) and os.path.exists(arialbd_path):
            self.add_font("Arial", "", arial_path)
            self.add_font("Arial", "B", arialbd_path)
            if os.path.exists(ariali_path):
                self.add_font("Arial", "I", ariali_path)
            else:
                self.add_font("Arial", "I", arial_path) # Fallback
            self.font_family_name = "Arial"
        else:
            # Fallback a Helvetica (codificación estándar latina)
            self.font_family_name = "Helvetica"
        
        # Paleta de Colores
        self.c_dark = (15, 23, 42)        # #0f172a
        self.c_light = (248, 250, 252)    # #f8fafc
        self.c_white = (255, 255, 255)    # #ffffff
        self.c_accent_blue = (59, 130, 246)  # #3b82f6
        self.c_accent_purple = (139, 92, 246) # #8b5cf6
        self.c_text_dark = (15, 23, 42)   # #0f172a
        self.c_text_muted = (100, 116, 139) # #64748b
        self.c_text_light = (241, 245, 249) # #f1f5f9
        
    def clean_text(self, text):
        # Si estamos usando Helvetica, fpdf requiere codificación latin1.
        # Si usamos Arial TrueType, unicode funciona directamente.
        if self.font_family_name == "Helvetica":
            return text.encode('latin1', 'replace').decode('latin1')
        return text

    def add_title_slide(self, title, subtitle, date_str, footer_str):
        self.add_page()
        # Fondo oscuro
        self.set_fill_color(*self.c_dark)
        self.rect(0, 0, 297, 210, "F")
        
        # Elemento decorativo inferior
        self.set_fill_color(30, 41, 59)
        self.rect(0, 195, 297, 15, "F")
        
        # Línea de acento
        self.set_fill_color(*self.c_accent_blue)
        self.rect(0, 193, 297, 2, "F")
        
        # Círculo decorativo
        self.set_draw_color(*self.c_accent_purple)
        self.set_line_width(0.8)
        self.circle(270, 25, 20, "D")
        
        # Título
        self.set_xy(20, 65)
        self.set_font(self.font_family_name, "B", 34)
        self.set_text_color(*self.c_white)
        self.multi_cell(257, 16, self.clean_text(title), align="L")
        
        # Subtítulo
        self.set_x(20)
        self.set_font(self.font_family_name, "", 16)
        self.set_text_color(*self.c_accent_blue)
        self.cell(257, 14, self.clean_text(subtitle), ln=1)
        
        # Fecha y Metadatos
        self.set_xy(20, 125)
        self.set_font(self.font_family_name, "", 11)
        self.set_text_color(*self.c_text_muted)
        self.multi_cell(200, 7, self.clean_text(f"Fecha: {date_str}\n{footer_str}"), align="L")
        
        # Marca de Agua / Branding
        self.set_xy(20, 198)
        self.set_font(self.font_family_name, "B", 10)
        self.set_text_color(*self.c_white)
        self.cell(100, 10, self.clean_text("⚡ HIT SaaS Platform — Software de Gestión y Cobranzas"))
        
    def add_content_slide(self, slide_num, title, left_text_blocks, image_path=None, is_image_vertical=False):
        self.add_page()
        
        # Fondo claro
        self.set_fill_color(*self.c_light)
        self.rect(0, 0, 297, 210, "F")
        
        # Barra superior de encabezado
        self.set_fill_color(*self.c_white)
        self.rect(0, 0, 297, 22, "F")
        self.set_fill_color(*self.c_accent_blue)
        self.rect(0, 21, 297, 1, "F")
        
        # Título del Slide
        self.set_xy(15, 6)
        self.set_font(self.font_family_name, "B", 16)
        self.set_text_color(*self.c_dark)
        self.cell(200, 10, self.clean_text(title))
        
        # Número de Diapositiva
        self.set_xy(260, 6)
        self.set_font(self.font_family_name, "B", 12)
        self.set_text_color(*self.c_accent_purple)
        self.cell(22, 10, self.clean_text(f"Módulo {slide_num:02d}"), align="R")
        
        # Columna Izquierda (Texto)
        # Si hay imagen, la columna mide 115mm; si no, mide 267mm.
        text_width = 115 if image_path else 267
        self.set_xy(15, 30)
        
        for block in left_text_blocks:
            type_block, content = block
            content_cleaned = self.clean_text(content)
            
            if type_block == "paragraph":
                self.set_font(self.font_family_name, "", 10)
                self.set_text_color(*self.c_text_dark)
                self.multi_cell(text_width, 5.5, content_cleaned, align="L")
                self.ln(3)
            elif type_block == "bullet":
                # Guardar posición actual
                x = self.get_x()
                y = self.get_y()
                
                # Dibujar viñeta
                self.set_fill_color(*self.c_accent_blue)
                self.rect(x + 1, y + 1.8, 1.8, 1.8, "F")
                
                # Texto de la viñeta
                self.set_xy(x + 5, y)
                self.set_font(self.font_family_name, "", 9.5)
                self.set_text_color(*self.c_text_dark)
                self.multi_cell(text_width - 5, 5, content_cleaned, align="L")
                self.ln(2)
            elif type_block == "subheading":
                self.set_font(self.font_family_name, "B", 11)
                self.set_text_color(*self.c_accent_purple)
                self.multi_cell(text_width, 7, content_cleaned, align="L")
                self.ln(1)
                
        # Columna Derecha (Imagen)
        if image_path and os.path.exists(image_path):
            if is_image_vertical:
                # Imagen vertical (Celular)
                img_h = 145
                img_w = 70.8  # Proporción de aspecto vertical aproximada (70.8 x 145)
                img_x = 138 + (144 - img_w) / 2
                img_y = 28 + (167 - img_h) / 2
                self.image(image_path, x=img_x, y=img_y, w=img_w, h=img_h)
                
                # Marco de celular simulado
                self.set_draw_color(148, 163, 184)
                self.set_line_width(0.4)
                self.rect(img_x, img_y, img_w, img_h, "D")
            else:
                # Imagen horizontal (Desktop)
                img_w = 144
                img_h = 82  # Proporción de aspecto horizontal standard
                img_x = 138
                img_y = 28 + (167 - img_h) / 2
                self.image(image_path, x=img_x, y=img_y, w=img_w, h=img_h)
                
                # Borde de la captura
                self.set_draw_color(203, 213, 225)
                self.set_line_width(0.4)
                self.rect(img_x, img_y, img_w, img_h, "D")
        elif image_path:
            # Si no existe la imagen, mostrar recuadro de aviso (resiliencia)
            self.set_fill_color(226, 232, 240)
            self.rect(138, 35, 144, 85, "F")
            self.set_draw_color(148, 163, 184)
            self.rect(138, 35, 144, 85, "D")
            self.set_xy(138, 70)
            self.set_font(self.font_family_name, "I", 10)
            self.set_text_color(*self.c_text_muted)
            self.cell(144, 10, self.clean_text(f"[Captura: {os.path.basename(image_path)} no disponible]"), align="C")

        # Pie de página claro
        self.set_fill_color(226, 232, 240)
        self.rect(0, 198, 297, 12, "F")
        
        self.set_xy(15, 199)
        self.set_font(self.font_family_name, "", 8)
        self.set_text_color(*self.c_text_muted)
        self.cell(150, 10, self.clean_text("⚡ HIT SaaS Platform — Dossier Operativo & Flujo de Trabajo"))
        
        self.set_xy(250, 199)
        self.cell(32, 10, self.clean_text(f"Página {self.page_no()}"), align="R")
        
    def add_conclusion_slide(self, title, left_text_blocks):
        self.add_page()
        # Fondo oscuro
        self.set_fill_color(*self.c_dark)
        self.rect(0, 0, 297, 210, "F")
        
        # Barra superior oscura
        self.set_fill_color(30, 41, 59)
        self.rect(0, 0, 297, 18, "F")
        self.set_fill_color(*self.c_accent_blue)
        self.rect(0, 17, 297, 1, "F")
        
        # Título
        self.set_xy(15, 4)
        self.set_font(self.font_family_name, "B", 13)
        self.set_text_color(*self.c_white)
        self.cell(200, 10, self.clean_text(title))
        
        # Contenido centrado y a doble columna
        self.set_xy(20, 28)
        
        for block in left_text_blocks:
            type_block, content = block
            content_cleaned = self.clean_text(content)
            
            if type_block == "paragraph":
                self.set_font(self.font_family_name, "", 10.5)
                self.set_text_color(*self.c_text_light)
                self.multi_cell(257, 6, content_cleaned, align="L")
                self.ln(4)
            elif type_block == "bullet":
                x = self.get_x()
                y = self.get_y()
                
                # Viñeta
                self.set_fill_color(*self.c_accent_blue)
                self.rect(x + 1, y + 2, 2, 2, "F")
                
                # Texto
                self.set_xy(x + 6, y)
                self.set_font(self.font_family_name, "", 10)
                self.set_text_color(*self.c_text_light)
                self.multi_cell(251, 5.5, content_cleaned, align="L")
                self.ln(3)
            elif type_block == "subheading":
                self.set_font(self.font_family_name, "B", 12.5)
                self.set_text_color(*self.c_accent_purple)
                self.multi_cell(257, 8, content_cleaned, align="L")
                self.ln(2)
                
        # Pie de página oscuro
        self.set_fill_color(15, 23, 42)
        self.rect(0, 195, 297, 15, "F")
        self.set_fill_color(*self.c_accent_purple)
        self.rect(0, 193, 297, 2, "F")
        
        self.set_xy(20, 198)
        self.set_font(self.font_family_name, "B", 10)
        self.set_text_color(*self.c_white)
        self.cell(100, 10, self.clean_text("⚡ HIT SaaS Platform — © 2026. Todos los derechos reservados."))

def main():
    pdf = PresentationPDF()
    
    # Ruta de las imágenes en la carpeta frontend
    img_dir = os.path.join(os.path.dirname(__file__), "frontend")
    img_login = os.path.join(img_dir, "screenshot_login.png")
    img_superadmin = os.path.join(img_dir, "screenshot_superadmin.png")
    img_admin = os.path.join(img_dir, "screenshot_admin.png")
    img_cobrador = os.path.join(img_dir, "screenshot_cliente.png")   # Vista móvil del cobrador en la calle
    img_cliente = os.path.join(img_dir, "screenshot_cobrador.png")   # Cartilla Virtual del Cliente
    
    # -------------------------------------------------------------
    # SLIDE 1: PORTADA
    # -------------------------------------------------------------
    pdf.add_title_slide(
        title="HIT SaaS Platform\nFlujo de Trabajo Detallado & Operación",
        subtitle="Manual de Operación de la Plataforma de Créditos y Cobranzas",
        date_str="Agosto 2026",
        footer_str="Preparado para: Presentación Comercial a Clientes\nCreado por: HIT Development Team"
    )
    
    # -------------------------------------------------------------
    # SLIDE 2: ARQUITECTURA GENERAL
    # -------------------------------------------------------------
    pdf.add_content_slide(
        slide_num=1,
        title="Arquitectura General: Flujo de 4 Niveles de Acceso",
        left_text_blocks=[
            ("paragraph", "La plataforma HIT está diseñada bajo un modelo Multi-Tenant (Multi-Inquilino) y estructurada en 4 niveles de acceso que segregan las funciones de cada actor de manera segura y eficiente:"),
            ("subheading", "Los 4 Niveles de Operación:"),
            ("bullet", "Nivel 1: Súper Administrador (Dueño del SaaS)\nControl total de suscripciones, alta de nuevas empresas y bloqueo de inquilinos en mora."),
            ("bullet", "Nivel 2: Administrador de Empresa (Dueño de la Casa de Cuotas)\nAlta de clientes con GPS, creación de planes de pago (ficheros digitales), asignación de rutas y auditoría diaria de cajas."),
            ("bullet", "Nivel 3: Cobrador en Calle (App Móvil)\nHoja de ruta priorizada por geolocalización, escáner de tarjetas QR físico y registro fotográfico de transferencias bancarias."),
            ("bullet", "Nivel 4: Vista de Cliente (Cartilla Virtual)\nVisualización en tiempo real del saldo, cuotas pagadas y pendientes mediante el simple escaneo de su tarjeta física QR.")
        ]
    )
    
    # -------------------------------------------------------------
    # SLIDE 3: ACCESO CENTRALIZADO (LOGIN)
    # -------------------------------------------------------------
    pdf.add_content_slide(
        slide_num=2,
        title="Acceso Unificado y Seguridad de Datos",
        left_text_blocks=[
            ("paragraph", "La puerta de entrada de la plataforma es unificada y detecta automáticamente el nivel del usuario."),
            ("subheading", "Seguridad y Simulación de Demostración:"),
            ("bullet", "Aislamiento Multi-Tenant: Cada empresa opera en su propio espacio virtual aislado. Es imposible visualizar datos de otras empresas inquilinas."),
            ("bullet", "Encriptación Avanzada: Las contraseñas están resguardadas con algoritmos bcrypt, y las sesiones se autorizan por tokens seguros JWT."),
            ("bullet", "Simulador Rápido (Barra Inferior): La demo incluye accesos en 1-clic a usuarios pre-cargados (Súper Admin, Admin Empresa y Cobrador Juan) para agilizar las pruebas del cliente.")
        ],
        image_path=img_login,
        is_image_vertical=False
    )
    
    # -------------------------------------------------------------
    # SLIDE 4: SUPER ADMIN (NIVEL 1)
    # -------------------------------------------------------------
    pdf.add_content_slide(
        slide_num=3,
        title="Gestión SaaS y Aprovisionamiento (Súper Admin)",
        left_text_blocks=[
            ("paragraph", "El panel maestro del administrador global (dueño del sistema SaaS) permite supervisar el negocio y dar soporte:"),
            ("subheading", "Herramientas del Súper Admin:"),
            ("bullet", "Métricas en Tiempo Real: Visualización del MRR (Ingreso Mensual Recurrente), volumen total recaudado e inquilinos activos."),
            ("bullet", "Alta de Empresas: Creación instantánea de bases de datos para nuevas empresas interesadas en el servicio."),
            ("bullet", "Bloqueo por Cuota Vencida: Si una empresa se atrasa en su abono, el Súper Admin cambia su estado a 'BLOQUEADA' en un clic. Esto deniega de inmediato el acceso a todos sus usuarios (administradores y cobradores) con un aviso en pantalla.")
        ],
        image_path=img_superadmin,
        is_image_vertical=False
    )
    
    # -------------------------------------------------------------
    # SLIDE 5: ADMIN EMPRESA - DASHBOARD (NIVEL 2)
    # -------------------------------------------------------------
    pdf.add_content_slide(
        slide_num=4,
        title="Administración de la Casa de Cuotas: Clientes y Mapas",
        left_text_blocks=[
            ("paragraph", "El panel principal del Administrador de la Empresa centraliza el control de la cartera y de los empleados de la calle."),
            ("subheading", "Gestión de Clientes y Geoposicionamiento:"),
            ("bullet", "Buscador Georreferenciado: Alta de clientes ubicándolos directamente en un mapa interactivo de alta definición (GPS)."),
            ("bullet", "Generación de Código QR: Al crear un cliente, el sistema asigna automáticamente un token criptográfico único que se imprime en una tarjeta física."),
            ("bullet", "Visualización de Indicadores: KPIs rápidos de Clientes Totales, Ficheros Activos, Cartera Activa y total cobrado en el día.")
        ],
        image_path=img_admin,
        is_image_vertical=False
    )
    
    # -------------------------------------------------------------
    # SLIDE 6: ADMIN EMPRESA - ASIGNACION Y FICHEROS (NIVEL 2)
    # -------------------------------------------------------------
    pdf.add_content_slide(
        slide_num=5,
        title="Ficheros Digitales y Asignación Dinámica de Rutas",
        left_text_blocks=[
            ("paragraph", "Sustitución definitiva de los pesados ficheros de cartón o papel de las oficinas centrales:"),
            ("subheading", "Creación de Ficheros y Control de Zonas:"),
            ("bullet", "Fichero Digital (Calco del Fichero Físico): Creación de planes de cuotas dinámicas (ej: 34 cuotas semanales de $5,000) con cálculo automático de vencimientos e importes."),
            ("bullet", "Asignación por Drag & Drop: Asignación visual e interactiva de ficheros y clientes a las hojas de ruta de cobradores específicos según su zona geográfica de calle (Flores, Caballito, Quilmes, etc.)."),
            ("bullet", "Reasignación Rápida: Ante mudanzas o faltas del personal de cobranzas, las carteras de cobro se reasignan en segundos.")
        ],
        image_path=img_admin, # Repetimos captura para este sub-módulo
        is_image_vertical=False
    )
    
    # -------------------------------------------------------------
    # SLIDE 7: APP COBRADOR - HOJA RUTA (NIVEL 3)
    # -------------------------------------------------------------
    pdf.add_content_slide(
        slide_num=6,
        title="Operación del Cobrador en Calle: App Móvil",
        left_text_blocks=[
            ("paragraph", "La aplicación móvil del cobrador está diseñada para el uso ágil en la calle, con un consumo mínimo de batería y datos."),
            ("subheading", "Herramientas de Trabajo en Calle:"),
            ("bullet", "Hoja de Ruta Priorizada: Listado ordenado de clientes a visitar por zona, con semáforos visuales que indican el estado de morosidad."),
            ("bullet", "Lector QR Integrado: Escaneo en vivo usando la cámara del teléfono celular. Al apuntar a la tarjeta física del cliente, el sistema abre al instante su ficha digital en la pantalla del cobrador."),
            ("bullet", "Botón de Mapa y Llamada: Geolocalización en un toque para navegar mediante GPS al domicilio de visita o llamar directamente al cliente por teléfono.")
        ],
        image_path=img_cobrador,
        is_image_vertical=True
    )
    
    # -------------------------------------------------------------
    # SLIDE 8: APP COBRADOR - REGISTRO (NIVEL 3)
    # -------------------------------------------------------------
    pdf.add_content_slide(
        slide_num=7,
        title="Registro del Cobro y Gestión de Incidentes",
        left_text_blocks=[
            ("paragraph", "Registro de cobros transparente y sin fricciones mediante la interfaz interactiva de casilleros digitales (ej: 1 al 34):"),
            ("subheading", "Métodos de Pago y Soporte Offline:"),
            ("bullet", "Cobro en Efectivo: Registro inmediato. El sistema guarda la hora exacta y coordenadas GPS del cobrador para auditar que realmente estuvo en el lugar."),
            ("bullet", "Cobro por Transferencia: Requiere de forma obligatoria que el cobrador suba una captura de pantalla del comprobante de transferencia bancaria, evitando fraudes."),
            ("bullet", "Visitas No Cobradas: Reporte de motivos estandarizados en caso de no poder cobrar (Ausente, Pasa mañana, Domicilio cerrado, etc.) con registro de fecha prometida de pago."),
            ("bullet", "Sincronización Offline: En zonas sin cobertura de internet móvil, el cobrador puede seguir cargando datos; estos se sincronizarán solos al recuperar señal.")
        ],
        image_path=img_cobrador, # Mantenemos la captura de pantalla de la app móvil
        is_image_vertical=True
    )
    
    # -------------------------------------------------------------
    # SLIDE 9: PORTAL DEL CLIENTE (NIVEL 4)
    # -------------------------------------------------------------
    pdf.add_content_slide(
        slide_num=8,
        title="Cartilla Virtual del Cliente (Transparencia Total)",
        left_text_blocks=[
            ("paragraph", "Para aumentar la confianza y transparencia de la operación, el cliente cuenta con un acceso de solo lectura:"),
            ("subheading", "Acceso Fácil mediante Código QR:"),
            ("bullet", "Escaneo Directo: Sin necesidad de contraseñas, nombres de usuario ni descargar aplicaciones móviles pesadas desde las tiendas."),
            ("bullet", "Casilleros Interactivos: El cliente ve en tiempo real su cartilla: cuotas pagadas marcadas en verde con tilde (check), cuotas pendientes y progreso total del plan."),
            ("bullet", "Botón de Contacto Rápido: Accesos directos a WhatsApp y llamadas con la oficina comercial o su cobrador asignado para cualquier duda.")
        ],
        image_path=img_cliente,
        is_image_vertical=True
    )
    
    # -------------------------------------------------------------
    # SLIDE 10: AUDITORIA Y CONCILIACION
    # -------------------------------------------------------------
    pdf.add_content_slide(
        slide_num=9,
        title="Auditoría y Conciliación Diaria (Cierre de Caja)",
        left_text_blocks=[
            ("paragraph", "El proceso diario finaliza con el arqueo de caja de los cobradores, cerrando de forma hermética el flujo de dinero de la empresa:"),
            ("subheading", "Conciliación y Prevención de Fugas:"),
            ("bullet", "Arqueo Segregado: El sistema separa de manera inalterable el dinero físico recaudado por el cobrador en efectivo, de las transferencias reportadas."),
            ("bullet", "Verificación de Comprobantes: El administrador visualiza las capturas de transferencias bancarias cargadas por el cobrador en calle y las valida contra el banco."),
            ("bullet", "Seguridad Total: En caso de robo o extravío del celular del cobrador, los datos no se pierden ya que están guardados de forma segura en la nube (copias de seguridad automatizadas diarias).")
        ]
    )
    
    # -------------------------------------------------------------
    # SLIDE 11: BENEFICIOS Y RETORNO DE INVERSIÓN
    # -------------------------------------------------------------
    pdf.add_conclusion_slide(
        title="Beneficios y Retorno de Inversión (ROI)",
        left_text_blocks=[
            ("paragraph", "La digitalización con HIT SaaS transforma radicalmente la productividad de las casas de créditos y cobros diarios:"),
            ("subheading", "Ventajas de Negocio Clave:"),
            ("bullet", "Eliminación del Fraude y Pérdidas: La auditoría GPS del cobro en efectivo y la foto obligatoria de transferencias impiden desvíos de fondos."),
            ("bullet", "Cobranza 40% Más Rápida: Los cobradores cuentan con una ruta geolocalizada óptima y escaneo QR en vivo que acelera el recorrido."),
            ("bullet", "Control Total e Inmediato: Monitoreo en tiempo real de la recaudación del día y métricas globales del estado de morosidad desde cualquier dispositivo."),
            ("bullet", "Escalabilidad Empresarial: Capacidad técnica comprobada para escalar sin problemas desde carteras de 300 clientes hasta carteras de 10,000 clientes activos en la nube."),
            ("bullet", "Cero Pérdida de Información: Copias de seguridad automáticas diarias en servidores en la nube de alta disponibilidad.")
        ]
    )
    
    # Guardar la presentación como PDF
    output_filename = "Manual_Flujo_Trabajo.pdf"
    pdf.output(output_filename)
    print(f"✅ PDF presentation successfully generated and saved as '{output_filename}'!")

if __name__ == "__main__":
    main()
