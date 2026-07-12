from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal


# ── Materiales ────────────────────────────────────────────────────────────────

class PrecioMaterialCreate(BaseModel):
    precio_sin_iva  : Decimal
    tipo_cambio_bna : Optional[Decimal] = None
    fecha           : Optional[date] = None
    proveedor       : Optional[str] = None
    referencia_origen: Optional[str] = None


class PrecioMaterialOut(BaseModel):
    id                : int
    material_id       : int
    precio_sin_iva    : Decimal
    tipo_cambio_bna   : Optional[Decimal] = None
    equivalente_usd   : Optional[Decimal] = None
    fecha             : date
    proveedor         : Optional[str] = None
    referencia_origen : Optional[str] = None
    created_at        : Optional[datetime] = None

    model_config = {"from_attributes": True}


class MaterialCreate(BaseModel):
    nombre    : str
    unidad    : Optional[str] = None
    categoria : Optional[str] = None
    # precio inicial (opcional al crear)
    precio_sin_iva    : Optional[Decimal] = None
    tipo_cambio_bna   : Optional[Decimal] = None
    fecha             : Optional[date] = None
    proveedor         : Optional[str] = None
    referencia_origen : Optional[str] = None


class MaterialUpdate(BaseModel):
    nombre    : Optional[str] = None
    unidad    : Optional[str] = None
    categoria : Optional[str] = None


class MaterialOut(BaseModel):
    id                  : int
    nombre              : str
    unidad              : Optional[str] = None
    categoria           : Optional[str] = None
    created_at          : Optional[datetime] = None
    precio_actual       : Optional[PrecioMaterialOut] = None
    desactualizado      : bool = False
    dias_sin_actualizar : Optional[int] = None

    model_config = {"from_attributes": True}


class MaterialDetalle(MaterialOut):
    historial : List[PrecioMaterialOut] = []


# ── Mano de obra — albañilería (por ítem) ──────────────────────────────────────

class PrecioManoObraItemCreate(BaseModel):
    precio : Decimal
    fecha  : Optional[date] = None
    notas  : Optional[str] = None


class PrecioManoObraItemOut(BaseModel):
    id         : int
    item_id    : int
    precio     : Decimal
    fecha      : date
    notas      : Optional[str] = None
    created_at : Optional[datetime] = None

    model_config = {"from_attributes": True}


class ManoObraItemCreate(BaseModel):
    designacion : str
    unidad      : Optional[str] = None
    precio      : Optional[Decimal] = None
    fecha       : Optional[date] = None
    notas       : Optional[str] = None


class ManoObraItemUpdate(BaseModel):
    designacion : Optional[str] = None
    unidad      : Optional[str] = None


class ManoObraItemOut(BaseModel):
    id                  : int
    designacion         : str
    unidad              : Optional[str] = None
    created_at          : Optional[datetime] = None
    precio_actual       : Optional[PrecioManoObraItemOut] = None
    desactualizado      : bool = False
    dias_sin_actualizar : Optional[int] = None

    model_config = {"from_attributes": True}


class ManoObraItemDetalle(ManoObraItemOut):
    historial : List[PrecioManoObraItemOut] = []


# ── Mano de obra — instalaciones (por rubro global) ────────────────────────────

class ReferenciaInstalacionCreate(BaseModel):
    monto : Decimal
    fecha : Optional[date] = None
    notas : Optional[str] = None


class ReferenciaInstalacionOut(BaseModel):
    id             : int
    instalacion_id : int
    monto          : Decimal
    fecha          : date
    notas          : Optional[str] = None
    created_at     : Optional[datetime] = None

    model_config = {"from_attributes": True}


class ManoObraInstalacionCreate(BaseModel):
    rubro : str
    monto : Optional[Decimal] = None
    fecha : Optional[date] = None
    notas : Optional[str] = None


class ManoObraInstalacionOut(BaseModel):
    id                  : int
    rubro               : str
    created_at          : Optional[datetime] = None
    referencia_actual   : Optional[ReferenciaInstalacionOut] = None
    desactualizado      : bool = False
    dias_sin_actualizar : Optional[int] = None

    model_config = {"from_attributes": True}


class ManoObraInstalacionDetalle(ManoObraInstalacionOut):
    historial : List[ReferenciaInstalacionOut] = []
