from sqlalchemy import Column, Integer, String, Numeric, DateTime, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum


class FormaPagoOP(str, enum.Enum):
    efectivo      = "efectivo"
    transferencia = "transferencia"
    cheque        = "cheque"


class EstadoOrdenPago(str, enum.Enum):
    pendiente = "pendiente"
    pagado    = "pagado"


class OrdenPago(Base):
    __tablename__ = "ordenes_pago"

    id              = Column(Integer, primary_key=True, index=True)
    numero          = Column(String, unique=True, nullable=False)
    destinatario    = Column(String, nullable=False)  # persona o empresa, no necesariamente cliente
    proyecto_id     = Column(Integer, ForeignKey("proyectos.id"), nullable=True)

    concepto        = Column(Text, nullable=False)
    monto           = Column(Numeric(14, 2), nullable=False)
    forma_pago      = Column(Enum(FormaPagoOP, name="forma_pago_op"), nullable=False)
    referencia      = Column(String, nullable=True)  # nro de cheque o de transferencia
    notas           = Column(Text, nullable=True)

    estado          = Column(Enum(EstadoOrdenPago, name="estado_orden_pago"), nullable=False, default=EstadoOrdenPago.pendiente)
    fecha_emision   = Column(DateTime(timezone=True), server_default=func.now())
    fecha_pago      = Column(DateTime(timezone=True), nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    proyecto        = relationship("Proyecto")
