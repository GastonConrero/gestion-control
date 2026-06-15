from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime
import io

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.presupuesto import Presupuesto, EstadoPresupuesto
from app.models.cliente import Cliente
from app.schemas.presupuestos import PresupuestoCreate, PresupuestoUpdate, PresupuestoOut

router = APIRouter(prefix="/api/presupuestos", tags=["presupuestos"])


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
    return {"ok": True,
