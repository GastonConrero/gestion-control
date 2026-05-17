from sqlalchemy import (
    Column, Integer, String, Numeric, DateTime, Text,
    ForeignKey, Enum, Boolean
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum


class EstadoProyecto(str, enum.Enum):
    en_curso   = "en_curso"
    terminado  = "terminado"
    pausado    = "pausado"
    cancelado  = "cancelado"


class PlantillaHonorario(str, enum.Enum):
    solo_gaston        = "solo_gaston"
    gaston_valentina   = "gaston_valentina"
    gaston_valentin    = "gaston_valentin"
    los_tres           = "los_tres"
    custom             = "custom"


class Proyecto(Base):
    __tablename__ = "proyectos"

    id              = Column(Integer, primary_key=True, index=True)
    cliente_id      = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    nombre          = Column(String, nullable=False)
    descripcion     = Column(Text, nullable=True)
    tipo            = Column(String, nullable=True)
    estado          = Column(Enum(EstadoProyecto), default=EstadoProyecto.en_curso, nullable=False)
    honorario_total = Column(Numeric(14, 2), nullable=True)
    fecha_inicio    = Column(DateTime(timezone=True), nullable=True)
    fecha_fin       = Column(DateTime(timezone=True), nullable=True)
    notas           = Column(Text, nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())

    cliente         = relationship("Cliente", back_populates="proyectos")
    honorarios      = relationship("HonorarioDistribucion", back_populates="proyecto",
                                   cascade="all, delete-orphan")


class HonorarioDistribucion(Base):
    __tablename__ = "honorarios_distribucion"

    id                = Column(Integer, primary_key=True, index=True)
    proyecto_id       = Column(Integer, ForeignKey("proyectos.id"), nullable=False)
    honorario_cobrado = Column(Numeric(14, 2), nullable=True)
    gastos            = Column(Numeric(14, 2), default=0)
    neto              = Column(Numeric(14, 2), nullable=True)
    plantilla         = Column(Enum(PlantillaHonorario), default=PlantillaHonorario.solo_gaston)
    pct_gaston        = Column(Numeric(5, 2), default=100)
    pct_valentina     = Column(Numeric(5, 2), default=0)
    pct_valentin      = Column(Numeric(5, 2), default=0)
    monto_gaston      = Column(Numeric(14, 2), nullable=True)
    monto_valentina   = Column(Numeric(14, 2), nullable=True)
    monto_valentin    = Column(Numeric(14, 2), nullable=True)
    liquidado         = Column(Boolean, default=False)
    notas_liquidacion = Column(Text, nullable=True)
    created_at        = Column(DateTime(timezone=True), server_default=func.now())
    updated_at        = Column(DateTime(timezone=True), onupdate=func.now())

    proyecto          = relationship("Proyecto", back_populates="honorarios")
