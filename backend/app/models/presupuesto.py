from sqlalchemy import Column, Integer, String, Numeric, DateTime, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum


class EstadoPresupuesto(str, enum.Enum):
    borrador   = "borrador"
    enviado    = "enviado"
    confirmado = "confirmado"
    rechazado  = "rechazado"


class FormaPago(str, enum.Enum):
    contado         = "contado"
    cuotas          = "cuotas"
    anticipo_cuotas = "anticipo_cuotas"
    a_convenir      = "a_convenir"


class Presupuesto(Base):
    __tablename__ = "presupuestos"

    id              = Column(Integer, primary_key=True, index=True)
    numero          = Column(String, unique=True, nullable=False)
    cliente_id      = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    tipo            = Column(String, nullable=False)
    descripcion     = Column(Text, nullable=True)
    estado          = Column(Enum(EstadoPresupuesto), default=EstadoPresupuesto.borrador)

    honorario_total = Column(Numeric(14, 2), nullable=False)
    forma_pago      = Column(Enum(FormaPago), default=FormaPago.a_convenir)
    detalle_pago    = Column(Text, nullable=True)

    superficie      = Column(Numeric(10, 2), nullable=True)
    incluye         = Column(Text, nullable=True)
    no_incluye      = Column(Text, nullable=True)
    notas           = Column(Text, nullable=True)

    profesional_1   = Column(String, nullable=True, default="Ing. Gastón Conrero")
    profesional_2   = Column(String, nullable=True)

    fecha_emision      = Column(DateTime(timezone=True), server_default=func.now())
    fecha_envio        = Column(DateTime(timezone=True), nullable=True)
    fecha_confirmacion = Column(DateTime(timezone=True), nullable=True)
    created_at         = Column(DateTime(timezone=True), server_default=func.now())
    updated_at         = Column(DateTime(timezone=True), onupdate=func.now())

    cliente = relationship("Cliente", back_populates="presupuestos")
