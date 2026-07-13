from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from decimal import Decimal

from app.core.database import get_db
from app.models.obra import Obra, CertificadoAvance
from app.models.informe import SeguimientoSemanal
from app.models.cliente import Cliente

router = APIRouter(prefix="/api/portal", tags=["portal"])


def _get_obra_por_token(db: Session, token: str) -> Obra:
    o = db.query(Obra).filter(Obra.token_portal == token).first()
    if not o:
        raise HTTPException(status_code=404, detail="Link inválido o vencido")
    return o


def _estado_item(pct) -> str:
    p = float(pct or 0)
    if p <= 0:
        return "Sin iniciar"
    if p >= 100:
        return "Terminado"
    return "En progreso"


def _orden_natural(orden_str) -> tuple:
    if not orden_str:
        return (0,)
    partes = []
    for p in str(orden_str).split("."):
        p = p.strip()
        try:
            partes.append(int(p))
        except ValueError:
            partes.append(0)
    return tuple(partes) if partes else (0,)


@router.get("/{token}")
def datos_generales(token: str, db: Session = Depends(get_db)):
    o = _get_obra_por_token(db, token)
    cliente = db.query(Cliente).filter(Cliente.id == o.cliente_id).first()

    ultimo_cert = (
        db.query(CertificadoAvance)
        .filter(CertificadoAvance.obra_id == o.id)
        .order_by(CertificadoAvance.numero.desc())
        .first()
    )

    avance_global = 0
    if ultimo_cert and ultimo_cert.items:
        peso_total = sum((ci.total_item_snapshot for ci in ultimo_cert.items), Decimal("0"))
        if peso_total > 0:
            avance_ponderado = sum(
                (ci.pct_acum_nuevo * ci.total_item_snapshot for ci in ultimo_cert.items), Decimal("0")
            )
            avance_global = float(avance_ponderado / peso_total)
        else:
            avance_global = float(
                sum((ci.pct_acum_nuevo for ci in ultimo_cert.items), Decimal("0")) / len(ultimo_cert.items)
            )

    return {
        "obra_nombre": o.nombre,
        "tipo_obra": o.tipo_obra,
        "cliente_nombre": f"{cliente.nombre} {cliente.apellido}" if cliente else None,
        "estado": o.estado.value if hasattr(o.estado, "value") else o.estado,
        "avance_global": round(avance_global, 1),
        "ultimo_periodo": ultimo_cert.periodo if ultimo_cert else None,
    }


@router.get("/{token}/avance")
def avance_por_item(token: str, db: Session = Depends(get_db)):
    """Sección 4.15: % global + barras de progreso por ítem + estado. Sin números."""
    o = _get_obra_por_token(db, token)
    ultimo_cert = (
        db.query(CertificadoAvance)
        .filter(CertificadoAvance.obra_id == o.id)
        .order_by(CertificadoAvance.numero.desc())
        .first()
    )
    if not ultimo_cert:
        return []

    items = []
    for ci in sorted(ultimo_cert.items, key=lambda x: _orden_natural(x.item.orden if x.item else None)):
        items.append({
            "designacion": ci.item.designacion if ci.item else "—",
            "unidad": ci.item.unidad if ci.item else None,
            "pct": float(ci.pct_acum_nuevo),
            "estado": _estado_item(ci.pct_acum_nuevo),
        })
    return items


@router.get("/{token}/seguimiento")
def seguimiento_semanal(token: str, db: Session = Depends(get_db)):
    """Sección 4.15: descripciones + fotos. Sin números."""
    o = _get_obra_por_token(db, token)
    registros = (
        db.query(SeguimientoSemanal)
        .filter(SeguimientoSemanal.obra_id == o.id)
        .order_by(SeguimientoSemanal.created_at.desc())
        .all()
    )
    salida = []
    for r in registros:
        if not r.descripcion and not r.foto_url_1 and not r.foto_url_2:
            continue
        salida.append({
            "periodo": r.periodo,
            "semana_numero": r.semana_numero,
            "descripcion": r.descripcion,
            "foto_url_1": r.foto_url_1,
            "foto_url_2": r.foto_url_2,
        })
    return salida
