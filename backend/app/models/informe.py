from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class SeguimientoSemanal(Base):
    """
    Seguimiento semanal de obra (sección 4.11): texto + hasta 2 fotos por
    semana, insumo del Informe Mensual de Avance. Lo pueden cargar Gastón,
    Valentina o Valentín.
    """
    __tablename__ = "seguimientos_semanales"
    __table_args__ = (
        UniqueConstraint("obra_id", "periodo", "semana_numero", name="uq_seguimiento_semana"),
    )

    id             = Column(Integer, primary_key=True, index=True)
    obra_id        = Column(Integer, ForeignKey("obras.id"), nullable=False)

    periodo        = Column(String, nullable=False)   # ej: "Julio 2026" (mismo formato que Certificado)
    semana_numero  = Column(Integer, nullable=False)   # 1 a 4

    descripcion    = Column(Text, nullable=True)
    foto_url_1     = Column(String, nullable=True)
    foto_url_2     = Column(String, nullable=True)

    created_at     = Column(DateTime(timezone=True), server_default=func.now())
    updated_at     = Column(DateTime(timezone=True), onupdate=func.now())

    obra           = relationship("Obra")


class SintesisMensual(Base):
    """Síntesis del mes (sección 4.11): bloque de cierre del informe mensual."""
    __tablename__ = "sintesis_mensuales"
    __table_args__ = (
        UniqueConstraint("obra_id", "periodo", name="uq_sintesis_periodo"),
    )

    id          = Column(Integer, primary_key=True, index=True)
    obra_id     = Column(Integer, ForeignKey("obras.id"), nullable=False)
    periodo     = Column(String, nullable=False)
    texto       = Column(Text, nullable=True)

    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now())

    obra        = relationship("Obra")


class InformeGenerado(Base):
    """
    Registro de cada emisión del PDF del informe mensual (auditoría), para
    que quede un historial consultable igual que Presupuestos/Recibos/OP.
    """
    __tablename__ = "informes_generados"

    id             = Column(Integer, primary_key=True, index=True)
    obra_id        = Column(Integer, ForeignKey("obras.id"), nullable=False)
    numero         = Column(String, nullable=False)
    periodo        = Column(String, nullable=False)
    usuario_id     = Column(Integer, ForeignKey("usuarios.id"), nullable=True)

    created_at     = Column(DateTime(timezone=True), server_default=func.now())

    obra           = relationship("Obra")
    usuario        = relationship("User")
