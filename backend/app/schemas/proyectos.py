from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from decimal import Decimal
from app.models.proyecto import EstadoProyecto, PlantillaHonorario


# ── Honorario ─────────────────────────────────────────────────────────────────

class HonorarioBase(BaseModel):
    honorario_cobrado : Optional[Decimal] = None
    gastos            : Optional[Decimal] = Decimal("0")
    plantilla         : Optional[PlantillaHonorario] = PlantillaHonorario.solo_gaston
    pct_gaston        : Optional[Decimal] = Decimal("100")
    pct_valentina     : Optional[Decimal] = Decimal("0")
    pct_valentin      : Optional[Decimal] = Decimal("0")
    liquidado         : Optional[bool] = False
    notas_liquidacion : Optional[str] = None

class HonorarioCreate(HonorarioBase):
    pass

class HonorarioUpdate(HonorarioBase):
    pass

class HonorarioOut(HonorarioBase):
    id              : int
    proyecto_id     : int
    neto            : Optional[Decimal] = None
    monto_gaston    : Optional[Decimal] = None
    monto_valentina : Optional[Decimal] = None
    monto_valentin  : Optional[Decimal] = None
    created_at      : Optional[datetime] = None
    updated_at      : Optional[datetime] = None

    model_config = {"from_attributes": True}


# ── Proyecto ──────────────────────────────────────────────────────────────────

class ProyectoBase(BaseModel):
    nombre          : str
    descripcion     : Optional[str] = None
    tipo            : Optional[str] = None
    estado          : Optional[EstadoProyecto] = EstadoProyecto.en_curso
    honorario_total : Optional[Decimal] = None
    fecha_inicio    : Optional[datetime] = None
    fecha_fin       : Optional[datetime] = None
    notas           : Optional[str] = None

class ProyectoCreate(ProyectoBase):
    pass

class ProyectoUpdate(ProyectoBase):
    nombre: Optional[str] = None

class ProyectoOut(ProyectoBase):
    id         : int
    cliente_id : int
    created_at : Optional[datetime] = None
    updated_at : Optional[datetime] = None

    model_config = {"from_attributes": True}

class ProyectoDetalle(ProyectoOut):
    honorarios: List[HonorarioOut] = []

    model_config = {"from_attributes": True}
