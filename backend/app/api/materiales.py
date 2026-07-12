from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from decimal import Decimal
from datetime import date

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.obra import Obra
from app.models.materiales import (
    ListadoMateriales, ItemListado, CotizacionProveedor, ItemCotizacion,
    TipoFactura, EstadoCotizacion,
)
from app.schemas.materiales import (
    ListadoCreate, ListadoUpdate, ListadoOut, ListadoDetalle,
    ItemListadoCreate, ItemListadoUpdate, ItemListadoOut, EntregaCreate,
    CotizacionCreate, CotizacionUpdate, CotizacionOut, CotizacionDetalle,
    ItemCotizacionCreate, ItemCotizacionUpdate, ItemCotizacionOut,
    ElegirGanadora, ComparativaOut, FilaComparativa,
)

router = APIRouter(prefix="/api/materiales", tags=["materiales"])

IVA = Decimal("1.21")
UMBRAL_DISPERSION = Decimal("10")


def _solo_gaston(user: User):
    if user.rol != "gaston":
        raise HTTPException(status_code=403, detail="Solo Gastón puede eliminar")


def _get_listado(db: Session, listado_id: int) -> ListadoMateriales:
    l = db.query(ListadoMateriales).filter(ListadoMateriales.id == listado_id).first()
    if not l:
        raise HTTPException(status_code=404, detail="Listado no encontrado")
    return l


def _get_cotizacion(db: Session, cotizacion_id: int) -> CotizacionProveedor:
    c = db.query(CotizacionProveedor).filter(CotizacionProveedor.id == cotizacion_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")
    return c


def _precio_sin_iva(precio_factura: Decimal, tipo: TipoFactura) -> Decimal:
    if tipo == TipoFactura.A:
        return precio_factura / IVA
    return precio_factura  # Factura C: el precio ya es el final/comparable


def _item_cot_out(ic: ItemCotizacion) -> dict:
    d = {c.name: getattr(ic, c.name) for c in ic.__table__.columns}
    precio_sin_iva = _precio_sin_iva(ic.precio_unitario_factura, ic.cotizacion.tipo_factura)
    d["precio_unitario_sin_iva"] = precio_sin_iva
    d["subtotal_sin_iva"] = precio_sin_iva * ic.cantidad
    return d


def _total_sin_iva_cotizacion(c: CotizacionProveedor) -> Decimal:
    total = Decimal("0")
    for it in c.items:
        total += _precio_sin_iva(it.precio_unitario_factura, c.tipo_factura) * it.cantidad
    return total


def _cotizacion_out(c: CotizacionProveedor) -> dict:
    d = {col.name: getattr(c, col.name) for col in c.__table__.columns}
    d["total_sin_iva"] = _total_sin_iva_cotizacion(c)
    return d


def _item_listado_out(i: ItemListado) -> dict:
    d = {c.name: getattr(i, c.name) for c in i.__table__.columns}
    d["saldo"] = i.cantidad_pedida - i.cantidad_entregada
    return d


def _listado_out(l: ListadoMateriales) -> dict:
    d = {c.name: getattr(l, c.name) for c in l.__table__.columns}
    d["obra_nombre"] = l.obra.nombre if l.obra else None
    d["cant_items"] = len(l.items)
    d["cant_cotizaciones"] = len(l.cotizaciones)
    return d


# ── Listados de materiales ────────────────────────────────────────────────────

@router.get("/listados", response_model=List[ListadoOut])
def listar_listados(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    listados = db.query(ListadoMateriales).order_by(ListadoMateriales.created_at.desc()).all()
    return [_listado_out(l) for l in listados]


@router.post("/listados", response_model=ListadoOut)
def crear_listado(
    datos: ListadoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if datos.obra_id:
        obra = db.query(Obra).filter(Obra.id == datos.obra_id).first()
        if not obra:
            raise HTTPException(status_code=404, detail="Obra no encontrada")
    l = ListadoMateriales(**datos.model_dump())
    db.add(l)
    db.commit()
    db.refresh(l)
    return _listado_out(l)


@router.get("/listados/{listado_id}", response_model=ListadoDetalle)
def obtener_listado(
    listado_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    l = _get_listado(db, listado_id)
    d = _listado_out(l)
    d["items"] = [_item_listado_out(i) for i in l.items]
    return d


@router.put("/listados/{listado_id}", response_model=ListadoOut)
def actualizar_listado(
    listado_id: int,
    datos: ListadoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    l = _get_listado(db, listado_id)
    for k, v in datos.model_dump(exclude_unset=True).items():
        setattr(l, k, v)
    db.commit()
    db.refresh(l)
    return _listado_out(l)


@router.delete("/listados/{listado_id}")
def eliminar_listado(
    listado_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)
    l = _get_listado(db, listado_id)
    db.delete(l)
    db.commit()
    return {"ok": True}


# ── Ítems del listado (+ control de entregas, etapa 3) ────────────────────────

@router.post("/listados/{listado_id}/items", response_model=ItemListadoOut)
def crear_item_listado(
    listado_id: int,
    datos: ItemListadoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    l = _get_listado(db, listado_id)
    i = ItemListado(listado_id=l.id, **datos.model_dump())
    db.add(i)
    db.commit()
    db.refresh(i)
    return _item_listado_out(i)


@router.put("/listados/{listado_id}/items/{item_id}", response_model=ItemListadoOut)
def actualizar_item_listado(
    listado_id: int,
    item_id: int,
    datos: ItemListadoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    i = db.query(ItemListado).filter(ItemListado.id == item_id, ItemListado.listado_id == listado_id).first()
    if not i:
        raise HTTPException(status_code=404, detail="Ítem no encontrado")
    for k, v in datos.model_dump(exclude_unset=True).items():
        setattr(i, k, v)
    db.commit()
    db.refresh(i)
    return _item_listado_out(i)


@router.delete("/listados/{listado_id}/items/{item_id}")
def eliminar_item_listado(
    listado_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    i = db.query(ItemListado).filter(ItemListado.id == item_id, ItemListado.listado_id == listado_id).first()
    if not i:
        raise HTTPException(status_code=404, detail="Ítem no encontrado")
    db.delete(i)
    db.commit()
    return {"ok": True}


@router.post("/listados/{listado_id}/items/{item_id}/entrega", response_model=ItemListadoOut)
def registrar_entrega(
    listado_id: int,
    item_id: int,
    datos: EntregaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Control de entregas (etapa 3): cantidad entregada acumulada, sin necesidad de remito."""
    i = db.query(ItemListado).filter(ItemListado.id == item_id, ItemListado.listado_id == listado_id).first()
    if not i:
        raise HTTPException(status_code=404, detail="Ítem no encontrado")
    i.cantidad_entregada = datos.cantidad_entregada
    db.commit()
    db.refresh(i)
    return _item_listado_out(i)


# ── Cotizaciones de proveedores ───────────────────────────────────────────────

@router.get("/listados/{listado_id}/cotizaciones", response_model=List[CotizacionOut])
def listar_cotizaciones(
    listado_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    l = _get_listado(db, listado_id)
    return [_cotizacion_out(c) for c in l.cotizaciones]


@router.post("/listados/{listado_id}/cotizaciones", response_model=CotizacionOut)
def crear_cotizacion(
    listado_id: int,
    datos: CotizacionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    l = _get_listado(db, listado_id)
    c = CotizacionProveedor(listado_id=l.id, **datos.model_dump())
    db.add(c)
    db.commit()
    db.refresh(c)
    return _cotizacion_out(c)


@router.get("/cotizaciones/{cotizacion_id}", response_model=CotizacionDetalle)
def obtener_cotizacion(
    cotizacion_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = _get_cotizacion(db, cotizacion_id)
    d = _cotizacion_out(c)
    d["items"] = [_item_cot_out(it) for it in c.items]
    return d


@router.put("/cotizaciones/{cotizacion_id}", response_model=CotizacionOut)
def actualizar_cotizacion(
    cotizacion_id: int,
    datos: CotizacionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = _get_cotizacion(db, cotizacion_id)
    for k, v in datos.model_dump(exclude_unset=True).items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return _cotizacion_out(c)


@router.delete("/cotizaciones/{cotizacion_id}")
def eliminar_cotizacion(
    cotizacion_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)
    c = _get_cotizacion(db, cotizacion_id)
    db.delete(c)
    db.commit()
    return {"ok": True}


@router.post("/cotizaciones/{cotizacion_id}/confirmar", response_model=CotizacionOut)
def confirmar_cotizacion(
    cotizacion_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Revisión manual completa (sección 4.12): pasa de 'pendiente_revision' a 'confirmada'."""
    c = _get_cotizacion(db, cotizacion_id)
    c.estado = EstadoCotizacion.confirmada
    db.commit()
    db.refresh(c)
    return _cotizacion_out(c)


# ── Ítems de la cotización ─────────────────────────────────────────────────────

@router.post("/cotizaciones/{cotizacion_id}/items", response_model=ItemCotizacionOut)
def crear_item_cotizacion(
    cotizacion_id: int,
    datos: ItemCotizacionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    c = _get_cotizacion(db, cotizacion_id)
    it = ItemCotizacion(cotizacion_id=c.id, **datos.model_dump())
    db.add(it)
    db.commit()
    db.refresh(it)
    return _item_cot_out(it)


@router.put("/cotizaciones/{cotizacion_id}/items/{item_id}", response_model=ItemCotizacionOut)
def actualizar_item_cotizacion(
    cotizacion_id: int,
    item_id: int,
    datos: ItemCotizacionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    it = db.query(ItemCotizacion).filter(
        ItemCotizacion.id == item_id, ItemCotizacion.cotizacion_id == cotizacion_id
    ).first()
    if not it:
        raise HTTPException(status_code=404, detail="Ítem no encontrado")
    for k, v in datos.model_dump(exclude_unset=True).items():
        setattr(it, k, v)
    db.commit()
    db.refresh(it)
    return _item_cot_out(it)


@router.delete("/cotizaciones/{cotizacion_id}/items/{item_id}")
def eliminar_item_cotizacion(
    cotizacion_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    it = db.query(ItemCotizacion).filter(
        ItemCotizacion.id == item_id, ItemCotizacion.cotizacion_id == cotizacion_id
    ).first()
    if not it:
        raise HTTPException(status_code=404, detail="Ítem no encontrado")
    db.delete(it)
    db.commit()
    return {"ok": True}


# ── Comparativa y decisión ─────────────────────────────────────────────────────

@router.get("/listados/{listado_id}/comparativa", response_model=ComparativaOut)
def comparativa(
    listado_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Comparativa sin IVA entre todas las cotizaciones del listado (sección
    4.12): la decisión se toma por total del paquete, nunca ítem a ítem.
    Dispersiones > 10% respecto del promedio quedan marcadas con alerta.
    """
    l = _get_listado(db, listado_id)
    totales = [(c, _total_sin_iva_cotizacion(c)) for c in l.cotizaciones if c.items]

    if not totales:
        return {"promedio_sin_iva": Decimal("0"), "filas": []}

    promedio = sum((t for _, t in totales), Decimal("0")) / len(totales)

    filas = []
    for c, total in totales:
        if promedio > 0:
            pct = (total - promedio) / promedio * Decimal("100")
        else:
            pct = Decimal("0")
        filas.append({
            "cotizacion_id": c.id, "proveedor": c.proveedor, "tipo_factura": c.tipo_factura,
            "fecha": c.fecha, "estado": c.estado, "ganadora": c.ganadora,
            "total_sin_iva": total, "pct_dispersion": pct,
            "alerta": abs(pct) > UMBRAL_DISPERSION,
        })
    filas.sort(key=lambda f: f["total_sin_iva"])

    return {"promedio_sin_iva": promedio, "filas": filas}


@router.post("/listados/{listado_id}/elegir-ganadora", response_model=CotizacionOut)
def elegir_ganadora(
    listado_id: int,
    datos: ElegirGanadora,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    l = _get_listado(db, listado_id)
    elegida = None
    for c in l.cotizaciones:
        if c.id == datos.cotizacion_id:
            c.ganadora = True
            elegida = c
        else:
            c.ganadora = False
    if not elegida:
        raise HTTPException(status_code=404, detail="Cotización no encontrada en este listado")
    db.commit()
    db.refresh(elegida)
    return _cotizacion_out(elegida)
