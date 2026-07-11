from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from decimal import Decimal
from datetime import date

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.obra import (
    Obra, CronogramaCuota, AjusteIPCHistorial, EstadoCuota,
    ItemObra, CertificadoAvance, CertificadoItem,
)
from app.models.cliente import Cliente
from app.models.presupuesto import Presupuesto
from app.schemas.obra import (
    ObraCreate, ObraUpdate, ObraOut,
    CuotaCreate, CuotaUpdate, CuotaOut, PagarCuota, AjustarIPC, AjusteIPCOut,
    VincularPresupuesto,
    ItemCreate, ItemUpdate, ItemOut,
    CertificadoCreate, CertificadoOut, CertificadoItemOut,
    ResumenCertificados, CurvaOut, PuntoCurva,
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


@router.get("/{obra_id}/portal-link")
def obtener_link_portal(
    cliente_id: int,
    obra_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Devuelve el token del Portal del Cliente (sección 4.15), generándolo la
    primera vez que se pide. Con ese token se arma el link único (sin
    usuario/contraseña) para enviar por WhatsApp.
    """
    o = _get_obra(db, cliente_id, obra_id)
    if not o.token_portal:
        import uuid
        o.token_portal = uuid.uuid4().hex
        db.commit()
        db.refresh(o)
    return {"token": o.token_portal}


@router.post("/{obra_id}/portal-link/regenerar")
def regenerar_link_portal(
    cliente_id: int,
    obra_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Invalida el link anterior (por si se compartió por error) y genera uno nuevo."""
    _solo_gaston(current_user)
    o = _get_obra(db, cliente_id, obra_id)
    import uuid
    o.token_portal = uuid.uuid4().hex
    db.commit()
    db.refresh(o)
    return {"token": o.token_portal}


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


# ── Ítems del cómputo ─────────────────────────────────────────────────────────

def _item_out(i: ItemObra) -> dict:
    d = {c.name: getattr(i, c.name) for c in i.__table__.columns}
    d["total"] = i.cantidad * i.precio_unitario
    d["total_albanil"] = i.cantidad * i.precio_unitario_albanil
    return d


@router.get("/{obra_id}/items", response_model=List[ItemOut])
def listar_items(
    cliente_id: int,
    obra_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    o = _get_obra(db, cliente_id, obra_id)
    items = db.query(ItemObra).filter(ItemObra.obra_id == o.id).order_by(ItemObra.orden).all()
    return [_item_out(i) for i in items]


@router.post("/{obra_id}/items", response_model=ItemOut)
def crear_item(
    cliente_id: int,
    obra_id: int,
    datos: ItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)
    o = _get_obra(db, cliente_id, obra_id)
    i = ItemObra(obra_id=o.id, **datos.model_dump())
    db.add(i)
    db.commit()
    db.refresh(i)
    return _item_out(i)


@router.put("/{obra_id}/items/{item_id}", response_model=ItemOut)
def actualizar_item(
    cliente_id: int,
    obra_id: int,
    item_id: int,
    datos: ItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)
    _get_obra(db, cliente_id, obra_id)
    i = db.query(ItemObra).filter(ItemObra.id == item_id, ItemObra.obra_id == obra_id).first()
    if not i:
        raise HTTPException(status_code=404, detail="Ítem no encontrado")
    for k, v in datos.model_dump(exclude_unset=True).items():
        setattr(i, k, v)
    db.commit()
    db.refresh(i)
    return _item_out(i)


@router.delete("/{obra_id}/items/{item_id}")
def eliminar_item(
    cliente_id: int,
    obra_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)
    _get_obra(db, cliente_id, obra_id)
    i = db.query(ItemObra).filter(ItemObra.id == item_id, ItemObra.obra_id == obra_id).first()
    if not i:
        raise HTTPException(status_code=404, detail="Ítem no encontrado")
    db.delete(i)
    db.commit()
    return {"ok": True}


# ── Certificados de avance ────────────────────────────────────────────────────

def _certificado_out(cert: CertificadoAvance) -> dict:
    items_out = []
    ejecucion_mes = Decimal("0")
    ejecucion_acum = Decimal("0")
    ejecucion_mes_albanil = Decimal("0")
    ejecucion_acum_albanil = Decimal("0")
    for ci in cert.items:
        items_out.append({
            "id": ci.id,
            "item_id": ci.item_id,
            "designacion": ci.item.designacion if ci.item else None,
            "unidad": ci.item.unidad if ci.item else None,
            "pct_acum_anterior": ci.pct_acum_anterior,
            "pct_acum_nuevo": ci.pct_acum_nuevo,
            "pct_mes": ci.pct_mes,
            "total_item_snapshot": ci.total_item_snapshot,
            "monto_mes": ci.monto_mes,
            "monto_acum": ci.monto_acum,
            "saldo": ci.saldo,
            "total_item_snapshot_albanil": ci.total_item_snapshot_albanil,
            "monto_mes_albanil": ci.monto_mes_albanil,
            "monto_acum_albanil": ci.monto_acum_albanil,
            "saldo_albanil": ci.saldo_albanil,
        })
        ejecucion_mes += ci.monto_mes
        ejecucion_acum += ci.monto_acum
        ejecucion_mes_albanil += ci.monto_mes_albanil
        ejecucion_acum_albanil += ci.monto_acum_albanil

    return {
        "id": cert.id,
        "obra_id": cert.obra_id,
        "numero": cert.numero,
        "periodo": cert.periodo,
        "fecha_certificado": cert.fecha_certificado,
        "created_at": cert.created_at,
        "ejecucion_mes": ejecucion_mes,
        "ejecucion_acum": ejecucion_acum,
        "ejecucion_mes_albanil": ejecucion_mes_albanil,
        "ejecucion_acum_albanil": ejecucion_acum_albanil,
        "items": items_out,
    }


@router.get("/{obra_id}/certificados", response_model=List[CertificadoOut])
def listar_certificados(
    cliente_id: int,
    obra_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    o = _get_obra(db, cliente_id, obra_id)
    certs = (
        db.query(CertificadoAvance)
        .filter(CertificadoAvance.obra_id == o.id)
        .order_by(CertificadoAvance.numero)
        .all()
    )
    return [_certificado_out(c) for c in certs]


@router.post("/{obra_id}/certificados", response_model=CertificadoOut)
def crear_certificado(
    cliente_id: int,
    obra_id: int,
    datos: CertificadoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Carga el % acumulado de cada ítem para este período. El sistema calcula
    automáticamente el % del mes, $ del mes, $ acumulado y saldo (sección 4.6).
    Lo pueden cargar Gastón, Valentina o Valentín.
    """
    o = _get_obra(db, cliente_id, obra_id)
    if not datos.items:
        raise HTTPException(status_code=400, detail="Cargá el % de al menos un ítem")

    numero = (
        db.query(CertificadoAvance)
        .filter(CertificadoAvance.obra_id == o.id)
        .count()
    ) + 1

    cert = CertificadoAvance(
        obra_id=o.id, numero=numero, periodo=datos.periodo,
        fecha_certificado=datos.fecha_certificado,
    )
    db.add(cert)
    db.flush()  # para tener cert.id antes del commit

    for entrada in datos.items:
        item = db.query(ItemObra).filter(
            ItemObra.id == entrada.item_id, ItemObra.obra_id == o.id
        ).first()
        if not item:
            db.rollback()
            raise HTTPException(status_code=404, detail=f"Ítem {entrada.item_id} no encontrado en esta obra")

        ultimo = (
            db.query(CertificadoItem)
            .join(CertificadoAvance, CertificadoItem.certificado_id == CertificadoAvance.id)
            .filter(CertificadoItem.item_id == item.id, CertificadoAvance.obra_id == o.id)
            .order_by(CertificadoAvance.numero.desc())
            .first()
        )
        pct_acum_anterior = ultimo.pct_acum_nuevo if ultimo else Decimal("0")
        pct_acum_nuevo = entrada.pct_acum_nuevo
        pct_mes = pct_acum_nuevo - pct_acum_anterior

        total_item = item.cantidad * item.precio_unitario
        monto_mes = (pct_mes / Decimal("100")) * total_item
        monto_acum = (pct_acum_nuevo / Decimal("100")) * total_item
        saldo = total_item - monto_acum

        total_item_albanil = item.cantidad * item.precio_unitario_albanil
        monto_mes_albanil = (pct_mes / Decimal("100")) * total_item_albanil
        monto_acum_albanil = (pct_acum_nuevo / Decimal("100")) * total_item_albanil
        saldo_albanil = total_item_albanil - monto_acum_albanil

        db.add(CertificadoItem(
            certificado_id=cert.id, item_id=item.id,
            pct_acum_anterior=pct_acum_anterior, pct_acum_nuevo=pct_acum_nuevo, pct_mes=pct_mes,
            total_item_snapshot=total_item, monto_mes=monto_mes, monto_acum=monto_acum, saldo=saldo,
            total_item_snapshot_albanil=total_item_albanil, monto_mes_albanil=monto_mes_albanil,
            monto_acum_albanil=monto_acum_albanil, saldo_albanil=saldo_albanil,
        ))

    db.commit()
    db.refresh(cert)
    return _certificado_out(cert)


@router.get("/{obra_id}/certificados/{certificado_id}", response_model=CertificadoOut)
def obtener_certificado(
    cliente_id: int,
    obra_id: int,
    certificado_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_obra(db, cliente_id, obra_id)
    cert = db.query(CertificadoAvance).filter(
        CertificadoAvance.id == certificado_id, CertificadoAvance.obra_id == obra_id
    ).first()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificado no encontrado")
    return _certificado_out(cert)


@router.delete("/{obra_id}/certificados/{certificado_id}")
def eliminar_certificado(
    cliente_id: int,
    obra_id: int,
    certificado_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)
    _get_obra(db, cliente_id, obra_id)
    cert = db.query(CertificadoAvance).filter(
        CertificadoAvance.id == certificado_id, CertificadoAvance.obra_id == obra_id
    ).first()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificado no encontrado")
    db.delete(cert)
    db.commit()
    return {"ok": True}


# ── Resumen y curva ejecutado vs pagos ────────────────────────────────────────

@router.get("/{obra_id}/resumen-certificados", response_model=ResumenCertificados)
def resumen_certificados(
    cliente_id: int,
    obra_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    o = _get_obra(db, cliente_id, obra_id)

    presupuesto_base = sum((i.cantidad * i.precio_unitario for i in o.items_computo), Decimal("0"))
    ajuste_ipc_acumulado = sum((c.ajuste_ipc_cliente for c in o.cronograma), Decimal("0"))
    total_actualizado = presupuesto_base + ajuste_ipc_acumulado

    presupuesto_base_albanil = sum((i.cantidad * i.precio_unitario_albanil for i in o.items_computo), Decimal("0"))
    ajuste_ipc_acumulado_albanil = sum((c.ajuste_ipc_albanil for c in o.cronograma), Decimal("0"))
    total_actualizado_albanil = presupuesto_base_albanil + ajuste_ipc_acumulado_albanil

    ultimo_cert = (
        db.query(CertificadoAvance)
        .filter(CertificadoAvance.obra_id == o.id)
        .order_by(CertificadoAvance.numero.desc())
        .first()
    )
    ejecucion_acumulada = Decimal("0")
    ejecucion_acumulada_albanil = Decimal("0")
    if ultimo_cert:
        ejecucion_acumulada = sum((ci.monto_acum for ci in ultimo_cert.items), Decimal("0"))
        ejecucion_acumulada_albanil = sum((ci.monto_acum_albanil for ci in ultimo_cert.items), Decimal("0"))

    saldo_pendiente = total_actualizado - ejecucion_acumulada
    saldo_pendiente_albanil = total_actualizado_albanil - ejecucion_acumulada_albanil

    return {
        "presupuesto_base": presupuesto_base,
        "ajuste_ipc_acumulado": ajuste_ipc_acumulado,
        "total_actualizado": total_actualizado,
        "ejecucion_acumulada": ejecucion_acumulada,
        "saldo_pendiente": saldo_pendiente,
        "presupuesto_base_albanil": presupuesto_base_albanil,
        "ajuste_ipc_acumulado_albanil": ajuste_ipc_acumulado_albanil,
        "total_actualizado_albanil": total_actualizado_albanil,
        "ejecucion_acumulada_albanil": ejecucion_acumulada_albanil,
        "saldo_pendiente_albanil": saldo_pendiente_albanil,
    }


@router.get("/{obra_id}/curva", response_model=CurvaOut)
def curva_ejecutado_vs_pagos(
    cliente_id: int,
    obra_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Serie temporal para graficar Ejecutado (certificados) vs Pagos acumulados
    (cronograma), calculada en paralelo para cuenta cliente y cuenta albañil.
    Alerta si en algún punto los pagos superan lo ejecutado (sección 4.8):
    "El cliente pagó más de lo ejecutado" (o el equivalente para el albañil).
    """
    o = _get_obra(db, cliente_id, obra_id)
    certs = (
        db.query(CertificadoAvance)
        .filter(CertificadoAvance.obra_id == o.id)
        .order_by(CertificadoAvance.numero)
        .all()
    )

    puntos = []
    alerta = False
    alerta_albanil = False
    for cert in certs:
        ejecutado_acum = sum((ci.monto_acum for ci in cert.items), Decimal("0"))
        ejecutado_acum_albanil = sum((ci.monto_acum_albanil for ci in cert.items), Decimal("0"))

        if cert.fecha_certificado:
            pagos_acum = sum(
                (c.monto_pagado_cliente or Decimal("0"))
                for c in o.cronograma
                if c.estado == EstadoCuota.pagada and c.fecha_pago and c.fecha_pago <= cert.fecha_certificado
            )
            pagos_acum_albanil = sum(
                (c.monto_pagado_albanil or Decimal("0"))
                for c in o.cronograma
                if c.estado == EstadoCuota.pagada and c.fecha_pago and c.fecha_pago <= cert.fecha_certificado
            )
        else:
            pagos_acum = sum(
                (c.monto_pagado_cliente or Decimal("0"))
                for c in o.cronograma if c.estado == EstadoCuota.pagada
            )
            pagos_acum_albanil = sum(
                (c.monto_pagado_albanil or Decimal("0"))
                for c in o.cronograma if c.estado == EstadoCuota.pagada
            )

        if pagos_acum > ejecutado_acum:
            alerta = True
        if pagos_acum_albanil > ejecutado_acum_albanil:
            alerta_albanil = True

        puntos.append({
            "periodo": cert.periodo,
            "fecha": cert.fecha_certificado,
            "ejecutado_acum": ejecutado_acum,
            "pagos_acum": pagos_acum,
            "ejecutado_acum_albanil": ejecutado_acum_albanil,
            "pagos_acum_albanil": pagos_acum_albanil,
        })

    return {"puntos": puntos, "alerta": alerta, "alerta_albanil": alerta_albanil}
