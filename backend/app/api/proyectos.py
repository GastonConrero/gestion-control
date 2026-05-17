from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from decimal import Decimal

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.proyecto import Proyecto, HonorarioDistribucion, PlantillaHonorario
from app.schemas.proyectos import (
    ProyectoCreate, ProyectoUpdate, ProyectoOut, ProyectoDetalle,
    HonorarioCreate, HonorarioUpdate, HonorarioOut,
)

router = APIRouter(prefix="/api/clientes/{cliente_id}/proyectos", tags=["proyectos"])


def _solo_gaston(user: User):
    if user.rol != "gaston":
        raise HTTPException(status_code=403, detail="Solo Gastón puede acceder a esta sección")


def _calcular_distribucion(h: HonorarioDistribucion) -> None:
    cobrado = h.honorario_cobrado or Decimal("0")
    gastos  = h.gastos or Decimal("0")
    neto    = cobrado - gastos
    h.neto  = neto
    h.monto_gaston    = (neto * (h.pct_gaston    or Decimal("0")) / 100).quantize(Decimal("0.01"))
    h.monto_valentina = (neto * (h.pct_valentina or Decimal("0")) / 100).quantize(Decimal("0.01"))
    h.monto_valentin  = (neto * (h.pct_valentin  or Decimal("0")) / 100).quantize(Decimal("0.01"))


PLANTILLAS = {
    PlantillaHonorario.solo_gaston      : (Decimal("100"),   Decimal("0"),     Decimal("0")),
    PlantillaHonorario.gaston_valentina : (Decimal("50"),    Decimal("50"),    Decimal("0")),
    PlantillaHonorario.gaston_valentin  : (Decimal("50"),    Decimal("0"),     Decimal("50")),
    PlantillaHonorario.los_tres         : (Decimal("33.33"), Decimal("33.33"), Decimal("33.34")),
}


# ── PROYECTOS ──────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[ProyectoOut])
def listar_proyectos(
    cliente_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Proyecto)
        .filter(Proyecto.cliente_id == cliente_id)
        .order_by(Proyecto.created_at.desc())
        .all()
    )


@router.post("/", response_model=ProyectoOut)
def crear_proyecto(
    cliente_id: int,
    datos: ProyectoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)
    proyecto = Proyecto(cliente_id=cliente_id, **datos.model_dump())
    db.add(proyecto)
    db.commit()
    db.refresh(proyecto)
    return proyecto


@router.get("/{proyecto_id}", response_model=ProyectoDetalle)
def obtener_proyecto(
    cliente_id: int,
    proyecto_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    proyecto = (
        db.query(Proyecto)
        .filter(Proyecto.id == proyecto_id, Proyecto.cliente_id == cliente_id)
        .first()
    )
    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    if current_user.rol != "gaston":
        proyecto.honorarios = []
    return proyecto


@router.put("/{proyecto_id}", response_model=ProyectoOut)
def actualizar_proyecto(
    cliente_id: int,
    proyecto_id: int,
    datos: ProyectoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)
    proyecto = (
        db.query(Proyecto)
        .filter(Proyecto.id == proyecto_id, Proyecto.cliente_id == cliente_id)
        .first()
    )
    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    for campo, valor in datos.model_dump(exclude_unset=True).items():
        setattr(proyecto, campo, valor)
    db.commit()
    db.refresh(proyecto)
    return proyecto


@router.delete("/{proyecto_id}")
def eliminar_proyecto(
    cliente_id: int,
    proyecto_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)
    proyecto = (
        db.query(Proyecto)
        .filter(Proyecto.id == proyecto_id, Proyecto.cliente_id == cliente_id)
        .first()
    )
    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    db.delete(proyecto)
    db.commit()
    return {"ok": True}


# ── HONORARIOS (solo Gastón) ───────────────────────────────────────────────────

@router.get("/{proyecto_id}/honorarios", response_model=List[HonorarioOut])
def listar_honorarios(
    cliente_id: int,
    proyecto_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)
    return (
        db.query(HonorarioDistribucion)
        .filter(HonorarioDistribucion.proyecto_id == proyecto_id)
        .all()
    )


@router.post("/{proyecto_id}/honorarios", response_model=HonorarioOut)
def crear_honorario(
    cliente_id: int,
    proyecto_id: int,
    datos: HonorarioCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)
    dump = datos.model_dump()
    plantilla = dump.get("plantilla", PlantillaHonorario.solo_gaston)
    if plantilla in PLANTILLAS:
        g, va, vn = PLANTILLAS[plantilla]
        dump["pct_gaston"]    = g
        dump["pct_valentina"] = va
        dump["pct_valentin"]  = vn
    h = HonorarioDistribucion(proyecto_id=proyecto_id, **dump)
    _calcular_distribucion(h)
    db.add(h)
    db.commit()
    db.refresh(h)
    return h


@router.put("/{proyecto_id}/honorarios/{honorario_id}", response_model=HonorarioOut)
def actualizar_honorario(
    cliente_id: int,
    proyecto_id: int,
    honorario_id: int,
    datos: HonorarioUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)
    h = (
        db.query(HonorarioDistribucion)
        .filter(
            HonorarioDistribucion.id == honorario_id,
            HonorarioDistribucion.proyecto_id == proyecto_id,
        )
        .first()
    )
    if not h:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    dump = datos.model_dump(exclude_unset=True)
    plantilla = dump.get("plantilla", h.plantilla)
    if plantilla in PLANTILLAS and plantilla != PlantillaHonorario.custom:
        g, va, vn = PLANTILLAS[plantilla]
        dump["pct_gaston"]    = g
        dump["pct_valentina"] = va
        dump["pct_valentin"]  = vn
    for campo, valor in dump.items():
        setattr(h, campo, valor)
    _calcular_distribucion(h)
    db.commit()
    db.refresh(h)
    return h
