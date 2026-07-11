from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from decimal import Decimal
from datetime import date

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.obra import Obra, CronogramaCuota, AjusteIPCHistorial, EstadoCuota
from app.models.cliente import Cliente
from app.models.presupuesto import Presupuesto
from app.schemas.obra import (
    ObraCreate, ObraUpdate, ObraOut,
    CuotaCreate, CuotaUpdate, CuotaOut, PagarCuota, AjustarIPC, AjusteIPCOut,
    VincularPresupuesto,
)

router = APIRouter(prefix="/api/clientes/{cliente_id}/obras", tags=["obras"])


def _solo_gaston(user: User):
    if user.rol != "gaston":
        raise HTTPException(status_code=403, detail="Solo Gastón puede acceder a esta sección")


def _get_cliente(db: Session, cliente_id: int) -> Cliente:
    c = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return c


def _get_obra(db: Session, cliente_id: int, obra_id: int) -> Obra:
    o = db.query(Obra).filter(Obra.id == obra_id, Obra.cliente_id == cliente_id).first()
    if not o:
        raise HTTPException(status_code=404, detail="Obra no encontrada")
    return o


def _get_cuota(db: Session, obra_id: int, cuota_id: int) -> CronogramaCuota:
    c = db.query(CronogramaCuota).filter(
        CronogramaCuota.id == cuota_id, CronogramaCuota.obra_id == obra_id
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Cuota no encontrada")
    return c


def _enriquecer_obra(o: Obra, es_gaston: bool) -> dict:
    d = {c.name: getattr(o, c.name) for c in o.__table__.columns}
    d["presupuesto_numero"] = o.presupuesto.numero if o.presupuesto else None

    if es_gaston:
        total_cliente = sum((c.monto_cliente + c.ajuste_ipc_cliente) for c in o.cronograma) if o.cronograma else Decimal("0")
        total_albanil = sum((c.monto_albanil + c.ajuste_ipc_albanil) for c in o.cronograma) if o.cronograma else Decimal("0")
        pagado_cliente = sum((c.monto_pagado_cliente or 0) for c in o.cronograma) if o.cronograma else Decimal("0")
        pagado_albanil = sum((c.monto_pagado_albanil or 0) for c in o.cronograma) if o.cronograma else Decimal("0")
        d["total_cliente"] = total_cliente
        d["total_albanil"] = total_albanil
        d["pagado_cliente"] = pagado_cliente
        d["pagado_albanil"] = pagado_albanil
    else:
        d["total_cliente"] = None
        d["total_albanil"] = None
        d["pagado_cliente"] = None
        d["pagado_albanil"] = None

    return d


def _cuota_con_saldo(c: CronogramaCuota) -> dict:
    d = {col.name: getattr(c, col.name) for col in c.__table__.columns}
    d["saldo_cliente"] = c.monto_cliente + c.ajuste_ipc_cliente
    d["saldo_albanil"] = c.monto_albanil + c.ajuste_ipc_albanil
    return d


# ── Obra: datos generales ────────────────────────────────────────────────────

@router.get("/", response_model=List[ObraOut])
def listar_obras(
    cliente_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_cliente(db, cliente_id)
    es_gaston = current_user.rol == "gaston"
    obras = db.query(Obra).filter(Obra.cliente_id == cliente_id).order_by(Obra.created_at.desc()).all()
    return [_enriquecer_obra(o, es_gaston) for o in obras]


@router.post("/", response_model=ObraOut)
def crear_obra(
    cliente_id: int,
    datos: ObraCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)
    _get_cliente(db, cliente_id)

    if datos.presupuesto_id:
        presu = db.query(Presupuesto).filter(
            Presupuesto.id == datos.presupuesto_id, Presupuesto.cliente_id == cliente_id
        ).first()
        if not presu:
            raise HTTPException(status_code=404, detail="Presupuesto no encontrado para este cliente")

    o = Obra(cliente_id=cliente_id, **datos.model_dump())
    db.add(o)
    db.commit()
    db.refresh(o)
    return _enriquecer_obra(o, True)


@router.get("/{obra_id}", response_model=ObraOut)
def obtener_obra(
    cliente_id: int,
    obra_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    o = _get_obra(db, cliente_id, obra_id)
    return _enriquecer_obra(o, current_user.rol == "gaston")


@router.put("/{obra_id}", response_model=ObraOut)
def actualizar_obra(
    cliente_id: int,
    obra_id: int,
    datos: ObraUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)
    o = _get_obra(db, cliente_id, obra_id)
    for k, v in datos.model_dump(exclude_unset=True).items():
        setattr(o, k, v)
    db.commit()
    db.refresh(o)
    return _enriquecer_obra(o, True)


@router.delete("/{obra_id}")
def eliminar_obra(
    cliente_id: int,
    obra_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)
    o = _get_obra(db, cliente_id, obra_id)
    db.delete(o)
    db.commit()
    return {"ok": True}


@router.post("/{obra_id}/vincular-presupuesto", response_model=ObraOut)
def vincular_presupuesto(
    cliente_id: int,
    obra_id: int,
    datos: VincularPresupuesto,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)
    o = _get_obra(db, cliente_id, obra_id)
    presu = db.query(Presupuesto).filter(
        Presupuesto.id == datos.presupuesto_id, Presupuesto.cliente_id == cliente_id
    ).first()
    if not presu:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado para este cliente")
    if presu.estado != "confirmado":
        raise HTTPException(status_code=400, detail="Solo se puede vincular un presupuesto confirmado")
    o.presupuesto_id = presu.id
    db.commit()
    db.refresh(o)
    return _enriquecer_obra(o, True)


# ── Cronograma de pagos ──────────────────────────────────────────────────────

@router.get("/{obra_id}/cronograma", response_model=List[CuotaOut])
def listar_cronograma(
    cliente_id: int,
    obra_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)
    o = _get_obra(db, cliente_id, obra_id)
    return [_cuota_con_saldo(c) for c in o.cronograma]


@router.post("/{obra_id}/cronograma", response_model=CuotaOut)
def crear_cuota(
    cliente_id: int,
    obra_id: int,
    datos: CuotaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)
    o = _get_obra(db, cliente_id, obra_id)
    c = CronogramaCuota(obra_id=o.id, **datos.model_dump())
    db.add(c)
    db.commit()
    db.refresh(c)
    return _cuota_con_saldo(c)


@router.put("/{obra_id}/cronograma/{cuota_id}", response_model=CuotaOut)
def actualizar_cuota(
    cliente_id: int,
    obra_id: int,
    cuota_id: int,
    datos: CuotaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)
    _get_obra(db, cliente_id, obra_id)
    c = _get_cuota(db, obra_id, cuota_id)
    for k, v in datos.model_dump(exclude_unset=True).items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return _cuota_con_saldo(c)


@router.delete("/{obra_id}/cronograma/{cuota_id}")
def eliminar_cuota(
    cliente_id: int,
    obra_id: int,
    cuota_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)
    _get_obra(db, cliente_id, obra_id)
    c = _get_cuota(db, obra_id, cuota_id)
    db.delete(c)
    db.commit()
    return {"ok": True}


@router.post("/{obra_id}/cronograma/{cuota_id}/pagar", response_model=CuotaOut)
def pagar_cuota(
    cliente_id: int,
    obra_id: int,
    cuota_id: int,
    datos: PagarCuota,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)
    _get_obra(db, cliente_id, obra_id)
    c = _get_cuota(db, obra_id, cuota_id)

    c.estado = EstadoCuota.pagada
    c.fecha_pago = datos.fecha_pago or date.today()
    # Si no se especifica monto pagado, se toma el saldo actual (base + ajustes) como pagado
    c.monto_pagado_cliente = datos.monto_pagado_cliente if datos.monto_pagado_cliente is not None else (c.monto_cliente + c.ajuste_ipc_cliente)
    c.monto_pagado_albanil = datos.monto_pagado_albanil if datos.monto_pagado_albanil is not None else (c.monto_albanil + c.ajuste_ipc_albanil)
    db.commit()
    db.refresh(c)
    return _cuota_con_saldo(c)


@router.post("/{obra_id}/cronograma/{cuota_id}/ajustar-ipc", response_model=AjusteIPCOut)
def ajustar_ipc(
    cliente_id: int,
    obra_id: int,
    cuota_id: int,
    datos: AjustarIPC,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Aplica el ajuste IPC compuesto sobre el saldo pendiente de la cuota
    (fórmula sección 4.7 del documento base):
        ajuste = saldo * (1 + ipc/100) - saldo
    Se aplica de forma independiente a cada cuenta (cliente / albañil) y
    se acumula sobre los ajustes previos. Queda registrado en el historial
    para auditoría.
    """
    _solo_gaston(current_user)
    _get_obra(db, cliente_id, obra_id)
    c = _get_cuota(db, obra_id, cuota_id)

    if c.estado == EstadoCuota.pagada:
        raise HTTPException(status_code=400, detail="No se puede ajustar una cuota ya pagada")

    saldo_cliente_previo = c.monto_cliente + c.ajuste_ipc_cliente
    saldo_albanil_previo = c.monto_albanil + c.ajuste_ipc_albanil

    factor = (Decimal("1") + (datos.ipc_pct / Decimal("100")))
    nuevo_ajuste_cliente = (saldo_cliente_previo * factor) - saldo_cliente_previo
    nuevo_ajuste_albanil = (saldo_albanil_previo * factor) - saldo_albanil_previo

    c.ajuste_ipc_cliente = c.ajuste_ipc_cliente + nuevo_ajuste_cliente
    c.ajuste_ipc_albanil = c.ajuste_ipc_albanil + nuevo_ajuste_albanil

    historial = AjusteIPCHistorial(
        cuota_id=c.id,
        ipc_pct=datos.ipc_pct,
        fuente=datos.fuente,
        ajuste_cliente=nuevo_ajuste_cliente,
        ajuste_albanil=nuevo_ajuste_albanil,
        saldo_cliente_previo=saldo_cliente_previo,
        saldo_albanil_previo=saldo_albanil_previo,
    )
    db.add(historial)
    db.commit()
    db.refresh(historial)
    return historial


@router.get("/{obra_id}/cronograma/{cuota_id}/historial-ipc", response_model=List[AjusteIPCOut])
def historial_ipc(
    cliente_id: int,
    obra_id: int,
    cuota_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)
    _get_obra(db, cliente_id, obra_id)
    _get_cuota(db, obra_id, cuota_id)
    return (
        db.query(AjusteIPCHistorial)
        .filter(AjusteIPCHistorial.cuota_id == cuota_id)
        .order_by(AjusteIPCHistorial.created_at.desc())
        .all()
    )
