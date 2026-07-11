from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from decimal import Decimal
from app.models.orden_pago import FormaPagoOP, EstadoOrdenPago


class OrdenPagoBase(BaseModel):
    destinatario   : str
    concepto       : str
    monto          : Decimal
    forma_pago     : FormaPagoOP
    referencia     : Optional[str] = None
    notas          : Optional[str] = None
    proyecto_id    : Optional[int] = None


class OrdenPagoCreate(OrdenPagoBase):
    pass


class OrdenPagoOut(OrdenPagoBase):
    id                 : int
    numero             : str
    estado             : EstadoOrdenPago
    fecha_emision      : Optional[datetime] = None
    fecha_pago         : Optional[datetime] = None
    created_at         : Optional[datetime] = None
    proyecto_nombre    : Optional[str] = None

    model_config = {"from_attributes": True}
