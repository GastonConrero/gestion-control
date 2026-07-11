from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.cliente import Cliente
from app.models.proyecto import Proyecto, EstadoProyecto
from app.models.presupuesto import Presupuesto, EstadoPresupuesto
from app.models.recibo import Recibo
from app.models.orden_pago import OrdenPago, EstadoOrdenPago

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/resumen")
def resumen(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    es_gaston = current_user.rol == "gaston"
    hoy = datetime.now()

    total_clientes = db.query(func.count(Cliente.id)).scalar() or 0
    proyectos_activos = (
        db.query(func.count(Proyecto.id))
        .filter(Proyecto.estado == EstadoProyecto.en_curso)
        .scalar() or 0
    )
    presupuestos_pendientes = (
        db.query(func.count(Presupuesto.id))
        .filter(Presupuesto.estado == EstadoPresupuesto.enviado)
        .scalar() or 0
    )

    data = {
        "clientes": total_clientes,
        "proyectos_activos": proyectos_activos,
        "presupuestos_pendientes": presupuestos_pendientes,
        "ordenes_pendientes": None,
        "financiero": None,
        "actividad": [],
    }

    # Datos financieros (recibos y órdenes de pago) solo para Gastón,
    # igual que en sus módulos de origen.
    if not es_gaston:
        return data

    ordenes_pendientes = (
        db.query(func.count(OrdenPago.id))
        .filter(OrdenPago.estado == EstadoOrdenPago.pendiente)
        .scalar() or 0
    )
    data["ordenes_pendientes"] = ordenes_pendientes

    total_recibido_mes = (
        db.query(func.coalesce(func.sum(Recibo.monto), 0))
        .filter(
            extract('year', Recibo.fecha_emision) == hoy.year,
            extract('month', Recibo.fecha_emision) == hoy.month,
        )
        .scalar() or 0
    )
    total_pagado_mes = (
        db.query(func.coalesce(func.sum(OrdenPago.monto), 0))
        .filter(
            OrdenPago.estado == EstadoOrdenPago.pagado,
            extract('year', OrdenPago.fecha_pago) == hoy.year,
            extract('month', OrdenPago.fecha_pago) == hoy.month,
        )
        .scalar() or 0
    )

    data["financiero"] = {
        "recibido_mes": float(total_recibido_mes),
        "pagado_mes": float(total_pagado_mes),
        "saldo_mes": float(total_recibido_mes) - float(total_pagado_mes),
    }

    # Actividad reciente: combina recibos, órdenes de pago y presupuestos
    actividad = []

    for r in db.query(Recibo).order_by(Recibo.created_at.desc()).limit(10).all():
        actividad.append({
            "tipo": "recibo",
            "icono": "💰",
            "titulo": f"Recibo {r.numero}",
            "detalle": f"{r.cliente.apellido}, {r.cliente.nombre}" if r.cliente else "",
            "monto": float(r.monto),
            "fecha": r.created_at.isoformat() if r.created_at else None,
        })

    for o in db.query(OrdenPago).order_by(OrdenPago.created_at.desc()).limit(10).all():
        actividad.append({
            "tipo": "orden_pago",
            "icono": "💸",
            "titulo": f"Orden de pago {o.numero}",
            "detalle": o.destinatario,
            "monto": float(o.monto),
            "fecha": o.created_at.isoformat() if o.created_at else None,
        })

    for p in db.query(Presupuesto).order_by(Presupuesto.created_at.desc()).limit(10).all():
        actividad.append({
            "tipo": "presupuesto",
            "icono": "📋",
            "titulo": f"Presupuesto {p.numero}",
            "detalle": f"{p.cliente.apellido}, {p.cliente.nombre}" if p.cliente else "",
            "monto": float(p.honorario_total) if p.honorario_total else None,
            "fecha": p.created_at.isoformat() if p.created_at else None,
        })

    actividad.sort(key=lambda x: x["fecha"] or "", reverse=True)
    data["actividad"] = actividad[:8]

    return data
