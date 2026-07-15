from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal
from app.models.obra import EstadoObra, TipoMovimiento


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


# ── Cronograma de pagos (cuenta corriente) ────────────────────────────────────

class MovimientoCreate(BaseModel):
    fecha          : date
    tipo           : TipoMovimiento
    monto_cliente  : Decimal = Decimal("0")
    monto_albanil  : Decimal = Decimal("0")
    concepto       : Optional[str] = None
    es_ajuste_ipc  : bool = False


class MovimientoUpdate(BaseModel):
    fecha          : Optional[date] = None
    tipo           : Optional[TipoMovimiento] = None
    monto_cliente  : Optional[Decimal] = None
    monto_albanil  : Optional[Decimal] = None
    concepto       : Optional[str] = None
    es_ajuste_ipc  : Optional[bool] = None


class MovimientoOut(BaseModel):
    id             : int
    obra_id        : int
    fecha          : date
    tipo           : TipoMovimiento
    monto_cliente  : Decimal
    monto_albanil  : Decimal
    concepto       : Optional[str] = None
    es_ajuste_ipc  : bool
    created_at     : Optional[datetime] = None
    # saldo acumulado hasta este movimiento, inclusive (informativo)
    saldo_cliente_acumulado : Optional[Decimal] = None
    saldo_albanil_acumulado : Optional[Decimal] = None

    model_config = {"from_attributes": True}


class AplicarAjusteIPC(BaseModel):
    fecha    : date
    ipc_pct  : Decimal
    cuenta   : str = "ambas"  # "cliente" | "albanil" | "ambas"
    fuente   : Optional[str] = "estimado"  # "estimado" | "indec"


class ResumenCronograma(BaseModel):
    total_cargos_cliente : Decimal
    total_pagos_cliente  : Decimal
    saldo_cliente         : Decimal
    total_cargos_albanil : Decimal
    total_pagos_albanil  : Decimal
    saldo_albanil         : Decimal


class ImportarCronogramaResultado(BaseModel):
    movimientos_creados : int
    filas_omitidas      : int
    avisos              : List[str] = []



class VincularPresupuesto(BaseModel):
    presupuesto_id: int


# ── Ítems (cómputo) ──────────────────────────────────────────────────────────

class ItemBase(BaseModel):
    orden                   : Optional[str] = "0"
    designacion             : str
    unidad                  : Optional[str] = None
    cantidad                : Decimal = Decimal("0")
    precio_unitario         : Decimal = Decimal("0")  # cuenta cliente
    precio_unitario_albanil : Decimal = Decimal("0")  # cuenta albañil


class ItemCreate(ItemBase):
    pass


class ItemUpdate(BaseModel):
    orden                   : Optional[str] = None
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
