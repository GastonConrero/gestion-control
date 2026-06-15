from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from decimal import Decimal
from app.models.presupuesto import EstadoPresupuesto, FormaPago


class PresupuestoBase(BaseModel):
    tipo            : str
    descripcion     : Optional[str] = None
    honorario_total : Decimal
    forma_pago      : Optional[FormaPago] = FormaPago.a_convenir
    detalle_pago    : Optional[str] = None
    superficie      : Optional[Decimal] = None
    incluye         : Optional[str] = None
    no_incluye      : Optional[str] = None
    notas           : Optional[str] = None
    profesional_1   : Optional[str] = "Ing. Gastón Conrero"
    profesional_2   : Optional[str] = None


class PresupuestoCreate(PresupuestoBase):
    cliente_id: int


class PresupuestoUpdate(BaseModel):
    tipo            : Optional[str] = None
    descripcion     : Optional[str] = None
    honorario_total : Optional[Decimal] = None
    forma_pago      : Optional[FormaPago] = None
    detalle_pago    : Optional[str] = None
    superficie      : Optional[Decimal] = None
    incluye         : Optional[str] = None
    no_incluye      : Optional[str] = None
    notas           : Optional[str] = None
    profesional_1   : Optional[str] = None
    profesional_2   : Optional[str] = None


class PresupuestoOut(PresupuestoBase):
    id                 : int
    numero             : str
    cliente_id         : int
    estado             : EstadoPresupuesto
    fecha_emision      : Optional[datetime] = None
    fecha_envio        : Optional[datetime] = None
    fecha_confirmacion : Optional[datetime] = None
    created_at         : Optional[datetime] = None
    cliente_apellido   : Optional[str] = None
    cliente_nombre     : Optional[str] = None

    model_config = {"from_attributes": True}
