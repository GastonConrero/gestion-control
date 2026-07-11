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


# ── Ítems (cómputo) ──────────────────────────────────────────────────────────

class ItemBase(BaseModel):
    orden                   : Optional[int] = 0
    designacion             : str
    unidad                  : Optional[str] = None
    cantidad                : Decimal = Decimal("0")
    precio_unitario         : Decimal = Decimal("0")  # cuenta cliente
    precio_unitario_albanil : Decimal = Decimal("0")  # cuenta albañil


class ItemCreate(ItemBase):
    pass


class ItemUpdate(BaseModel):
    orden                   : Optional[int] = None
    designacion             : Optional[str] = None
    unidad                  : Optional[str] = None
    cantidad                : Optional[Decimal] = None
    precio_unitario         : Optional[Decimal] = None
    precio_unitario_albanil : Optional[Decimal] = None


class ItemOut(ItemBase):
    id            : int
    obra_id       : int
    total         : Decimal  # cantidad * precio_unitario (cliente)
    total_albanil : Decimal  # cantidad * precio_unitario_albanil

    model_config = {"from_attributes": True}


# ── Certificado de avance ────────────────────────────────────────────────────

class ItemPct(BaseModel):
    item_id        : int
    pct_acum_nuevo : Decimal


class CertificadoCreate(BaseModel):
    periodo           : str
    fecha_certificado : Optional[date] = None
    items             : List[ItemPct]


class CertificadoItemOut(BaseModel):
    id                          : int
    item_id                     : int
    designacion                 : Optional[str] = None
    unidad                      : Optional[str] = None
    pct_acum_anterior           : Decimal
    pct_acum_nuevo              : Decimal
    pct_mes                     : Decimal
    # Cuenta cliente
    total_item_snapshot         : Decimal
    monto_mes                   : Decimal
    monto_acum                  : Decimal
    saldo                       : Decimal
    # Cuenta albañil
    total_item_snapshot_albanil : Decimal
    monto_mes_albanil           : Decimal
    monto_acum_albanil          : Decimal
    saldo_albanil                : Decimal

    model_config = {"from_attributes": True}


class CertificadoOut(BaseModel):
    id                     : int
    obra_id                : int
    numero                 : int
    periodo                : str
    fecha_certificado      : Optional[date] = None
    created_at             : Optional[datetime] = None
    ejecucion_mes          : Optional[Decimal] = None
    ejecucion_acum         : Optional[Decimal] = None
    ejecucion_mes_albanil  : Optional[Decimal] = None
    ejecucion_acum_albanil : Optional[Decimal] = None
    items                  : List[CertificadoItemOut] = []

    model_config = {"from_attributes": True}


class ResumenCertificados(BaseModel):
    presupuesto_base             : Decimal
    ajuste_ipc_acumulado         : Decimal
    total_actualizado            : Decimal
    ejecucion_acumulada          : Decimal
    saldo_pendiente              : Decimal
    presupuesto_base_albanil     : Decimal
    ajuste_ipc_acumulado_albanil : Decimal
    total_actualizado_albanil    : Decimal
    ejecucion_acumulada_albanil  : Decimal
    saldo_pendiente_albanil      : Decimal


class PuntoCurva(BaseModel):
    periodo                 : str
    fecha                   : Optional[date] = None
    ejecutado_acum          : Decimal
    pagos_acum              : Decimal
    ejecutado_acum_albanil  : Decimal
    pagos_acum_albanil      : Decimal


class CurvaOut(BaseModel):
    puntos : List[PuntoCurva]
    alerta : bool          # True si en algún punto pagos_acum > ejecutado_acum (cliente)
    alerta_albanil : bool  # ídem para la cuenta albañil
