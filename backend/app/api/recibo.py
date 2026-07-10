from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime
import io
import os

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.recibo import Recibo
from app.models.cliente import Cliente
from app.models.proyecto import Proyecto
from app.models.presupuesto import Presupuesto
from app.schemas.recibo import ReciboCreate, ReciboOut

router = APIRouter(prefix="/api/recibos", tags=["recibos"])

LOGO_PATH = '/app/backend/logo_nodo.png'

FORMAS_COBRO_LABEL = {
    'efectivo':      'Efectivo',
    'transferencia': 'Transferencia bancaria',
    'cheque':        'Cheque',
}


def _solo_gaston(user: User):
    if user.rol != "gaston":
        raise HTTPException(status_code=403, detail="Solo Gastón puede acceder a esta sección")


def _generar_numero(db: Session) -> str:
    anio = datetime.now().year
    count = db.query(func.count(Recibo.id)).filter(
        func.extract('year', Recibo.created_at) == anio
    ).scalar() or 0
    return f"REC-{anio}-{str(count + 1).zfill(3)}"


def _enriquecer(r: Recibo) -> dict:
    d = {c.name: getattr(r, c.name) for c in r.__table__.columns}
    d["cliente_apellido"]   = r.cliente.apellido if r.cliente else None
    d["cliente_nombre"]     = r.cliente.nombre if r.cliente else None
    d["proyecto_nombre"]    = r.proyecto.nombre if r.proyecto else None
    d["presupuesto_numero"] = r.presupuesto.numero if r.presupuesto else None
    return d


@router.get("/", response_model=List[ReciboOut])
def listar_recibos(
    cliente_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)
    q = db.query(Recibo)
    if cliente_id:
        q = q.filter(Recibo.cliente_id == cliente_id)
    return [_enriquecer(r) for r in q.order_by(Recibo.created_at.desc()).all()]


@router.post("/", response_model=ReciboOut)
def crear_recibo(
    datos: ReciboCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)
    cliente = db.query(Cliente).filter(Cliente.id == datos.cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    if datos.proyecto_id:
        proyecto = db.query(Proyecto).filter(
            Proyecto.id == datos.proyecto_id, Proyecto.cliente_id == datos.cliente_id
        ).first()
        if not proyecto:
            raise HTTPException(status_code=404, detail="Proyecto no encontrado para este cliente")

    if datos.presupuesto_id:
        presupuesto = db.query(Presupuesto).filter(
            Presupuesto.id == datos.presupuesto_id, Presupuesto.cliente_id == datos.cliente_id
        ).first()
        if not presupuesto:
            raise HTTPException(status_code=404, detail="Presupuesto no encontrado para este cliente")

    numero = _generar_numero(db)
    r = Recibo(numero=numero, **datos.model_dump())
    db.add(r)
    db.commit()
    db.refresh(r)
    return _enriquecer(r)


@router.get("/{recibo_id}", response_model=ReciboOut)
def obtener_recibo(
    recibo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)
    r = db.query(Recibo).filter(Recibo.id == recibo_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Recibo no encontrado")
    return _enriquecer(r)


@router.get("/{recibo_id}/pdf")
def generar_pdf(
    recibo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)
    r = db.query(Recibo).filter(Recibo.id == recibo_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Recibo no encontrado")

    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.units import mm
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, Image
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.enums import TA_RIGHT, TA_CENTER

        buffer = io.BytesIO()
        NARANJA    = colors.HexColor('#D4502A')
        GRIS       = colors.HexColor('#3D4D52')
        ARENA      = colors.HexColor('#B8977E')
        NEGRO      = colors.HexColor('#111111')
        GRIS_FONDO = colors.HexColor('#F5F5F5')

        doc = SimpleDocTemplate(buffer, pagesize=A4,
            leftMargin=20*mm, rightMargin=20*mm,
            topMargin=15*mm, bottomMargin=20*mm)

        styles = getSampleStyleSheet()
        def estilo(nombre, **kwargs):
            return ParagraphStyle(nombre, parent=styles['Normal'], **kwargs)

        s_normal  = estilo('normal',  fontSize=9,  textColor=NEGRO,  fontName='Helvetica', leading=14)
        s_small   = estilo('small',   fontSize=8,  textColor=GRIS,   fontName='Helvetica')
        s_naranja = estilo('naranja', fontSize=10, textColor=colors.white, fontName='Helvetica-Bold', alignment=TA_CENTER)
        s_monto   = estilo('monto',   fontSize=13, textColor=NARANJA, fontName='Helvetica-Bold')
        s_derecha = estilo('derecha', fontSize=9,  textColor=GRIS,   fontName='Helvetica', alignment=TA_RIGHT)

        fecha_str      = r.fecha_emision.strftime('%d/%m/%Y') if r.fecha_emision else datetime.now().strftime('%d/%m/%Y')
        cliente_nombre = f"{r.cliente.apellido}, {r.cliente.nombre}" if r.cliente else "—"

        logo_path = os.path.abspath(LOGO_PATH)
        logo_img = Image(logo_path, width=18*mm, height=18*mm)

        story = []

        # Franja naranja
        story.append(Table([['']], colWidths=[170*mm], rowHeights=[3*mm],
            style=TableStyle([('BACKGROUND', (0,0), (-1,-1), NARANJA)])))
        story.append(Spacer(1, 4*mm))

        # Encabezado con logo
        enc = Table([
            [logo_img,
             Paragraph('<b>NODO</b> Ingeniería y Arquitectura<br/><font size="8" color="#888888">Salta 246, Pozo del Molle, Córdoba</font>',
                estilo('enc', fontSize=13, textColor=NARANJA, fontName='Helvetica-Bold', leading=18)),
             Paragraph(f'<b>{r.numero}</b><br/><font size="8" color="#888888">{fecha_str}</font>', s_derecha)]
        ], colWidths=[22*mm, 100*mm, 48*mm])
        enc.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'MIDDLE')]))
        story.append(enc)
        story.append(Spacer(1, 4*mm))

        # Banda RECIBO
        story.append(Table([[Paragraph('RECIBO', s_naranja)]],
            colWidths=[170*mm], rowHeights=[8*mm],
            style=TableStyle([('BACKGROUND', (0,0), (-1,-1), NARANJA), ('VALIGN', (0,0), (-1,-1), 'MIDDLE')])))
        story.append(Spacer(1, 4*mm))

        # Datos generales
        filas = [
            [Paragraph('<b>CLIENTE</b>', s_small),  Paragraph(cliente_nombre, s_normal)],
            [Paragraph('<b>CONCEPTO</b>', s_small),  Paragraph(r.concepto, s_normal)],
        ]
        if r.proyecto:
            filas.append([Paragraph('<b>PROYECTO</b>', s_small), Paragraph(r.proyecto.nombre, s_normal)])
        if r.presupuesto:
            filas.append([Paragraph('<b>PRESUPUESTO DE ORIGEN</b>', s_small), Paragraph(r.presupuesto.numero, s_normal)])

        t = Table(filas, colWidths=[45*mm, 120*mm])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), GRIS_FONDO),
            ('LINEBEFORE', (0,0), (0,-1), 3, NARANJA),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('TOPPADDING', (0,0), (-1,-1), 5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
            ('LEFTPADDING', (0,0), (0,-1), 8),
            ('LEFTPADDING', (1,0), (1,-1), 6),
        ]))
        story.append(t)
        story.append(Spacer(1, 6*mm))

        # Monto recibido
        story.append(HRFlowable(width='100%', thickness=1.5, color=NARANJA))
        story.append(Spacer(1, 2*mm))
        story.append(Paragraph('MONTO RECIBIDO',
            estilo('sec', fontSize=10, textColor=GRIS, fontName='Helvetica-Bold')))
        story.append(Spacer(1, 3*mm))

        monto_fmt = f"$ {float(r.monto):,.2f}".replace(',','X').replace('.',',').replace('X','.')
        story.append(Paragraph(monto_fmt, s_monto))
        story.append(Spacer(1, 2*mm))

        forma_texto = FORMAS_COBRO_LABEL.get(str(r.forma_cobro).split('.')[-1], str(r.forma_cobro))
        story.append(Paragraph(f'<b>Forma de cobro:</b> {forma_texto}', s_normal))
        if r.referencia:
            story.append(Spacer(1, 1*mm))
            etiqueta = 'Nro. de cheque' if 'cheque' in str(r.forma_cobro).lower() else 'Referencia'
            story.append(Paragraph(f'<b>{etiqueta}:</b> {r.referencia}', s_normal))
        story.append(Spacer(1, 6*mm))

        # Notas
        if r.notas:
            story.append(HRFlowable(width='100%', thickness=1.5, color=NARANJA))
            story.append(Spacer(1, 2*mm))
            story.append(Paragraph('NOTAS',
                estilo('sec2', fontSize=10, textColor=GRIS, fontName='Helvetica-Bold')))
            story.append(Spacer(1, 2*mm))
            story.append(Paragraph(f'• {r.notas}', s_small))
            story.append(Spacer(1, 8*mm))
        else:
            story.append(Spacer(1, 8*mm))

        # Firma
        firmas = Table(
            [[Paragraph('Ing. Gastón Conrero', estilo('f1', fontSize=9, fontName='Helvetica-Bold', alignment=TA_CENTER))]],
            colWidths=[85*mm])
        firmas.setStyle(TableStyle([
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('LINEABOVE', (0,0), (0,0), 0.5, GRIS),
        ]))
        story.append(firmas)
        story.append(Spacer(1, 6*mm))

        # Pie tricolor
        pie = Table(
            [['NODO Ingeniería y Arquitectura', 'Salta 246, Pozo del Molle', '@nodo.ing.arq']],
            colWidths=[57*mm, 56*mm, 57*mm], rowHeights=[7*mm])
        pie.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (0,0), NARANJA),
            ('BACKGROUND', (1,0), (1,0), GRIS),
            ('BACKGROUND', (2,0), (2,0), ARENA),
            ('TEXTCOLOR', (0,0), (-1,-1), colors.white),
            ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
            ('FONTSIZE', (0,0), (-1,-1), 7),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ]))
        story.append(pie)

        doc.build(story)
        buffer.seek(0)
        return StreamingResponse(buffer, media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=recibo_{r.numero}.pdf"})

    except ImportError:
        raise HTTPException(status_code=500, detail="ReportLab no está instalado")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando PDF: {str(e)}")
