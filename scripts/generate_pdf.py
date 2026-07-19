import os
import sys
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        
        # We do not draw headers/footers on the title page (page 1)
        if self._pageNumber > 1:
            self.setFont("Helvetica-Bold", 8)
            self.setFillColor(colors.HexColor("#1c1917")) # stone-900
            self.drawString(54, 750, "CATERPILLAR CAT® PREDICTIVE MAINTENANCE PLATFORM")
            
            self.setFont("Helvetica", 8)
            self.setFillColor(colors.HexColor("#78716c")) # stone-500
            self.drawRightString(558, 750, "TECHNICAL DOCUMENTATION")
            
            # Header line
            self.setStrokeColor(colors.HexColor("#e7e5e4")) # stone-200
            self.setLineWidth(0.5)
            self.line(54, 742, 558, 742)
            
            # Footer line
            self.line(54, 52, 558, 52)
            
            # Footer details
            self.drawString(54, 40, "© 2026 Caterpillar Inc. All Rights Reserved.")
            page_text = f"Page {self._pageNumber} of {page_count}"
            self.drawRightString(558, 40, page_text)
            
        self.restoreState()

def build_pdf(filename="PROJECT_DOCUMENTATION.pdf"):
    # Target 0.75 in (54 pt) margins. Printable height: 792 - 108 = 684. Width: 612 - 108 = 504.
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=72,
        bottomMargin=72
    )
    
    styles = getSampleStyleSheet()
    
    # Custom colors
    brand_yellow = colors.HexColor("#FFCD00")
    brand_dark = colors.HexColor("#1C1917")
    text_color = colors.HexColor("#292524")
    border_color = colors.HexColor("#e7e5e4")
    light_bg = colors.HexColor("#F9F8F6")
    
    # Modify existing styles to avoid conflicts
    styles['Normal'].textColor = text_color
    styles['Normal'].fontSize = 9.5
    styles['Normal'].leading = 14
    
    # Add new distinct custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=30,
        textColor=brand_dark,
        alignment=0,
        spaceAfter=10
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#44403c"),
        spaceAfter=30
    )
    
    h1_style = ParagraphStyle(
        'DocH1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=16,
        leading=20,
        textColor=brand_dark,
        spaceBefore=18,
        spaceAfter=10,
        keepWithNext=True
    )
    
    h2_style = ParagraphStyle(
        'DocH2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#44403c"),
        spaceBefore=12,
        spaceAfter=6,
        keepWithNext=True
    )
    
    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['Normal'],
        fontSize=9.5,
        leading=14,
        spaceAfter=8
    )
    
    table_cell_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontSize=8.5,
        leading=11
    )
    
    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=colors.white
    )

    story = []
    
    # --- TITLE PAGE ---
    story.append(Spacer(1, 40))
    story.append(Paragraph("CAT® PREDICTIVE MAINTENANCE PLATFORM", title_style))
    story.append(Paragraph("Full Technical Architecture, Machine Learning Pipelines, and API Specifications", subtitle_style))
    story.append(Spacer(1, 20))
    
    metadata_data = [
        [Paragraph("<b>Document Version:</b>", body_style), Paragraph("1.0.0 (Production Candidate)", body_style)],
        [Paragraph("<b>Author:</b>", body_style), Paragraph("Google DeepMind & CAT Engineering Pair", body_style)],
        [Paragraph("<b>Date:</b>", body_style), Paragraph("July 19, 2026", body_style)],
        [Paragraph("<b>Target System:</b>", body_style), Paragraph("Heavy Machinery Real-Time Failure Prevention Engine", body_style)]
    ]
    t_meta = Table(metadata_data, colWidths=[130, 374])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), light_bg),
        ('BOX', (0,0), (-1,-1), 1, border_color),
        ('INNERGRID', (0,0), (-1,-1), 0.5, border_color),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 30))
    
    story.append(Paragraph("Executive Summary", h1_style))
    exec_text = (
        "The Caterpillar Predictive Maintenance Platform is an enterprise-grade industrial monitoring "
        "solution designed to predict subsystem equipment failures before catastrophic downtime occurs. "
        "The platform ingests high-frequency sensor streams (temperature, vibration, pressure, speed), "
        "evaluates machine-learning models, and renders live operational dashboards for administrators, "
        "site supervisors, maintenance engineers, and service field technicians."
    )
    story.append(Paragraph(exec_text, body_style))
    story.append(PageBreak())
    
    # --- ARCHITECTURE SECTION ---
    story.append(Paragraph("1. System Architecture Overview", h1_style))
    arch_desc = (
        "The application follows a decoupled microservice architecture ensuring operational isolation "
        "and seamless scaling. The four primary subsystems comprise:"
    )
    story.append(Paragraph(arch_desc, body_style))
    
    components_data = [
        [Paragraph("Component", table_header_style), Paragraph("Tech Stack", table_header_style), Paragraph("Role & Responsibility", table_header_style)],
        [Paragraph("<b>Frontend UI</b>", table_cell_style), Paragraph("Next.js 16 (React 19), Tailwind CSS, Lucide Icons", table_cell_style), Paragraph("Renders role-tailored dashboards, live telemetry charts, work orders, and interactive messaging.", table_cell_style)],
        [Paragraph("<b>Backend API</b>", table_cell_style), Paragraph("Django 5.2, Daphne ASGI, Django Channels", table_cell_style), Paragraph("Exposes REST APIs, manages PostgreSQL models, executes WebSocket telemetry broadcasting.", table_cell_style)],
        [Paragraph("<b>AI Service</b>", table_cell_style), Paragraph("FastAPI, Scikit-Learn, Joblib, Pandas", table_cell_style), Paragraph("Hosts machine-learning inference engines, evaluates equipment health, outputs failure risks.", table_cell_style)],
        [Paragraph("<b>Simulator</b>", table_cell_style), Paragraph("Python 3.12, Psycopg2, Math/Physics Engine", table_cell_style), Paragraph("Simulates realistic sensor noise, physical load drifts, degradation curves, and auto-alerts.", table_cell_style)]
    ]
    t_comp = Table(components_data, colWidths=[100, 130, 274])
    t_comp.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), brand_dark),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.5, border_color),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_comp)
    story.append(Spacer(1, 20))
    
    # --- MACHINERY & SUBSYSTEMS ---
    story.append(Paragraph("2. Heavy Machinery & Subsystems Matrix", h1_style))
    machinery_desc = (
        "The system explicitly monitors four Caterpillar machine models, each with dedicated "
        "subsystem sensors and trained machine learning classification models:"
    )
    story.append(Paragraph(machinery_desc, body_style))
    
    matrix_data = [
        [Paragraph("Model", table_header_style), Paragraph("Machine Name", table_header_style), Paragraph("Subsystems", table_header_style), Paragraph("Key Sensor Metrics", table_header_style)],
        [Paragraph("<b>CAT 320</b>", table_cell_style), Paragraph("Excavator", table_cell_style), Paragraph("Engine, Hydraulic, Boom", table_cell_style), Paragraph("RPM, Load, Coolant Temp, Oil Pressure, Vibration, Hydraulic Temp, Boom Pressure, Swing Motor Temp", table_cell_style)],
        [Paragraph("<b>CAT 730</b>", table_cell_style), Paragraph("Articulated Dump Truck", table_cell_style), Paragraph("Engine, Transmission, Brake & Tire", table_cell_style), Paragraph("RPM, Load, Transmission Temp/Pressure, Brake Temp, Tire Pressure, Vibration", table_cell_style)],
        [Paragraph("<b>CAT 950</b>", table_cell_style), Paragraph("Wheel Loader", table_cell_style), Paragraph("Engine, Hydraulic, Bucket & Axle", table_cell_style), Paragraph("Hydraulic Pressure, Flow Rate, Bucket Pressure, Position Load, Axle Temp", table_cell_style)],
        [Paragraph("<b>CAT D6</b>", table_cell_style), Paragraph("Track Dozer", table_cell_style), Paragraph("Engine, Hydraulic, Track", table_cell_style), Paragraph("Track Temp, Blade Hydraulic Pressure, Engine Load, Vibration", table_cell_style)]
    ]
    t_matrix = Table(matrix_data, colWidths=[65, 95, 120, 224])
    t_matrix.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), brand_dark),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.5, border_color),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_matrix)
    story.append(Spacer(1, 20))
    story.append(PageBreak())
    
    # --- AI & ML PIPELINE ---
    story.append(Paragraph("3. Machine Learning & Inference Pipeline", h1_style))
    ml_desc = (
        "The AI microservice executes scikit-learn classification models per subsystem to compute "
        "real-time health scores and anomaly probability distributions."
    )
    story.append(Paragraph(ml_desc, body_style))
    
    ml_steps = [
        "<b>1. Feature Vector Assembly:</b> Incoming telemetry packets extract numerical sensor values aligned with trained feature JSON schemas.",
        "<b>2. Multi-Class Prediction:</b> Models output probability vectors across four health classes: <i>SAFE (0)</i>, <i>WARNING (1)</i>, <i>CRITICAL (2)</i>, and <i>FAILURE (3)</i>.",
        "<b>3. Anomaly Score Calculation:</b> Health score is derived dynamically: <font name='Courier'>Health = 100 * (1.0 - AnomalyScore)</font>.",
        "<b>4. Remaining Useful Life (RUL):</b> RUL hours are calculated based on exponential health decay curves."
    ]
    for step in ml_steps:
        story.append(Paragraph(step, body_style))
        story.append(Spacer(1, 4))
        
    story.append(Spacer(1, 15))
    
    # --- API SPECIFICATIONS ---
    story.append(Paragraph("4. Key REST & WebSocket API Endpoints", h1_style))
    
    api_data = [
        [Paragraph("Endpoint", table_header_style), Paragraph("Method", table_header_style), Paragraph("Description", table_header_style)],
        [Paragraph("<font name='Courier'>/api/machinery/machines/</font>", table_cell_style), Paragraph("GET", table_cell_style), Paragraph("Returns list of registered machines with nested equipment health states.", table_cell_style)],
        [Paragraph("<font name='Courier'>/api/maintenance/work-orders/</font>", table_cell_style), Paragraph("GET / PATCH", table_cell_style), Paragraph("Retrieves active maintenance orders or updates repair notes and completion status.", table_cell_style)],
        [Paragraph("<font name='Courier'>/api/telemetry/alerts/</font>", table_cell_style), Paragraph("GET / POST", table_cell_style), Paragraph("Fetches active machinery alerts and supports marking alarms as resolved.", table_cell_style)],
        [Paragraph("<font name='Courier'>/ws/telemetry/</font>", table_cell_style), Paragraph("WebSocket", table_cell_style), Paragraph("Pushes 1Hz high-frequency sensor readings, telemetry frames, and real-time equipment updates.", table_cell_style)],
        [Paragraph("<font name='Courier'>/api/predict/health/{machine_id}</font>", table_cell_style), Paragraph("POST", table_cell_style), Paragraph("FastAPI endpoint executing subsystem classification models.", table_cell_style)]
    ]
    t_api = Table(api_data, colWidths=[170, 50, 284])
    t_api.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), brand_dark),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.5, border_color),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_api)
    story.append(Spacer(1, 25))
    
    # Build Document
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Documentation PDF generated successfully: {filename}")

if __name__ == "__main__":
    build_pdf()
