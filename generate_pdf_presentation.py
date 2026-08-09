import os
import sys
from fpdf import FPDF
from PIL import Image

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
        self.cell(100, 10, self.clean_text("⚡ HIT Platform — Software de Gestión de Créditos y Cobranzas"))
        
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
        self.cell(22, 10, self.clean_text(f"Paso {slide_num:02d}"), align="R")
        
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
        self.cell(150, 10, self.clean_text("⚡ HIT Platform — Dossier Operativo & Flujo de Trabajo"))
        
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
        self.cell(100, 10, self.clean_text("⚡ HIT Platform — © 2026. Todos los derechos reservados."))

def main():
    # 1. Asegurar el recorte de la imagen de inicio para remover accesos de demo
    img_dir = os.path.join(os.path.dirname(__file__), "frontend")
    img_login_original = os.path.join(img_dir, "screenshot_login.png")
    img_login_cropped = os.path.join(img_dir, "screenshot_login_cropped.png")
    
    if os.path.exists(img_login_original):
        try:
            img = Image.open(img_login_original)
            width, height = img.size
            # Recortar 24% inferior para remover botones rápidos de simulación
            crop_height = int(height * 0.76)
            cropped = img.crop((0, 0, width, crop_height))
            cropped.save(img_login_cropped)
            print(f"✅ Imagen de login recortada exitosamente ({width}x{crop_height})")
        except Exception as e:
            print(f"⚠️ Error al recortar la imagen de login: {e}. Usando original como fallback.")
            img_login_cropped = img_login_original
    else:
        img_login_cropped = img_login_original

    # 2. Generar el PDF de la presentación
    pdf = PresentationPDF()
    
    img_admin = os.path.join(img_dir, "screenshot_admin.png")
    img_cobrador = os.path.join(img_dir, "screenshot_cliente.png")   # Vista móvil del cobrador en la calle
    img_cliente = os.path.join(img_dir, "screenshot_cobrador.png")   # Cartilla Virtual del Cliente
    img_encargado = os.path.join(img_dir, "screenshot_encargado.png") # Interfaz del Encargado de Zona
    
    # -------------------------------------------------------------
    # SLIDE 1: PORTADA (FONDO OSCURO)
    # -------------------------------------------------------------
    pdf.add_title_slide(
        title="HIT Platform\nFlujo de Trabajo Operativo de Créditos y Cobranzas",
        subtitle="Manual de Operación de Procesos del Negocio",
        date_str="Agosto 2026",
        footer_str="Preparado para: Presentación del Sistema a Clientes\nCreado por: HIT Development Team"
    )
    
    # -------------------------------------------------------------
    # SLIDE 2: RESUMEN DE ROLES
    # -------------------------------------------------------------
    pdf.add_content_slide(
        slide_num=1,
        title="Estructura Operativa y Roles Activos",
        left_text_blocks=[
            ("paragraph", "La plataforma digitaliza y conecta cada uno de los eslabones de la operación de venta en cuotas, garantizando la trazabilidad y la seguridad en tiempo real:"),
            ("subheading", "Roles Clave del Flujo de Trabajo:"),
            ("bullet", "1. Vendedor: Contacta al cliente, registra sus datos personales y selecciona el producto que desea adquirir."),
            ("bullet", "2. Administrador: Analiza el stock y el perfil de riesgo crediticio del cliente. Si lo aprueba, crea el fichero digital y delega al Encargado de Zona."),
            ("bullet", "3. Encargado de Zona: Modera y coordina los cobros, asigna los cobradores de calle correspondientes y valida los comprobantes."),
            ("bullet", "4. Cobrador en Calle: Visita los domicilios en base a su hoja de ruta, escanea el QR único y registra los cobros correspondientes."),
            ("bullet", "5. Cliente: Consulta de forma transparente el estado y progreso de su deuda escaneando su código QR único.")
        ]
    )
    
    # -------------------------------------------------------------
    # SLIDE 3: PASO 1 - VENDEDOR
    # -------------------------------------------------------------
    pdf.add_content_slide(
        slide_num=2,
        title="Paso 1: El Vendedor (Inicio del Proceso)",
        left_text_blocks=[
            ("paragraph", "El circuito se activa en el momento en que el cliente contacta al vendedor interesado en un artículo o plan:"),
            ("subheading", "Actividades del Vendedor:"),
            ("bullet", "Registro de Datos: Recopila y carga en el sistema todos los datos personales del cliente (Nombre, DNI, teléfono y dirección georreferenciada)."),
            ("bullet", "Selección de Producto: Apunta de forma precisa la información del producto que el cliente desea comprar."),
            ("bullet", "Envío al Administrador: Una vez completados los datos, envía la información de manera digital al Administrador para su evaluación."),
            ("subheading", "Interfaz de Inicio del Sistema:"),
            ("paragraph", "La captura a la derecha muestra la interfaz de inicio de la aplicación. Tanto el administrador como los encargados de zona y los cobradores ingresan desde esta misma pantalla segura con su usuario y contraseña única.")
        ],
        image_path=img_login_cropped,
        is_image_vertical=False
    )
    
    # -------------------------------------------------------------
    # SLIDE 4: PASO 2 - ADMINISTRADOR
    # -------------------------------------------------------------
    pdf.add_content_slide(
        slide_num=3,
        title="Paso 2: El Administrador (Aprobación y Creación)",
        left_text_blocks=[
            ("paragraph", "El Administrador audita y genera el marco comercial de la transacción:"),
            ("subheading", "Responsabilidades del Administrador:"),
            ("bullet", "Control de Stock: Recibe la información del vendedor y chequea la disponibilidad física del producto."),
            ("bullet", "Análisis de Riesgo: Determina la viabilidad del cliente y si es apto para acceder al mini préstamo solicitado."),
            ("bullet", "Creación de Fichero Digital: Si se aprueba, crea la cuenta y genera un Código QR único para el cliente."),
            ("bullet", "Configuración del Plan: Carga el plan de pago detallando: producto, cantidad de cuotas, valor de cuota y fecha de entrega."),
            ("bullet", "Derivación: Genera la orden y asigna el caso a un Encargado de Zona.")
        ],
        image_path=img_admin,
        is_image_vertical=False
    )
    
    # -------------------------------------------------------------
    # SLIDE 5: PASO 3 - ENCARGADO DE ZONA A
    # -------------------------------------------------------------
    pdf.add_content_slide(
        slide_num=4,
        title="Paso 3: El Encargado de Zona (Coordinación y Asignación)",
        left_text_blocks=[
            ("paragraph", "El Encargado de Zona planifica la ruta y establece la relación inicial de cobro:"),
            ("subheading", "Acciones del Encargado de Zona:"),
            ("bullet", "Recepción del Caso: Recibe en su aplicación móvil la cuenta y los detalles del cliente asignado a su zona."),
            ("bullet", "Análisis de Ubicación: Visualiza en pantalla la dirección georreferenciada del cliente."),
            ("bullet", "Contacto Inicial: Se comunica con el cliente para explicarle la modalidad de cobranza."),
            ("bullet", "Preaviso de Visita: Llama o escribe al cliente un par de días antes de la fecha de visita para anticipar la llegada del cobrador."),
            ("bullet", "Asignación de Cobrador: Asigna al cobrador específico de calle que realizará las cobranzas.")
        ],
        image_path=img_encargado,
        is_image_vertical=False
    )
    
    # -------------------------------------------------------------
    # SLIDE 6: PASO 3 - ENCARGADO DE ZONA B (ALERTAS Y PAGOS)
    # -------------------------------------------------------------
    pdf.add_content_slide(
        slide_num=5,
        title="Paso 3: El Encargado de Zona (Alertas y Control de Pagos)",
        left_text_blocks=[
            ("paragraph", "Supervisión de caja en tiempo real y emisión automatizada de tickets:"),
            ("subheading", "Acciones de Control de Cobros:"),
            ("bullet", "Notificaciones de Pago: Recibe una alerta en su aplicación cada vez que un cobrador registra un cobro exitoso en calle."),
            ("bullet", "Ticket de WhatsApp: La app genera un mensaje con el comprobante de pago para copiar y enviar al cliente con un solo clic."),
            ("bullet", "Cobranza de Transferencias: Si el cliente decide abonar mediante transferencia bancaria, se contacta con el Encargado de Zona, quien le comparte el CBU, recibe el comprobante bancario y registra el cobro en el sistema.")
        ],
        image_path=img_cobrador,
        is_image_vertical=True
    )
    
    # -------------------------------------------------------------
    # SLIDE 7: PASO 4 - COBRADOR A
    # -------------------------------------------------------------
    pdf.add_content_slide(
        slide_num=6,
        title="Paso 4: El Cobrador en Calle (Recorrido y Escaneo)",
        left_text_blocks=[
            ("paragraph", "El cobrador realiza la operación física en el domicilio del deudor:"),
            ("subheading", "Acciones del Cobrador:"),
            ("bullet", "Hoja de Ruta: Recibe en su teléfono celular la lista de clientes ordenados y priorizados por zona."),
            ("bullet", "Visita Domiciliaria: Se dirige al domicilio cargado en el geoposicionador."),
            ("bullet", "Escaneo QR en Vivo: Utiliza la cámara integrada en la aplicación para escanear el código QR de la tarjeta del cliente."),
            ("bullet", "Apertura del Fichero: Al detectar el QR, la pantalla muestra de inmediato el fichero digital con el progreso de cuotas (casilleros del 1 al 34+).")
        ],
        image_path=img_cobrador,
        is_image_vertical=True
    )
    
    # -------------------------------------------------------------
    # SLIDE 8: PASO 4 - COBRADOR B (REGISTRO Y OFFLINE)
    # -------------------------------------------------------------
    pdf.add_content_slide(
        slide_num=7,
        title="Paso 4: El Cobrador en Calle (Registro de Pago y Offline)",
        left_text_blocks=[
            ("paragraph", "Garantía de registro inmediato de cobro y resiliencia tecnológica:"),
            ("subheading", "Proceso de Registro de Cobros:"),
            ("bullet", "Imputación del Pago: Registra el cobro de la cuota correspondiente pulsando el casillero indicado."),
            ("bullet", "Historial Automático: El pago impacta de forma inmediata en el historial contable del fichero digital."),
            ("bullet", "Sincronización Offline: En caso de operar en zonas sin internet móvil, el cobrador puede registrar la transacción localmente. Los datos se sincronizan de manera autónoma al recuperar la conexión.")
        ],
        image_path=img_cliente,
        is_image_vertical=True
    )
    
    # -------------------------------------------------------------
    # SLIDE 9: PASO 5 - APLICACIÓN DEL CLIENTE
    # -------------------------------------------------------------
    pdf.add_content_slide(
        slide_num=8,
        title="Paso 5: Aplicación del Cliente (Transparencia Total)",
        left_text_blocks=[
            ("paragraph", "El cliente puede auditar sus pagos de forma autónoma, lo que genera confianza y reduce reclamos:"),
            ("subheading", "Acceso a la Cartilla Virtual:"),
            ("bullet", "Escaneo de Tarjeta QR: El cliente escanea su tarjeta física QR desde cualquier dispositivo celular."),
            ("bullet", "Acceso Instantáneo: Se abre la cartilla virtual en su navegador sin necesidad de registrarse con contraseñas o descargar apps pesadas."),
            ("bullet", "Control en Tiempo Real: Visualiza los casilleros de su préstamo. Cada vez que el cobrador rinde una cuota, esta aparece en verde con tilde (check) al instante.")
        ],
        image_path=img_cliente,
        is_image_vertical=True
    )
    
    # -------------------------------------------------------------
    # SLIDE 10: PASO 6 - COBRANZA FALLIDA E INCIDENTES
    # -------------------------------------------------------------
    pdf.add_content_slide(
        slide_num=9,
        title="Paso 6: Gestión de Cobranzas Fallidas e Incidentes",
        left_text_blocks=[
            ("paragraph", "Control de contingencias en la ruta de cobros para un historial preciso:"),
            ("subheading", "Reportes de Visita Fallida:"),
            ("bullet", "Motivos Estandarizados: Si el cobrador no logra cobrar, selecciona e informa el motivo: *Ausente*, *Pasa mañana/Pasa otro día*, *No pudo pagar*, u *Otros*."),
            ("bullet", "Notificación al Encargado: El reporte se envía automáticamente al Encargado de Zona para planificar el nuevo intento de cobro."),
            ("bullet", "Historial de Visitas: Mantiene un registro permanente de cada visita del cobrador, protegiendo la información."),
            ("bullet", "Cuentas Especiales: Se aplica la misma lógica para cobros con pagos parciales o saldos a favor.")
        ],
        image_path=img_cobrador,
        is_image_vertical=True
    )
    
    # -------------------------------------------------------------
    # SLIDE 11: BENEFICIOS (FONDO OSCURO)
    # -------------------------------------------------------------
    pdf.add_conclusion_slide(
        title="Beneficios y Retorno de Inversión (ROI) del Flujo Digital",
        left_text_blocks=[
            ("paragraph", "La implementación del flujo de trabajo de HIT automatiza la operatoria diaria y previene pérdidas:"),
            ("subheading", "Ventajas de Negocio Clave:"),
            ("bullet", "🔒 Control Antifraude: La auditoría GPS de visitas en efectivo y el control fotográfico de transferencias impiden desvíos de caja."),
            ("bullet", "⚡ Aumento de la Eficiencia: Las rutas de cobro geolocalizadas reducen los tiempos muertos y traslados de cobradores en calle."),
            ("bullet", "💬 Gestión de WhatsApp Ágil: Generación automática de comprobantes listos para enviar disminuye llamadas operativas."),
            ("bullet", "🛡️ Resguardo de Datos: Ante robos o extravíos de ficheros de papel o celulares, toda la cartera queda a salvo en la nube de alta disponibilidad.")
        ]
    )
    
    # Guardar la presentación como PDF
    output_filename = "Manual_Flujo_Trabajo.pdf"
    pdf.output(output_filename)
    print(f"✅ PDF presentation successfully generated and saved as '{output_filename}'!")

if __name__ == "__main__":
    main()
