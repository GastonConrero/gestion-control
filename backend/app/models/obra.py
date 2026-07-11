from sqlalchemy import (
    Column, Integer, String, Numeric, DateTime, Date, Text,
    ForeignKey, Enum, Boolean
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum


class EstadoObra(str, enum.Enum):
    en_curso  = "en_curso"
    terminada = "terminada"
    pausada   = "pausada"
    cancelada = "cancelada"


class EstadoCuota(str, enum.Enum):
    pendiente = "pendiente"
    pagada    = "pagada"


class Obra(Base):
    __tablename__ = "obras"

    id                    = Column(Integer, primary_key=True, index=True)
    cliente_id            = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    presupuesto_id        = Column(Integer, ForeignKey("presupuestos.id"), nullable=True)

    nombre                = Column(String, nullable=False)
    tipo_obra             = Column(String, nullable=True)
    superficie            = Column(Numeric(10, 2), nullable=True)  # m2
    estado                = Column(Enum(EstadoObra), nullable=False, default=EstadoObra.en_curso)
    fecha_inicio          = Column(Date, nullable=True)

    # IPC estimado al inicio, aclarado explícitamente como estimación (sección 4.5/4.7)
    ipc_estimado_mensual  = Column(Numeric(5, 2), nullable=False, default=1.5)

    notas                 = Column(Text, nullable=True)
    created_at            = Column(DateTime(timezone=True), server_default=func.now())
    updated_at            = Column(DateTime(timezone=True), onupdate=func.now())

    cliente               = relationship("Cliente", back_populates="obras")
    presupuesto           = relationship("Presupuesto")
    cronograma            = relationship(
        "CronogramaCuota", back_populates="obra",
        cascade="all, delete-orphan", order_by="CronogramaCuota.numero"
    )


class CronogramaCuota(Base):
    """
    Cuota del cronograma de pagos. Cada cuota lleva DOS cuentas paralelas:
    - cliente: cuenta con costo empresa (lo que paga el cliente)
    - albanil: cuenta sin costo empresa (lo que se le gira al albañil/contratista)
    Los ajustes IPC se guardan en pesos (no en %), aplicados sobre el saldo
    pendiente de cada cuenta con la fórmula compuesta (sección 4.7).
    """
    __tablename__ = "cronograma_cuotas"

    id                     = Column(Integer, primary_key=True, index=True)
    obra_id                = Column(Integer, ForeignKey("obras.id"), nullable=False)

    numero                 = Column(Integer, nullable=False)
    descripcion            = Column(String, nullable=True)  # ej "Cuota 1", "Anticipo"
    fecha_prevista         = Column(Date, nullable=True)

    # Montos base proyectados (antes de ajustes IPC)
    monto_cliente          = Column(Numeric(14, 2), nullable=False, default=0)
    monto_albanil          = Column(Numeric(14, 2), nullable=False, default=0)

    # Ajustes IPC acumulados en pesos (se suman al monto base para dar el saldo actualizado)
    ajuste_ipc_cliente     = Column(Numeric(14, 2), nullable=False, default=0)
    ajuste_ipc_albanil     = Column(Numeric(14, 2), nullable=False, default=0)

    estado                 = Column(Enum(EstadoCuota), nullable=False, default=EstadoCuota.pendiente)
    fecha_pago             = Column(Date, nullable=True)
    monto_pagado_cliente   = Column(Numeric(14, 2), nullable=True)
    monto_pagado_albanil   = Column(Numeric(14, 2), nullable=True)

    notas                  = Column(Text, nullable=True)
    created_at             = Column(DateTime(timezone=True), server_default=func.now())

    obra                   = relationship("Obra", back_populates="cronograma")


class AjusteIPCHistorial(Base):
    """Auditoría de cada aplicación de ajuste IPC sobre una cuota (fecha, % usado, resultado)."""
    __tablename__ = "ajustes_ipc_historial"

    id                  = Column(Integer, primary_key=True, index=True)
    cuota_id            = Column(Integer, ForeignKey("cronograma_cuotas.id"), nullable=False)
    ipc_pct             = Column(Numeric(6, 3), nullable=False)
    fuente              = Column(String, nullable=True)  # "estimado" o "indec"
    ajuste_cliente      = Column(Numeric(14, 2), nullable=False, default=0)
    ajuste_albanil      = Column(Numeric(14, 2), nullable=False, default=0)
    saldo_cliente_previo = Column(Numeric(14, 2), nullable=True)
    saldo_albanil_previo = Column(Numeric(14, 2), nullable=True)
    created_at          = Column(DateTime(timezone=True), server_default=func.now())

    cuota               = relationship("CronogramaCuota")
