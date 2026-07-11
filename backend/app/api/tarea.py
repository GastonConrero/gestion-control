from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.tarea import Tarea
from app.schemas.tarea import TareaCreate, TareaUpdate, TareaOut

router = APIRouter(prefix="/api/tareas", tags=["tareas"])


def _puede_editar(tarea: Tarea, user: User):
    if tarea.usuario_id != user.id and user.rol != "gaston":
        raise HTTPException(status_code=403, detail="No podés editar tareas de otro integrante")


def _tarea_out(t: Tarea) -> dict:
    d = {c.name: getattr(t, c.name) for c in t.__table__.columns}
    d["usuario_nombre"] = t.usuario.nombre if t.usuario else None
    return d


@router.get("/", response_model=List[TareaOut])
def listar_tareas(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Visibles para todo el equipo (los tres se ven las tareas entre sí)."""
    tareas = (
        db.query(Tarea)
        .order_by(Tarea.completada, Tarea.created_at.desc())
        .all()
    )
    return [_tarea_out(t) for t in tareas]


@router.post("/", response_model=TareaOut)
def crear_tarea(
    datos: TareaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    t = Tarea(usuario_id=current_user.id, descripcion=datos.descripcion)
    db.add(t)
    db.commit()
    db.refresh(t)
    return _tarea_out(t)


@router.put("/{tarea_id}", response_model=TareaOut)
def actualizar_tarea(
    tarea_id: int,
    datos: TareaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    t = db.query(Tarea).filter(Tarea.id == tarea_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    _puede_editar(t, current_user)
    if datos.descripcion is not None:
        t.descripcion = datos.descripcion
    db.commit()
    db.refresh(t)
    return _tarea_out(t)


@router.post("/{tarea_id}/completar", response_model=TareaOut)
def completar_tarea(
    tarea_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    t = db.query(Tarea).filter(Tarea.id == tarea_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    _puede_editar(t, current_user)
    t.completada = True
    t.fecha_completada = datetime.now()
    db.commit()
    db.refresh(t)
    return _tarea_out(t)


@router.post("/{tarea_id}/reabrir", response_model=TareaOut)
def reabrir_tarea(
    tarea_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    t = db.query(Tarea).filter(Tarea.id == tarea_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    _puede_editar(t, current_user)
    t.completada = False
    t.fecha_completada = None
    db.commit()
    db.refresh(t)
    return _tarea_out(t)


@router.delete("/{tarea_id}")
def eliminar_tarea(
    tarea_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    t = db.query(Tarea).filter(Tarea.id == tarea_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    _puede_editar(t, current_user)
    db.delete(t)
    db.commit()
    return {"ok": True}
