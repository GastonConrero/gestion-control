from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class SeguimientoUpsert(BaseModel):
    periodo       : str
    semana_numero : int  # 1 a 4
    descripcion   : Optional[str] = None
    foto_url_1    : Optional[str] = None
    foto_url_2    : Optional[str] = None


class SeguimientoOut(BaseModel):
    id             : int
    obra_id        : int
    periodo        : str
    semana_numero  : int
    descripcion    : Optional[str] = None
    foto_url_1     : Optional[str] = None
    foto_url_2     : Optional[str] = None
    created_at     : Optional[datetime] = None
    updated_at     : Optional[datetime] = None

    model_config = {"from_attributes": True}


class SintesisUpsert(BaseModel):
    periodo : str
    texto   : Optional[str] = None


class SintesisOut(BaseModel):
    id         : int
    obra_id    : int
    periodo    : str
    texto      : Optional[str] = None
    created_at : Optional[datetime] = None
    updated_at : Optional[datetime] = None

    model_config = {"from_attributes": True}


class InformeGeneradoOut(BaseModel):
    id             : int
    obra_id        : int
    numero         : str
    periodo        : str
    usuario_nombre : Optional[str] = None
    created_at     : Optional[datetime] = None

    model_config = {"from_attributes": True}
