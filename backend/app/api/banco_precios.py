from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime
from decimal import Decimal

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.banco_precios import (
    Material, PrecioMaterial,
    ManoObraItem, PrecioManoObraItem,
    ManoObraInstalacion, ReferenciaManoObraInstalacion,
)
from app.schemas.banco_precios import (
    MaterialCreate, MaterialUpdate, MaterialOut, MaterialDetalle,
    PrecioMaterialCreate, PrecioMaterialOut,
    ManoObraItemCreate, ManoObraItemUpdate, ManoObraItemOut, ManoObraItemDetalle,
    PrecioManoObraItemCreate, PrecioManoObraItemOut,
    ManoObraInstalacionCreate, ManoObraInstalacionOut, ManoObraInstalacionDetalle,
    ReferenciaInstalacionCreate, ReferenciaInstalacionOut,
)

router = APIRouter(prefix="/api/banco-precios", tags=["banco_precios"])

DIAS_DESACTUALIZADO = 30


def _solo_gaston(user: User):
    if user.rol != "gaston":
        raise HTTPException(status_code=403, detail="Solo Gastón puede eliminar del banco de precios")


def _dias_desde(fecha_ref: date) -> int:
    return (date.today() - fecha_ref).days


# ── Materiales ────────────────────────────────────────────────────────────────

def _material_out(m: Material, detalle: bool = False):
    ultimo = m.precios[0] if m.precios else None
    dias = _dias_desde(ultimo.fecha) if ultimo else None
    d = {
        "id": m.id, "nombre": m.nombre, "unidad": m.unidad, "categoria": m.categoria,
        "created_at": m.created_at,
        "precio_actual": ultimo,
        "desactualizado": (dias is not None and dias > DIAS_DESACTUALIZADO),
        "dias_sin_actualizar": dias,
    }
    if detalle:
        d["historial"] = m.precios
    return d


@router.get("/materiales", response_model=List[MaterialOut])
def listar_materiales(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    materiales = db.query(Material).order_by(Material.nombre).all()
    return [_material_out(m) for m in materiales]


@router.post("/materiales", response_model=MaterialOut)
def crear_material(
    datos: MaterialCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    m = Material(nombre=datos.nombre, unidad=datos.unidad, categoria=datos.categoria)
    db.add(m)
    db.flush()

    if datos.precio_sin_iva is not None:
        equiv_usd = None
        if datos.tipo_cambio_bna:
            equiv_usd = datos.precio_sin_iva / datos.tipo_cambio_bna
        db.add(PrecioMaterial(
            material_id=m.id, precio_sin_iva=datos.precio_sin_iva,
            tipo_cambio_bna=datos.tipo_cambio_bna, equivalente_usd=equiv_usd,
            fecha=datos.fecha or date.today(), proveedor=datos.proveedor,
            referencia_origen=datos.referencia_origen,
        ))

    db.commit()
    db.refresh(m)
    return _material_out(m)


@router.get("/materiales/{material_id}", response_model=MaterialDetalle)
def obtener_material(
    material_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    m = db.query(Material).filter(Material.id == material_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Material no encontrado")
    return _material_out(m, detalle=True)


@router.put("/materiales/{material_id}", response_model=MaterialOut)
def actualizar_material(
    material_id: int,
    datos: MaterialUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    m = db.query(Material).filter(Material.id == material_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Material no encontrado")
    for k, v in datos.model_dump(exclude_unset=True).items():
        setattr(m, k, v)
    db.commit()
    db.refresh(m)
    return _material_out(m)


@router.delete("/materiales/{material_id}")
def eliminar_material(
    material_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)
    m = db.query(Material).filter(Material.id == material_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Material no encontrado")
    db.delete(m)
    db.commit()
    return {"ok": True}


@router.post("/materiales/{material_id}/precio", response_model=MaterialOut)
def cargar_precio_material(
    material_id: int,
    datos: PrecioMaterialCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    m = db.query(Material).filter(Material.id == material_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Material no encontrado")

    equiv_usd = None
    if datos.tipo_cambio_bna:
        equiv_usd = datos.precio_sin_iva / datos.tipo_cambio_bna

    db.add(PrecioMaterial(
        material_id=m.id, precio_sin_iva=datos.precio_sin_iva,
        tipo_cambio_bna=datos.tipo_cambio_bna, equivalente_usd=equiv_usd,
        fecha=datos.fecha or date.today(), proveedor=datos.proveedor,
        referencia_origen=datos.referencia_origen,
    ))
    db.commit()
    db.refresh(m)
    return _material_out(m)


@router.delete("/materiales/{material_id}/precio/{precio_id}")
def eliminar_precio_material(
    material_id: int,
    precio_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)
    p = db.query(PrecioMaterial).filter(
        PrecioMaterial.id == precio_id, PrecioMaterial.material_id == material_id
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Precio no encontrado")
    db.delete(p)
    db.commit()
    return {"ok": True}


# ── Mano de obra — albañilería (por ítem) ──────────────────────────────────────

def _item_out(i: ManoObraItem, detalle: bool = False):
    ultimo = i.precios[0] if i.precios else None
    dias = _dias_desde(ultimo.fecha) if ultimo else None
    d = {
        "id": i.id, "designacion": i.designacion, "unidad": i.unidad,
        "created_at": i.created_at,
        "precio_actual": ultimo,
        "desactualizado": (dias is not None and dias > DIAS_DESACTUALIZADO),
        "dias_sin_actualizar": dias,
    }
    if detalle:
        d["historial"] = i.precios
    return d


@router.get("/mano-obra-item", response_model=List[ManoObraItemOut])
def listar_mano_obra_item(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items = db.query(ManoObraItem).order_by(ManoObraItem.designacion).all()
    return [_item_out(i) for i in items]


@router.post("/mano-obra-item", response_model=ManoObraItemOut)
def crear_mano_obra_item(
    datos: ManoObraItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    i = ManoObraItem(designacion=datos.designacion, unidad=datos.unidad)
    db.add(i)
    db.flush()
    if datos.precio is not None:
        db.add(PrecioManoObraItem(
            item_id=i.id, precio=datos.precio, fecha=datos.fecha or date.today(), notas=datos.notas,
        ))
    db.commit()
    db.refresh(i)
    return _item_out(i)


@router.get("/mano-obra-item/{item_id}", response_model=ManoObraItemDetalle)
def obtener_mano_obra_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    i = db.query(ManoObraItem).filter(ManoObraItem.id == item_id).first()
    if not i:
        raise HTTPException(status_code=404, detail="Ítem no encontrado")
    return _item_out(i, detalle=True)


@router.put("/mano-obra-item/{item_id}", response_model=ManoObraItemOut)
def actualizar_mano_obra_item(
    item_id: int,
    datos: ManoObraItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    i = db.query(ManoObraItem).filter(ManoObraItem.id == item_id).first()
    if not i:
        raise HTTPException(status_code=404, detail="Ítem no encontrado")
    for k, v in datos.model_dump(exclude_unset=True).items():
        setattr(i, k, v)
    db.commit()
    db.refresh(i)
    return _item_out(i)


@router.delete("/mano-obra-item/{item_id}")
def eliminar_mano_obra_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)
    i = db.query(ManoObraItem).filter(ManoObraItem.id == item_id).first()
    if not i:
        raise HTTPException(status_code=404, detail="Ítem no encontrado")
    db.delete(i)
    db.commit()
    return {"ok": True}


@router.post("/mano-obra-item/{item_id}/precio", response_model=ManoObraItemOut)
def cargar_precio_mano_obra_item(
    item_id: int,
    datos: PrecioManoObraItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    i = db.query(ManoObraItem).filter(ManoObraItem.id == item_id).first()
    if not i:
        raise HTTPException(status_code=404, detail="Ítem no encontrado")
    db.add(PrecioManoObraItem(
        item_id=i.id, precio=datos.precio, fecha=datos.fecha or date.today(), notas=datos.notas,
    ))
    db.commit()
    db.refresh(i)
    return _item_out(i)


# ── Mano de obra — instalaciones (por rubro global) ────────────────────────────

def _instalacion_out(inst: ManoObraInstalacion, detalle: bool = False):
    ultimo = inst.referencias[0] if inst.referencias else None
    dias = _dias_desde(ultimo.fecha) if ultimo else None
    d = {
        "id": inst.id, "rubro": inst.rubro, "created_at": inst.created_at,
        "referencia_actual": ultimo,
        "desactualizado": (dias is not None and dias > DIAS_DESACTUALIZADO),
        "dias_sin_actualizar": dias,
    }
    if detalle:
        d["historial"] = inst.referencias
    return d


@router.get("/mano-obra-instalacion", response_model=List[ManoObraInstalacionOut])
def listar_mano_obra_instalacion(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    insts = db.query(ManoObraInstalacion).order_by(ManoObraInstalacion.rubro).all()
    return [_instalacion_out(i) for i in insts]


@router.post("/mano-obra-instalacion", response_model=ManoObraInstalacionOut)
def crear_mano_obra_instalacion(
    datos: ManoObraInstalacionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inst = ManoObraInstalacion(rubro=datos.rubro)
    db.add(inst)
    db.flush()
    if datos.monto is not None:
        db.add(ReferenciaManoObraInstalacion(
            instalacion_id=inst.id, monto=datos.monto, fecha=datos.fecha or date.today(), notas=datos.notas,
        ))
    db.commit()
    db.refresh(inst)
    return _instalacion_out(inst)


@router.get("/mano-obra-instalacion/{instalacion_id}", response_model=ManoObraInstalacionDetalle)
def obtener_mano_obra_instalacion(
    instalacion_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inst = db.query(ManoObraInstalacion).filter(ManoObraInstalacion.id == instalacion_id).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Rubro no encontrado")
    return _instalacion_out(inst, detalle=True)


@router.delete("/mano-obra-instalacion/{instalacion_id}")
def eliminar_mano_obra_instalacion(
    instalacion_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)
    inst = db.query(ManoObraInstalacion).filter(ManoObraInstalacion.id == instalacion_id).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Rubro no encontrado")
    db.delete(inst)
    db.commit()
    return {"ok": True}


@router.post("/mano-obra-instalacion/{instalacion_id}/referencia", response_model=ManoObraInstalacionOut)
def cargar_referencia_instalacion(
    instalacion_id: int,
    datos: ReferenciaInstalacionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inst = db.query(ManoObraInstalacion).filter(ManoObraInstalacion.id == instalacion_id).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Rubro no encontrado")
    db.add(ReferenciaManoObraInstalacion(
        instalacion_id=inst.id, monto=datos.monto, fecha=datos.fecha or date.today(), notas=datos.notas,
    ))
    db.commit()
    db.refresh(inst)
    return _instalacion_out(inst)
