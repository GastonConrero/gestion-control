from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal


class ItemAnalisisCreate(BaseModel):
    designacion             : str
    unidad                  : Optional[str] = None
    cantidad                : Decimal = Decimal("0")
    pct_adicional           : Decimal = Decimal("0")
    material_id             : Optional[int] = None
    categoria               : Optional[str] = None
    precio_unitario_manual  : Optional[Decimal] = None


class ItemAnalisisUpdate(BaseModel):
    designacion             : Optional[str] = None
    unidad                  : Optional[str] = None
    cantidad                : Optional[Decimal] = None
    pct_adicional           : Optional[Decimal] = None
    material_id             : Optional[int] = None
    categoria               : Optional[str] = None
    precio_unitario_manual  : Optional[Decimal] = None


class ItemAnalisisOut(BaseModel):
    id                      : int
    analisis_id             : int
    designacion             : str
    unidad                  : Optional[str] = None
    cantidad                : Decimal
    pct_adicional           : Decimal
    material_id             : Optional[int] = None
    material_nombre         : Optional[str] = None
    categoria               : Optional[str] = None
    precio_unitario_manual  : Optional[Decimal] = None
    # calculados
    precio_unitario_usado   : Optional[Decimal] = None
    fuente_precio           : str = "sin_precio"  # banco | manual | sin_precio
    subtotal_pesos          : Decimal = Decimal("0")
    subtotal_usd            : Optional[Decimal] = None
    desactualizado          : bool = False
    dias_sin_actualizar     : Optional[int] = None

    model_config = {"from_attributes": True}


class AnalisisCreate(BaseModel):
    nombre        : str
    obra_id       : Optional[int] = None
    fecha_calculo : Optional[date] = None


class AnalisisUpdate(BaseModel):
    nombre        : Optional[str] = None
    obra_id       : Optional[int] = None
    fecha_calculo : Optional[date] = None


class AnalisisOut(BaseModel):
    id            : int
    nombre        : str
    obra_id       : Optional[int] = None
    obra_nombre   : Optional[str] = None
    fecha_calculo : Optional[date] = None
    created_at    : Optional[datetime] = None
    cant_items    : int = 0

    model_config = {"from_attributes": True}


class RubroTotal(BaseModel):
    rubro         : str
    total_pesos   : Decimal
    total_usd     : Optional[Decimal] = None


class AnalisisDetalle(AnalisisOut):
    items                 : List[ItemAnalisisOut] = []
    total_pesos           : Decimal = Decimal("0")
    total_usd             : Optional[Decimal] = None
    items_sin_precio      : int = 0
    items_desactualizados : int = 0
    por_rubro             : List[RubroTotal] = []


class ImportarExcelResultado(BaseModel):
    items_creados  : int
    filas_omitidas : int
    avisos         : List[str] = []
