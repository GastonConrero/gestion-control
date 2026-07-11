from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class TareaCreate(BaseModel):
    descripcion: str


class TareaUpdate(BaseModel):
    descripcion: Optional[str] = None


class TareaOut(BaseModel):
    id               : int
    usuario_id       : int
    usuario_nombre   : Optional[str] = None
    descripcion      : str
    completada       : bool
    created_at       : Optional[datetime] = None
    fecha_completada : Optional[datetime] = None

    model_config = {"from_attributes": True}
