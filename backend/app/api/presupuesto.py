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
from app.models.presupuesto import Presupuesto, EstadoPresupuesto
from app.models.cliente import Cliente
from app.schemas.presupuesto import PresupuestoCreate, PresupuestoUpdate, PresupuestoOut

router = APIRouter(prefix="/api/presupuestos", tags=["presupuestos"])

LOGO_PATH = '/app/backend/logo_nodo.png'


def _solo_gaston(user: User):
    if user.rol != "gaston":
        raise HTTPException(status_code=403, detail="Solo Gastón puede acceder a esta sección")


def _generar_numero(db: Session) -> str:
    anio = datetime.now().year
    count = db.query(func.count(Presupuesto.id)).filter(
        func.extract('year', Presupuesto.created_at) == anio
    ).scalar() or 0
    return f"NODO-{anio}-{str(count + 1).zfill(3)}"


def _enriquecer(p: Presupuesto) -> dict:
    d = {c.name: getattr(p, c.name) for c in p.__table__.columns}
    d["cliente_apellido"] = p.cliente.apellido if p.cliente else None
    d["cliente_nombre"]   = p.cliente.nombre   if p.cliente else None
    return d


@router.get("/", response_model=List[PresupuestoOut])
def listar_presupuestos(
    estado: Optional[str] = None,
    cliente_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)
    q = db.query(Presupuesto)
    if estado:
        q = q.filter(Presupuesto.estado == estado)
    if cliente_id:
        q = q.filter(Presupuesto.cliente_id == cliente_id)
    return [_enriquecer(p) for p in q.order_by(Presupuesto.created_at.desc()).all()]


@router.post("/", response_model=PresupuestoOut)
def crear_presupuesto(
    datos: PresupuestoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)
    cliente = db.query(Cliente).filter(Cliente.id == datos.cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    numero = _generar_numero(db)
    p = Presupuesto(numero=numero, **datos.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return _enriquecer(p)


@router.get("/{presupuesto_id}", response_model=PresupuestoOut)
def obtener_presupuesto(
    presupuesto_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)
    p = db.query(Presupuesto).filter(Presupuesto.id == presupuesto_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    return _enriquecer(p)


@router.put("/{presupuesto_id}", response_model=PresupuestoOut)
def actualizar_presupuesto(
    presupuesto_id: int,
    datos: PresupuestoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)
    p = db.query(Presupuesto).filter(Presupuesto.id == presupuesto_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    if p.estado == EstadoPresupuesto.confirmado:
        raise HTTPException(status_code=400, detail="No se puede editar un presupuesto confirmado")
    for campo, valor in datos.model_dump(exclude_unset=True).items():
        setattr(p, campo, valor)
    db.commit()
    db.refresh(p)
    return _enriquecer(p)


@router.delete("/{presupuesto_id}")
def eliminar_presupuesto(
    presupuesto_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)
    p = db.query(Presupuesto).filter(Presupuesto.id == presupuesto_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    if p.estado == EstadoPresupuesto.confirmado:
        raise HTTPException(status_code=400, detail="No se puede eliminar un presupuesto confirmado")
    db.delete(p)
    db.commit()
    return {"ok": True}


@router.post("/{presupuesto_id}/enviar")
def marcar_enviado(
    presupuesto_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)
    p = db.query(Presupuesto).filter(Presupuesto.id == presupuesto_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    p.estado = EstadoPresupuesto.enviado
    p.fecha_envio = datetime.now()
    db.commit()
    return {"ok": True, "estado": "enviado"}


@router.post("/{presupuesto_id}/confirmar")
def marcar_confirmado(
    presupuesto_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)
    p = db.query(Presupuesto).filter(Presupuesto.id == presupuesto_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    p.estado = EstadoPresupuesto.confirmado
    p.fecha_confirmacion = datetime.now()
    db.commit()
    return {"ok": True, "estado": "confirmado"}


@router.post("/{presupuesto_id}/rechazar")
def marcar_rechazado(
    presupuesto_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)
    p = db.query(Presupuesto).filter(Presupuesto.id == presupuesto_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    p.estado = EstadoPresupuesto.rechazado
    db.commit()
    return {"ok": True, "estado": "rechazado"}


@router.get("/{presupuesto_id}/pdf")
def generar_pdf(
    presupuesto_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)
    p = db.query(Presupuesto).filter(Presupuesto.id == presupuesto_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")

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

        fecha_str      = p.fecha_emision.strftime('%d/%m/%Y') if p.fecha_emision else datetime.now().strftime('%d/%m/%Y')
        cliente_nombre = f"{p.cliente.apellido}, {p.cliente.nombre}" if p.cliente else "—"

        # Logo desde archivo
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
             Paragraph(f'<b>{p.numero}</b><br/><font size="8" color="#888888">{fecha_str}</font>', s_derecha)]
        ], colWidths=[22*mm, 100*mm, 48*mm])
        enc.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'MIDDLE')]))
        story.append(enc)
        story.append(Spacer(1, 4*mm))

        # Banda PRESUPUESTO
        story.append(Table([[Paragraph('PRESUPUESTO', s_naranja)]],
            colWidths=[170*mm], rowHeights=[8*mm],
            style=TableStyle([('BACKGROUND', (0,0), (-1,-1), NARANJA), ('VALIGN', (0,0), (-1,-1), 'MIDDLE')])))
        story.append(Spacer(1, 4*mm))

        # Datos generales
        filas = [
            [Paragraph('<b>CLIENTE</b>', s_small),  Paragraph(cliente_nombre, s_normal)],
            [Paragraph('<b>SERVICIO</b>', s_small),  Paragraph(p.tipo, s_normal)],
        ]
        if p.superficie:
            filas.append([Paragraph('<b>SUPERFICIE</b>', s_small), Paragraph(f'{p.superficie} m²', s_normal)])
        if p.descripcion:
            filas.append([Paragraph('<b>DESCRIPCIÓN</b>', s_small), Paragraph(p.descripcion, s_normal)])

        t = Table(filas, colWidths=[35*mm, 130*mm])
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

        # Honorario
        story.append(HRFlowable(width='100%', thickness=1.5, color=NARANJA))
        story.append(Spacer(1, 2*mm))
        story.append(Paragraph('HONORARIO PROFESIONAL',
            estilo('sec', fontSize=10, textColor=GRIS, fontName='Helvetica-Bold')))
        story.append(Spacer(1, 3*mm))

        monto_fmt = f"$ {float(p.honorario_total):,.2f}".replace(',','X').replace('.',',').replace('X','.')
        story.append(Paragraph(monto_fmt, s_monto))
        story.append(Spacer(1, 2*mm))

        FORMAS = {
            'contado':         'Contado al inicio de los trabajos.',
            'cuotas':          p.detalle_pago or 'A convenir en cuotas.',
            'anticipo_cuotas': p.detalle_pago or 'Anticipo + cuotas a convenir.',
            'a_convenir':      p.detalle_pago or 'A convenir.',
        }
        forma_texto = FORMAS.get(str(p.forma_pago), p.detalle_pago or 'A convenir.')
        story.append(Paragraph(f'<b>Forma de pago:</b> {forma_texto}', s_normal))
        story.append(Spacer(1, 2*mm))
        story.append(Paragraph(
            'Los pagos ajustan el saldo cada 2 meses por IPC. Se estima IPC de 1,5% mensual, ajustable con valores reales INDEC.',
            s_small))
        story.append(Spacer(1, 6*mm))

        if p.incluye:
            story.append(Paragraph(f'<b>Incluye:</b> {p.incluye}', s_normal))
            story.append(Spacer(1, 2*mm))
        if p.no_incluye:
            story.append(Paragraph(f'<b>No incluye:</b> {p.no_incluye}', s_normal))
            story.append(Spacer(1, 2*mm))

        # Notas
        story.append(HRFlowable(width='100%', thickness=1.5, color=NARANJA))
        story.append(Spacer(1, 2*mm))
        story.append(Paragraph('NOTAS',
            estilo('sec2', fontSize=10, textColor=GRIS, fontName='Helvetica-Bold')))
        story.append(Spacer(1, 2*mm))
        for nota in [
            'La propiedad intelectual de las imágenes y planos es de los proyectistas.',
            'No incluye gastos de colegio profesional y caja previsional.',
            'Modificaciones posteriores a la entrega del proyecto serán cotizadas por separado.',
        ]:
            story.append(Paragraph(f'• {nota}', s_small))
        if p.notas:
            story.append(Paragraph(f'• {p.notas}', s_small))
        story.append(Spacer(1, 8*mm))

        # Firmas
        prof1 = p.profesional_1 or 'Ing. Gastón Conrero'
        col2  = Paragraph(p.profesional_2,
            estilo('f2', fontSize=9, fontName='Helvetica-Bold', alignment=TA_CENTER)) if p.profesional_2 else Paragraph('', s_normal)
        firmas = Table(
            [[Paragraph(prof1, estilo('f1', fontSize=9, fontName='Helvetica-Bold', alignment=TA_CENTER)), col2]],
            colWidths=[85*mm, 85*mm])
        fstyle = [('TOPPADDING', (0,0), (-1,-1), 4), ('LINEABOVE', (0,0), (0,0), 0.5, GRIS)]
        if p.profesional_2:
            fstyle.append(('LINEABOVE', (1,0), (1,0), 0.5, GRIS))
        firmas.setStyle(TableStyle(fstyle))
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
            headers={"Content-Disposition": f"attachment; filename=presupuesto_{p.numero}.pdf"})

    except ImportError:
        raise HTTPException(status_code=500, detail="ReportLab no está instalado")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando PDF: {str(e)}")
