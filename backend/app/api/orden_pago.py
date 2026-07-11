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
from app.models.orden_pago import OrdenPago, EstadoOrdenPago
from app.models.proyecto import Proyecto
from app.models.cliente import Cliente
from app.schemas.orden_pago import OrdenPagoCreate, OrdenPagoOut

router = APIRouter(prefix="/api/ordenes-pago", tags=["ordenes_pago"])

LOGO_PATH = '/app/backend/logo_nodo.png'

FORMAS_PAGO_LABEL = {
    'efectivo':      'Efectivo',
    'transferencia': 'Transferencia bancaria',
    'cheque':        'Cheque',
}

ESTADOS_LABEL = {
    'pendiente': 'Pendiente',
    'pagado':    'Pagado',
}


def _solo_gaston(user: User):
    if user.rol != "gaston":
        raise HTTPException(status_code=403, detail="Solo Gastón puede acceder a esta sección")


def _generar_numero(db: Session) -> str:
    anio = datetime.now().year
    count = db.query(func.count(OrdenPago.id)).filter(
        func.extract('year', OrdenPago.created_at) == anio
    ).scalar() or 0
    return f"OP-{anio}-{str(count + 1).zfill(3)}"


def _enriquecer(o: OrdenPago) -> dict:
    d = {c.name: getattr(o, c.name) for c in o.__table__.columns}
    d["proyecto_nombre"] = o.proyecto.nombre if o.proyecto else None
    return d


@router.get("/proyectos-disponibles")
def listar_proyectos_disponibles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)
    proyectos = (
        db.query(Proyecto, Cliente)
        .join(Cliente, Proyecto.cliente_id == Cliente.id)
        .order_by(Proyecto.created_at.desc())
        .all()
    )
    return [
        {"id": p.id, "nombre": p.nombre, "cliente": f"{c.apellido}, {c.nombre}"}
        for p, c in proyectos
    ]


@router.get("/", response_model=List[OrdenPagoOut])
def listar_ordenes(
    proyecto_id: Optional[int] = None,
    estado: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)
    q = db.query(OrdenPago)
    if proyecto_id:
        q = q.filter(OrdenPago.proyecto_id == proyecto_id)
    if estado:
        q = q.filter(OrdenPago.estado == estado)
    return [_enriquecer(o) for o in q.order_by(OrdenPago.created_at.desc()).all()]


@router.post("/", response_model=OrdenPagoOut)
def crear_orden(
    datos: OrdenPagoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)

    if datos.proyecto_id:
        proyecto = db.query(Proyecto).filter(Proyecto.id == datos.proyecto_id).first()
        if not proyecto:
            raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    numero = _generar_numero(db)
    o = OrdenPago(numero=numero, estado=EstadoOrdenPago.pendiente, **datos.model_dump())
    db.add(o)
    db.commit()
    db.refresh(o)
    return _enriquecer(o)


@router.get("/{orden_id}", response_model=OrdenPagoOut)
def obtener_orden(
    orden_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)
    o = db.query(OrdenPago).filter(OrdenPago.id == orden_id).first()
    if not o:
        raise HTTPException(status_code=404, detail="Orden de pago no encontrada")
    return _enriquecer(o)


@router.post("/{orden_id}/pagar")
def marcar_pagado(
    orden_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)
    o = db.query(OrdenPago).filter(OrdenPago.id == orden_id).first()
    if not o:
        raise HTTPException(status_code=404, detail="Orden de pago no encontrada")
    if o.estado == EstadoOrdenPago.pagado:
        raise HTTPException(status_code=400, detail="La orden ya está marcada como pagada")
    o.estado = EstadoOrdenPago.pagado
    o.fecha_pago = datetime.now()
    db.commit()
    return {"ok": True, "estado": "pagado"}


@router.delete("/{orden_id}")
def eliminar_orden(
    orden_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)
    o = db.query(OrdenPago).filter(OrdenPago.id == orden_id).first()
    if not o:
        raise HTTPException(status_code=404, detail="Orden de pago no encontrada")
    db.delete(o)
    db.commit()
    return {"ok": True}


@router.get("/{orden_id}/pdf")
def generar_pdf(
    orden_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)
    o = db.query(OrdenPago).filter(OrdenPago.id == orden_id).first()
    if not o:
        raise HTTPException(status_code=404, detail="Orden de pago no encontrada")

    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.units import mm
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, Image
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.enums import TA_RIGHT, TA_CENTER
        from xml.sax.saxutils import escape as _xml_escape

        def esc(texto):
            return _xml_escape(str(texto)) if texto is not None else ''

        buffer = io.BytesIO()
        NARANJA    = colors.HexColor('#D4502A')
        GRIS       = colors.HexColor('#3D4D52')
        ARENA      = colors.HexColor('#B8977E')
        NEGRO      = colors.HexColor('#111111')
        GRIS_FONDO = colors.HexColor('#F5F5F5')
        VERDE      = colors.HexColor('#16A34A')

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

        fecha_str = o.fecha_emision.strftime('%d/%m/%Y') if o.fecha_emision else datetime.now().strftime('%d/%m/%Y')

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
             Paragraph(f'<b>{esc(o.numero)}</b><br/><font size="8" color="#888888">{fecha_str}</font>', s_derecha)]
        ], colWidths=[22*mm, 100*mm, 48*mm])
        enc.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'MIDDLE')]))
        story.append(enc)
        story.append(Spacer(1, 4*mm))

        # Banda ORDEN DE PAGO
        story.append(Table([[Paragraph('ORDEN DE PAGO', s_naranja)]],
            colWidths=[170*mm], rowHeights=[8*mm],
            style=TableStyle([('BACKGROUND', (0,0), (-1,-1), NARANJA), ('VALIGN', (0,0), (-1,-1), 'MIDDLE')])))
        story.append(Spacer(1, 4*mm))

        # Datos generales
        filas = [
            [Paragraph('<b>DESTINATARIO</b>', s_small), Paragraph(esc(o.destinatario), s_normal)],
            [Paragraph('<b>CONCEPTO</b>', s_small),      Paragraph(esc(o.concepto), s_normal)],
        ]
        if o.proyecto:
            filas.append([Paragraph('<b>PROYECTO</b>', s_small), Paragraph(esc(o.proyecto.nombre), s_normal)])
        estado_texto = ESTADOS_LABEL.get(str(o.estado).split('.')[-1], str(o.estado))
        filas.append([Paragraph('<b>ESTADO</b>', s_small), Paragraph(estado_texto, s_normal)])

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

        # Monto
        story.append(HRFlowable(width='100%', thickness=1.5, color=NARANJA))
        story.append(Spacer(1, 2*mm))
        story.append(Paragraph('MONTO A PAGAR',
            estilo('sec', fontSize=10, textColor=GRIS, fontName='Helvetica-Bold')))
        story.append(Spacer(1, 3*mm))

        monto_fmt = f"$ {float(o.monto):,.2f}".replace(',','X').replace('.',',').replace('X','.')
        story.append(Paragraph(monto_fmt, s_monto))
        story.append(Spacer(1, 2*mm))

        forma_texto = FORMAS_PAGO_LABEL.get(str(o.forma_pago).split('.')[-1], str(o.forma_pago))
        story.append(Paragraph(f'<b>Forma de pago:</b> {forma_texto}', s_normal))
        if o.referencia:
            story.append(Spacer(1, 1*mm))
            etiqueta = 'Nro. de cheque' if 'cheque' in str(o.forma_pago).lower() else 'Referencia'
            story.append(Paragraph(f'<b>{etiqueta}:</b> {esc(o.referencia)}', s_normal))
        story.append(Spacer(1, 6*mm))

        # Notas
        if o.notas:
            story.append(HRFlowable(width='100%', thickness=1.5, color=NARANJA))
            story.append(Spacer(1, 2*mm))
            story.append(Paragraph('NOTAS',
                estilo('sec2', fontSize=10, textColor=GRIS, fontName='Helvetica-Bold')))
            story.append(Spacer(1, 2*mm))
            story.append(Paragraph(f'• {esc(o.notas)}', s_small))
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
            headers={"Content-Disposition": f"attachment; filename=orden_pago_{o.numero}.pdf"})

    except ImportError:
        raise HTTPException(status_code=500, detail="ReportLab no está instalado")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando PDF: {str(e)}")
