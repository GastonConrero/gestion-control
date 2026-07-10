from sqlalchemy import Column, Integer, String, Numeric, DateTime, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum


class FormaCobro(str, enum.Enum):
    efectivo      = "efectivo"
    transferencia = "transferencia"
    cheque        = "cheque"


class Recibo(Base):
    __tablename__ = "recibos"

    id              = Column(Integer, primary_key=True, index=True)
    numero          = Column(String, unique=True, nullable=False)
    cliente_id      = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    proyecto_id     = Column(Integer, ForeignKey("proyectos.id"), nullable=True)
    presupuesto_id  = Column(Integer, ForeignKey("presupuestos.id"), nullable=True)

    concepto        = Column(Text, nullable=False)
    monto           = Column(Numeric(14, 2), nullable=False)
    forma_cobro     = Column(Enum(FormaCobro), nullable=False)
    referencia      = Column(String, nullable=True)  # nro de cheque o de transferencia
    notas           = Column(Text, nullable=True)

    fecha_emision   = Column(DateTime(timezone=True), server_default=func.now())
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    cliente         = relationship("Cliente", back_populates="recibos")
    proyecto        = relationship("Proyecto")
    presupuesto     = relationship("Presupuesto")
