from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from decimal import Decimal
import io
import os

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.obra import Obra, CronogramaCuota, CertificadoAvance, EstadoCuota
from app.models.informe import SeguimientoSemanal, SintesisMensual
from app.schemas.informe import (
    SeguimientoUpsert, SeguimientoOut, SintesisUpsert, SintesisOut,
)

router = APIRouter(prefix="/api/clientes/{cliente_id}/obras/{obra_id}/informe", tags=["informe"])

LOGO_PATH = '/app/backend/logo_nodo.png'


def _get_obra(db: Session, cliente_id: int, obra_id: int) -> Obra:
    o = db.query(Obra).filter(Obra.id == obra_id, Obra.cliente_id == cliente_id).first()
    if not o:
        raise HTTPException(status_code=404, detail="Obra no encontrada")
    return o


# ── Seguimiento semanal ───────────────────────────────────────────────────────

@router.get("/seguimiento", response_model=List[SeguimientoOut])
def listar_seguimiento(
    cliente_id: int,
    obra_id: int,
    periodo: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    o = _get_obra(db, cliente_id, obra_id)
    return (
        db.query(SeguimientoSemanal)
        .filter(SeguimientoSemanal.obra_id == o.id, SeguimientoSemanal.periodo == periodo)
        .order_by(SeguimientoSemanal.semana_numero)
        .all()
    )


@router.post("/seguimiento", response_model=SeguimientoOut)
def guardar_seguimiento(
    cliente_id: int,
    obra_id: int,
    datos: SeguimientoUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Crea o actualiza la semana (1 a 4) de un período. Lo pueden cargar los tres."""
    o = _get_obra(db, cliente_id, obra_id)
    if datos.semana_numero not in (1, 2, 3, 4):
        raise HTTPException(status_code=400, detail="La semana debe ser 1, 2, 3 o 4")

    s = (
        db.query(SeguimientoSemanal)
        .filter(
            SeguimientoSemanal.obra_id == o.id,
            SeguimientoSemanal.periodo == datos.periodo,
            SeguimientoSemanal.semana_numero == datos.semana_numero,
        )
        .first()
    )
    if s:
        s.descripcion = datos.descripcion
        s.foto_url_1 = datos.foto_url_1
        s.foto_url_2 = datos.foto_url_2
    else:
        s = SeguimientoSemanal(obra_id=o.id, **datos.model_dump())
        db.add(s)
    db.commit()
    db.refresh(s)
    return s


@router.delete("/seguimiento/{seguimiento_id}")
def eliminar_seguimiento(
    cliente_id: int,
    obra_id: int,
    seguimiento_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_obra(db, cliente_id, obra_id)
    s = db.query(SeguimientoSemanal).filter(
        SeguimientoSemanal.id == seguimiento_id, SeguimientoSemanal.obra_id == obra_id
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="Seguimiento no encontrado")
    db.delete(s)
    db.commit()
    return {"ok": True}


# ── Síntesis mensual ──────────────────────────────────────────────────────────

@router.get("/sintesis", response_model=Optional[SintesisOut])
def obtener_sintesis(
    cliente_id: int,
    obra_id: int,
    periodo: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    o = _get_obra(db, cliente_id, obra_id)
    return (
        db.query(SintesisMensual)
        .filter(SintesisMensual.obra_id == o.id, SintesisMensual.periodo == periodo)
        .first()
    )


@router.post("/sintesis", response_model=SintesisOut)
def guardar_sintesis(
    cliente_id: int,
    obra_id: int,
    datos: SintesisUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    o = _get_obra(db, cliente_id, obra_id)
    s = (
        db.query(SintesisMensual)
        .filter(SintesisMensual.obra_id == o.id, SintesisMensual.periodo == datos.periodo)
        .first()
    )
    if s:
        s.texto = datos.texto
    else:
        s = SintesisMensual(obra_id=o.id, periodo=datos.periodo, texto=datos.texto)
        db.add(s)
    db.commit()
    db.refresh(s)
    return s


# ── Generación del PDF (3 páginas, sección 4.11) ──────────────────────────────

def _descargar_imagen(url: str):
    """Descarga una imagen desde una URL para embeberla en el PDF. Falla en silencio."""
    if not url:
        return None
    try:
        import requests
        resp = requests.get(url, timeout=8)
        if resp.status_code == 200 and resp.content:
            return io.BytesIO(resp.content)
    except Exception:
        pass
    return None


@router.get("/pdf")
def generar_informe_pdf(
    cliente_id: int,
    obra_id: int,
    periodo: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from fastapi.responses import StreamingResponse

    o = _get_obra(db, cliente_id, obra_id)

    seguimientos = {
        s.semana_numero: s
        for s in db.query(SeguimientoSemanal).filter(
            SeguimientoSemanal.obra_id == o.id, SeguimientoSemanal.periodo == periodo
        ).all()
    }
    sintesis = db.query(SintesisMensual).filter(
        SintesisMensual.obra_id == o.id, SintesisMensual.periodo == periodo
    ).first()

    # Certificado del período (para "ejecución acumulada" y la curva)
    certs = (
        db.query(CertificadoAvance)
        .filter(CertificadoAvance.obra_id == o.id)
        .order_by(CertificadoAvance.numero)
        .all()
    )
    cert_periodo = next((c for c in certs if c.periodo == periodo), None)

    ejecucion_acumulada = Decimal("0")
    if cert_periodo:
        ejecucion_acumulada = sum((ci.monto_acum for ci in cert_periodo.items), Decimal("0"))

    # Curva (todos los certificados hasta el período elegido, cuenta cliente)
    puntos_curva = []
    alerta = False
    for c in certs:
        ejecutado_acum = sum((ci.monto_acum for ci in c.items), Decimal("0"))
        if c.fecha_certificado:
            pagos_acum = sum(
                (cu.monto_pagado_cliente or Decimal("0"))
                for cu in o.cronograma
                if cu.estado == EstadoCuota.pagada and cu.fecha_pago and cu.fecha_pago <= c.fecha_certificado
            )
        else:
            pagos_acum = sum(
                (cu.monto_pagado_cliente or Decimal("0"))
                for cu in o.cronograma if cu.estado == EstadoCuota.pagada
            )
        if pagos_acum > ejecutado_acum:
            alerta = True
        puntos_curva.append((c.periodo, float(ejecutado_acum), float(pagos_acum)))
        if c.periodo == periodo:
            break  # el informe muestra la curva hasta el período actual

    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.units import mm
        from reportlab.platypus import (
            SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
            Image as RLImage, PageBreak,
        )
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.enums import TA_CENTER, TA_RIGHT
        from reportlab.graphics.shapes import Drawing, Line, String, Rect
        from xml.sax.saxutils import escape as _xml_escape

        def esc(t):
            return _xml_escape(str(t)) if t is not None else ''

        NARANJA    = colors.HexColor('#D4502A')
        GRIS       = colors.HexColor('#3D4D52')
        ARENA      = colors.HexColor('#B8977E')
        CREMA      = colors.HexColor('#FBF6EE')
        GRIS_FONDO = colors.HexColor('#F5F5F5')

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4,
            leftMargin=18*mm, rightMargin=18*mm, topMargin=14*mm, bottomMargin=16*mm)

        styles = getSampleStyleSheet()
        def estilo(nombre, **kw):
            return ParagraphStyle(nombre, parent=styles['Normal'], **kw)

        s_normal  = estilo('normal', fontSize=9.5, textColor=colors.HexColor('#111'), leading=14)
        s_small   = estilo('small', fontSize=8, textColor=GRIS)
        s_banda   = estilo('banda', fontSize=11, textColor=colors.white, fontName='Helvetica-Bold', alignment=TA_CENTER)
        s_semana  = estilo('semana', fontSize=10, textColor=NARANJA, fontName='Helvetica-Bold')

        logo_path = os.path.abspath(LOGO_PATH)
        story = []

        def encabezado():
            elems = []
            elems.append(Table([['']], colWidths=[174*mm], rowHeights=[3*mm],
                style=TableStyle([('BACKGROUND', (0, 0), (-1, -1), NARANJA)])))
            elems.append(Spacer(1, 4*mm))
            logo_img = RLImage(logo_path, width=16*mm, height=16*mm)
            enc = Table([
                [logo_img,
                 Paragraph('<b>NODO</b> Ingeniería y Arquitectura<br/><font size="8" color="#888888">Informe mensual de avance</font>',
                    estilo('enctit', fontSize=12, textColor=NARANJA, fontName='Helvetica-Bold', leading=16)),
                 Paragraph(f'<b>{esc(o.nombre)}</b><br/><font size="8" color="#888888">{esc(periodo)}</font>',
                    estilo('encder', fontSize=9, textColor=GRIS, alignment=TA_RIGHT))]
            ], colWidths=[20*mm, 100*mm, 54*mm])
            enc.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'MIDDLE')]))
            elems.append(enc)
            elems.append(Spacer(1, 5*mm))
            return elems

        def bloque_semana(numero):
          s_data = seguimientos.get(numero)
          bloque = []
          bloque.append(Table([[Paragraph(f'SEMANA {numero}', s_banda)]],
              colWidths=[174*mm], rowHeights=[7*mm],
              style=TableStyle([('BACKGROUND', (0, 0), (-1, -1), GRIS), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE')])))
          bloque.append(Spacer(1, 2*mm))
          if not s_data or (not s_data.descripcion and not s_data.foto_url_1 and not s_data.foto_url_2):
              bloque.append(Paragraph('Sin novedades cargadas para esta semana.', s_small))
          else:
              if s_data.descripcion:
                  bloque.append(Paragraph(esc(s_data.descripcion), s_normal))
              fotos = []
              for url in (s_data.foto_url_1, s_data.foto_url_2):
                  img_data = _descargar_imagen(url)
                  if img_data:
                      try:
                          fotos.append(RLImage(img_data, width=82*mm, height=60*mm))
                      except Exception:
                          pass
              if fotos:
                  bloque.append(Spacer(1, 3*mm))
                  if len(fotos) == 2:
                      t = Table([fotos], colWidths=[87*mm, 87*mm])
                      t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP')]))
                      bloque.append(t)
                  else:
                      bloque.append(fotos[0])
          bloque.append(Spacer(1, 6*mm))
          return bloque

        # ── Página 1: semanas 1 y 2 ──
        story += encabezado()
        story += bloque_semana(1)
        story += bloque_semana(2)
        story.append(PageBreak())

        # ── Página 2: semanas 3, 4 y síntesis del mes ──
        story += encabezado()
        story += bloque_semana(3)
        story += bloque_semana(4)

        story.append(HRFlowable(width='100%', thickness=1, color=colors.HexColor('#e5e5e5')))
        story.append(Spacer(1, 3*mm))
        texto_sintesis = sintesis.texto if sintesis and sintesis.texto else 'Sin síntesis cargada para este período.'
        sintesis_tabla = Table(
            [[Paragraph('<b>SÍNTESIS DEL MES</b>', estilo('sinttit', fontSize=10, textColor=GRIS, fontName='Helvetica-Bold'))],
             [Paragraph(esc(texto_sintesis), s_normal)]],
            colWidths=[174*mm])
        sintesis_tabla.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), CREMA),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ]))
        story.append(sintesis_tabla)
        story.append(PageBreak())

        # ── Página 3: ejecución acumulada + curva ──
        story += encabezado()
        story.append(Table([[Paragraph('EJECUCIÓN ACUMULADA', s_banda)]],
            colWidths=[174*mm], rowHeights=[7*mm],
            style=TableStyle([('BACKGROUND', (0, 0), (-1, -1), NARANJA), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE')])))
        story.append(Spacer(1, 4*mm))

        monto_fmt = f"$ {float(ejecucion_acumulada):,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
        story.append(Paragraph(monto_fmt, estilo('ejec', fontSize=20, textColor=NARANJA, fontName='Helvetica-Bold')))
        story.append(Spacer(1, 6*mm))

        if alerta:
            aviso = Table([[Paragraph('⚠ En algún período los pagos superaron lo ejecutado.',
                estilo('aviso', fontSize=9, textColor=colors.HexColor('#991b1b'), fontName='Helvetica-Bold'))]],
                colWidths=[174*mm])
            aviso.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#fef2f2')),
                ('TOPPADDING', (0, 0), (-1, -1), 6), ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ]))
            story.append(aviso)
            story.append(Spacer(1, 6*mm))

        if len(puntos_curva) >= 1:
            story.append(Paragraph('CURVA: EJECUTADO VS. PAGOS', estilo('curvtit', fontSize=10, textColor=GRIS, fontName='Helvetica-Bold')))
            story.append(Spacer(1, 4*mm))

            W, H = 174*mm, 70*mm
            d = Drawing(W, H)
            max_val = max([1.0] + [p[1] for p in puntos_curva] + [p[2] for p in puntos_curva])
            pad_l, pad_b, pad_t = 12*mm, 12*mm, 4*mm
            plot_w = W - pad_l - 4*mm
            plot_h = H - pad_b - pad_t
            n = len(puntos_curva)
            step_x = plot_w / (n - 1) if n > 1 else 0

            def px(i):
                return pad_l + i * step_x

            def py(val):
                return pad_b + (val / max_val) * plot_h

            d.add(Line(pad_l, pad_b, pad_l + plot_w, pad_b, strokeColor=colors.HexColor('#cccccc')))

            pts_ejec = []
            pts_pago = []
            for i, (per, ejec, pago) in enumerate(puntos_curva):
                pts_ejec.append((px(i), py(ejec)))
                pts_pago.append((px(i), py(pago)))
                d.add(String(px(i), pad_b - 8, per[:8], fontSize=6, fillColor=GRIS, textAnchor='middle'))

            for i in range(len(pts_ejec) - 1):
                d.add(Line(pts_ejec[i][0], pts_ejec[i][1], pts_ejec[i+1][0], pts_ejec[i+1][1],
                    strokeColor=NARANJA, strokeWidth=2))
            for i in range(len(pts_pago) - 1):
                d.add(Line(pts_pago[i][0], pts_pago[i][1], pts_pago[i+1][0], pts_pago[i+1][1],
                    strokeColor=colors.HexColor('#999999'), strokeWidth=1.5, strokeDashArray=[3, 2]))

            for x, y in pts_ejec:
                d.add(Rect(x-1.5, y-1.5, 3, 3, fillColor=NARANJA, strokeColor=None))
            for x, y in pts_pago:
                d.add(Rect(x-1.2, y-1.2, 2.4, 2.4, fillColor=colors.HexColor('#999999'), strokeColor=None))

            story.append(d)
            story.append(Spacer(1, 2*mm))
            leyenda = Table([[
                Paragraph('<font color="#D4502A">━━</font> Ejecutado', s_small),
                Paragraph('<font color="#999999">┅┅</font> Pagos', s_small),
            ]], colWidths=[87*mm, 87*mm])
            story.append(leyenda)

        story.append(Spacer(1, 10*mm))
        pie = Table(
            [['NODO Ingeniería y Arquitectura', 'Salta 246, Pozo del Molle', '@nodo.ing.arq']],
            colWidths=[58*mm, 58*mm, 58*mm], rowHeights=[7*mm])
        pie.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, 0), NARANJA),
            ('BACKGROUND', (1, 0), (1, 0), GRIS),
            ('BACKGROUND', (2, 0), (2, 0), ARENA),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
            ('FONTSIZE', (0, 0), (-1, -1), 7),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        story.append(pie)

        doc.build(story)
        buffer.seek(0)
        nombre_archivo = f"informe_{o.nombre.replace(' ', '_')}_{periodo.replace(' ', '_')}.pdf"
        return StreamingResponse(buffer, media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={nombre_archivo}"})

    except ImportError:
        raise HTTPException(status_code=500, detail="ReportLab no está instalado")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando el informe: {str(e)}")
