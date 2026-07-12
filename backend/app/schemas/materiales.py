from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal
from app.models.materiales import TipoFactura, EstadoCotizacion


# ── Listado de materiales ─────────────────────────────────────────────────────

class ItemListadoCreate(BaseModel):
    designacion     : str
    unidad          : Optional[str] = None
    cantidad_pedida : Decimal = Decimal("0")


class ItemListadoUpdate(BaseModel):
    designacion     : Optional[str] = None
    unidad          : Optional[str] = None
    cantidad_pedida : Optional[Decimal] = None


class EntregaCreate(BaseModel):
    cantidad_entregada : Decimal  # cantidad total entregada acumulada (no incremental)


class ItemListadoOut(BaseModel):
    id                  : int
    listado_id          : int
    designacion         : str
    unidad              : Optional[str] = None
    cantidad_pedida     : Decimal
    cantidad_entregada  : Decimal
    saldo               : Decimal  # pedida - entregada

    model_config = {"from_attributes": True}


class ListadoCreate(BaseModel):
    nombre  : str
    obra_id : Optional[int] = None
    notas   : Optional[str] = None


class ListadoUpdate(BaseModel):
    nombre  : Optional[str] = None
    obra_id : Optional[int] = None
    notas   : Optional[str] = None


class ListadoOut(BaseModel):
    id             : int
    nombre         : str
    obra_id        : Optional[int] = None
    obra_nombre    : Optional[str] = None
    notas          : Optional[str] = None
    created_at     : Optional[datetime] = None
    cant_items     : int = 0
    cant_cotizaciones: int = 0

    model_config = {"from_attributes": True}


class ListadoDetalle(ListadoOut):
    items : List[ItemListadoOut] = []


# ── Cotizaciones de proveedores ───────────────────────────────────────────────

class ItemCotizacionCreate(BaseModel):
    designacion              : str
    unidad                   : Optional[str] = None
    cantidad                 : Decimal = Decimal("0")
    precio_unitario_factura  : Decimal = Decimal("0")
    item_listado_id          : Optional[int] = None
    confianza_baja           : bool = False


class ItemCotizacionUpdate(BaseModel):
    designacion              : Optional[str] = None
    unidad                   : Optional[str] = None
    cantidad                 : Optional[Decimal] = None
    precio_unitario_factura  : Optional[Decimal] = None
    confianza_baja           : Optional[bool] = None


class ItemCotizacionOut(BaseModel):
    id                       : int
    cotizacion_id            : int
    item_listado_id          : Optional[int] = None
    designacion              : str
    unidad                   : Optional[str] = None
    cantidad                 : Decimal
    precio_unitario_factura  : Decimal
    precio_unitario_sin_iva  : Decimal
    subtotal_sin_iva         : Decimal
    confianza_baja           : bool

    model_config = {"from_attributes": True}


class CotizacionCreate(BaseModel):
    proveedor    : str
    tipo_factura : TipoFactura = TipoFactura.A
    fecha        : Optional[date] = None
    archivo_url  : Optional[str] = None
    notas        : Optional[str] = None


class CotizacionUpdate(BaseModel):
    proveedor    : Optional[str] = None
    tipo_factura : Optional[TipoFactura] = None
    fecha        : Optional[date] = None
    archivo_url  : Optional[str] = None
    notas        : Optional[str] = None


class CotizacionOut(BaseModel):
    id             : int
    listado_id     : int
    proveedor      : str
    tipo_factura   : TipoFactura
    fecha          : Optional[date] = None
    archivo_url    : Optional[str] = None
    estado         : EstadoCotizacion
    ganadora       : bool
    notas          : Optional[str] = None
    created_at     : Optional[datetime] = None
    total_sin_iva  : Decimal = Decimal("0")

    model_config = {"from_attributes": True}


class CotizacionDetalle(CotizacionOut):
    items : List[ItemCotizacionOut] = []


class ElegirGanadora(BaseModel):
    cotizacion_id : int


class FilaComparativa(BaseModel):
    cotizacion_id : int
    proveedor     : str
    tipo_factura  : TipoFactura
    fecha         : Optional[date] = None
    estado        : EstadoCotizacion
    ganadora      : bool
    total_sin_iva : Decimal
    pct_dispersion: Decimal  # % de diferencia vs el promedio
    alerta        : bool     # True si |pct_dispersion| > 10%


class ComparativaOut(BaseModel):
    promedio_sin_iva : Decimal
    filas            : List[FilaComparativa]
