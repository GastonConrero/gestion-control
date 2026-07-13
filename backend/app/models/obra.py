from sqlalchemy import (
    Column, Integer, String, Numeric, DateTime, Date, Text,
    ForeignKey, Enum, Boolean
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum
import uuid


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

    # Link único del Portal del Cliente (sección 4.15) — se genera la primera vez que se pide
    token_portal          = Column(String, unique=True, index=True, nullable=True)

    created_at            = Column(DateTime(timezone=True), server_default=func.now())
    updated_at            = Column(DateTime(timezone=True), onupdate=func.now())

    cliente               = relationship("Cliente", back_populates="obras")
    presupuesto           = relationship("Presupuesto")
    cronograma            = relationship(
        "CronogramaCuota", back_populates="obra",
        cascade="all, delete-orphan", order_by="CronogramaCuota.numero"
    )
    items_computo         = relationship(
        "ItemObra", back_populates="obra",
        cascade="all, delete-orphan", order_by="ItemObra.id"
    )
    certificados          = relationship(
        "CertificadoAvance", back_populates="obra",
        cascade="all, delete-orphan", order_by="CertificadoAvance.numero"
    )
    seguimientos_semanales = relationship(
        "SeguimientoSemanal", back_populates="obra", cascade="all, delete-orphan"
    )
    sintesis_mensuales     = relationship(
        "SintesisMensual", back_populates="obra", cascade="all, delete-orphan"
    )
    informes_generados     = relationship(
        "InformeGenerado", back_populates="obra", cascade="all, delete-orphan"
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


class ItemObra(Base):
    """
    Ítem del cómputo de la obra (planilla de ítems presupuestados).
    Es la base sobre la que se cargan los certificados de avance mes a mes.
    """
    __tablename__ = "items_obra"

    id              = Column(Integer, primary_key=True, index=True)
    obra_id         = Column(Integer, ForeignKey("obras.id"), nullable=False)

    orden           = Column(String, nullable=True, default="0")  # admite "1", "1.1", "1.1.2"...
    designacion     = Column(String, nullable=False)
    unidad          = Column(String, nullable=True)   # ej: m2, m3, gl, ml
    cantidad        = Column(Numeric(14, 3), nullable=False, default=0)

    # precio_unitario = cuenta cliente (con costo empresa); precio_unitario_albanil = cuenta albañil
    precio_unitario         = Column(Numeric(14, 2), nullable=False, default=0)
    precio_unitario_albanil = Column(Numeric(14, 2), nullable=False, default=0)

    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    obra            = relationship("Obra", back_populates="items_computo")


class CertificadoAvance(Base):
    """
    Certificado de avance de un período (mensual). Contiene el % acumulado
    cargado para cada ítem de la obra en ese momento; el sistema calcula
    todo lo demás (sección 4.6): % del mes, $ del mes, $ acumulado, saldo.
    """
    __tablename__ = "certificados_avance"

    id                 = Column(Integer, primary_key=True, index=True)
    obra_id            = Column(Integer, ForeignKey("obras.id"), nullable=False)

    numero             = Column(Integer, nullable=False)
    periodo            = Column(String, nullable=False)   # ej: "Julio 2026"
    fecha_certificado  = Column(Date, nullable=True)

    created_at         = Column(DateTime(timezone=True), server_default=func.now())

    obra               = relationship("Obra", back_populates="certificados")
    items              = relationship(
        "CertificadoItem", back_populates="certificado",
        cascade="all, delete-orphan"
    )


class CertificadoItem(Base):
    """
    Línea de un certificado: el % acumulado cargado para un ítem puntual,
    con los cálculos derivados (sección 4.6), calculados en paralelo para
    las dos cuentas (cliente / albañil), igual que en el cronograma:
        pct_mes    = pct_acum_nuevo - pct_acum_anterior   (mismo % físico, una sola vez)
        monto_mes  = (pct_mes / 100) * total_item
        monto_acum = (pct_acum_nuevo / 100) * total_item
        saldo      = total_item - monto_acum
    Los total_item quedan "congelados" (snapshot) al momento del certificado,
    para que cambios posteriores de precio no alteren certificados pasados.
    """
    __tablename__ = "certificado_items"

    id                  = Column(Integer, primary_key=True, index=True)
    certificado_id      = Column(Integer, ForeignKey("certificados_avance.id"), nullable=False)
    item_id             = Column(Integer, ForeignKey("items_obra.id"), nullable=False)

    pct_acum_anterior   = Column(Numeric(6, 3), nullable=False, default=0)
    pct_acum_nuevo      = Column(Numeric(6, 3), nullable=False, default=0)
    pct_mes             = Column(Numeric(6, 3), nullable=False, default=0)

    # Cuenta cliente (con costo empresa)
    total_item_snapshot = Column(Numeric(14, 2), nullable=False, default=0)
    monto_mes           = Column(Numeric(14, 2), nullable=False, default=0)
    monto_acum          = Column(Numeric(14, 2), nullable=False, default=0)
    saldo               = Column(Numeric(14, 2), nullable=False, default=0)

    # Cuenta albañil (sin costo empresa)
    total_item_snapshot_albanil = Column(Numeric(14, 2), nullable=False, default=0)
    monto_mes_albanil           = Column(Numeric(14, 2), nullable=False, default=0)
    monto_acum_albanil          = Column(Numeric(14, 2), nullable=False, default=0)
    saldo_albanil                = Column(Numeric(14, 2), nullable=False, default=0)

    certificado         = relationship("CertificadoAvance", back_populates="items")
    item                = relationship("ItemObra")
