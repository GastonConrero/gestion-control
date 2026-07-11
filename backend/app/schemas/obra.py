from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal
from app.models.obra import EstadoObra, EstadoCuota


# ── Obra ─────────────────────────────────────────────────────────────────────

class ObraBase(BaseModel):
    nombre               : str
    tipo_obra            : Optional[str] = None
    superficie           : Optional[Decimal] = None
    estado               : Optional[EstadoObra] = EstadoObra.en_curso
    fecha_inicio         : Optional[date] = None
    ipc_estimado_mensual : Optional[Decimal] = Decimal("1.5")
    notas                : Optional[str] = None
    presupuesto_id       : Optional[int] = None


class ObraCreate(ObraBase):
    pass


class ObraUpdate(BaseModel):
    nombre               : Optional[str] = None
    tipo_obra            : Optional[str] = None
    superficie           : Optional[Decimal] = None
    estado               : Optional[EstadoObra] = None
    fecha_inicio         : Optional[date] = None
    ipc_estimado_mensual : Optional[Decimal] = None
    notas                : Optional[str] = None
    presupuesto_id       : Optional[int] = None


class ObraOut(ObraBase):
    id                 : int
    cliente_id         : int
    created_at         : Optional[datetime] = None
    updated_at         : Optional[datetime] = None
    presupuesto_numero : Optional[str] = None
    # Resumen rápido (solo se completa para Gastón)
    total_cliente      : Optional[Decimal] = None
    total_albanil      : Optional[Decimal] = None
    pagado_cliente     : Optional[Decimal] = None
    pagado_albanil     : Optional[Decimal] = None

    model_config = {"from_attributes": True}


# ── Cronograma / Cuotas ──────────────────────────────────────────────────────

class CuotaBase(BaseModel):
    numero            : int
    descripcion       : Optional[str] = None
    fecha_prevista    : Optional[date] = None
    monto_cliente     : Decimal = Decimal("0")
    monto_albanil     : Decimal = Decimal("0")
    notas             : Optional[str] = None


class CuotaCreate(CuotaBase):
    pass


class CuotaUpdate(BaseModel):
    numero            : Optional[int] = None
    descripcion       : Optional[str] = None
    fecha_prevista    : Optional[date] = None
    monto_cliente     : Optional[Decimal] = None
    monto_albanil     : Optional[Decimal] = None
    notas             : Optional[str] = None


class CuotaOut(CuotaBase):
    id                    : int
    obra_id               : int
    estado                : EstadoCuota
    ajuste_ipc_cliente    : Decimal
    ajuste_ipc_albanil    : Decimal
    fecha_pago            : Optional[date] = None
    monto_pagado_cliente  : Optional[Decimal] = None
    monto_pagado_albanil  : Optional[Decimal] = None
    saldo_cliente         : Optional[Decimal] = None  # monto_cliente + ajuste_ipc_cliente
    saldo_albanil         : Optional[Decimal] = None
    created_at            : Optional[datetime] = None

    model_config = {"from_attributes": True}


class PagarCuota(BaseModel):
    monto_pagado_cliente : Optional[Decimal] = None
    monto_pagado_albanil : Optional[Decimal] = None
    fecha_pago           : Optional[date] = None


class AjustarIPC(BaseModel):
    ipc_pct  : Decimal
    fuente   : Optional[str] = "estimado"  # "estimado" | "indec"


class AjusteIPCOut(BaseModel):
    id                     : int
    cuota_id               : int
    ipc_pct                : Decimal
    fuente                 : Optional[str] = None
    ajuste_cliente         : Decimal
    ajuste_albanil         : Decimal
    saldo_cliente_previo   : Optional[Decimal] = None
    saldo_albanil_previo   : Optional[Decimal] = None
    created_at             : Optional[datetime] = None

    model_config = {"from_attributes": True}


class VincularPresupuesto(BaseModel):
    presupuesto_id: int
