from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from decimal import Decimal
from app.models.recibo import FormaCobro


class ReciboBase(BaseModel):
    concepto       : str
    monto          : Decimal
    forma_cobro    : FormaCobro
    referencia     : Optional[str] = None
    notas          : Optional[str] = None
    proyecto_id    : Optional[int] = None
    presupuesto_id : Optional[int] = None


class ReciboCreate(ReciboBase):
    cliente_id: int


class ReciboOut(ReciboBase):
    id                 : int
    numero             : str
    cliente_id         : int
    fecha_emision      : Optional[datetime] = None
    created_at         : Optional[datetime] = None
    cliente_apellido   : Optional[str] = None
    cliente_nombre     : Optional[str] = None
    proyecto_nombre    : Optional[str] = None
    presupuesto_numero : Optional[str] = None

    model_config = {"from_attributes": True}
