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


class TipoMovimiento(str, enum.Enum):
    cargo = "cargo"  # aumenta lo que se debe (presupuesto inicial, adicionales, ajustes IPC)
    pago  = "pago"   # reduce lo que se debe (dinero efectivamente cobrado/pagado)


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
        "MovimientoCronograma", back_populates="obra",
        cascade="all, delete-orphan", order_by="MovimientoCronograma.fecha, MovimientoCronograma.id"
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


class MovimientoCronograma(Base):
    """
    Cronograma de pagos como cuenta corriente (no cuotas fijas): una
    secuencia de movimientos por fecha, cada uno "cargo" (aumenta lo
    debido: presupuesto inicial, adicionales, ajustes IPC) o "pago"
    (dinero efectivamente cobrado, reduce lo debido). El saldo pendiente
    es siempre la suma acumulada de cargos menos pagos. Los ajustes IPC
    se aplican sobre el saldo pendiente total en ese momento (no sobre
    un movimiento puntual), y como el saldo ya arrastra los ajustes
    previos, el resultado es naturalmente compuesto.
    Cada movimiento lleva dos cuentas paralelas (cliente / albañil).
    """
    __tablename__ = "movimientos_cronograma"

    id             = Column(Integer, primary_key=True, index=True)
    obra_id        = Column(Integer, ForeignKey("obras.id"), nullable=False)

    fecha          = Column(Date, nullable=False)
    tipo           = Column(Enum(TipoMovimiento), nullable=False)

    monto_cliente  = Column(Numeric(14, 2), nullable=False, default=0)
    monto_albanil  = Column(Numeric(14, 2), nullable=False, default=0)

    concepto       = Column(Text, nullable=True)  # ej "Ajuste por IPC 1,5%", "Instalación de cloacas etapa 1"
    es_ajuste_ipc  = Column(Boolean, nullable=False, default=False)

    created_at     = Column(DateTime(timezone=True), server_default=func.now())

    obra           = relationship("Obra", back_populates="cronograma")


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
