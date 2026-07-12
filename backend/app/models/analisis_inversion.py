from sqlalchemy import Column, Integer, String, Numeric, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class AnalisisInversion(Base):
    """
    Análisis de inversión (sección 4.14): importa un cómputo (Excel o carga
    manual), cruza automáticamente con el Banco de Precios, y calcula la
    inversión total en pesos y USD, desglosada por rubro. Se puede calcular
    con precios actuales o a una fecha histórica.
    """
    __tablename__ = "analisis_inversion"

    id            = Column(Integer, primary_key=True, index=True)
    nombre        = Column(String, nullable=False)
    obra_id       = Column(Integer, ForeignKey("obras.id"), nullable=True)
    fecha_calculo = Column(Date, nullable=True)  # null = precios actuales
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    obra          = relationship("Obra")
    items         = relationship(
        "ItemAnalisisInversion", back_populates="analisis",
        cascade="all, delete-orphan", order_by="ItemAnalisisInversion.id"
    )


class ItemAnalisisInversion(Base):
    __tablename__ = "items_analisis_inversion"

    id                      = Column(Integer, primary_key=True, index=True)
    analisis_id             = Column(Integer, ForeignKey("analisis_inversion.id"), nullable=False)
    material_id             = Column(Integer, ForeignKey("materiales.id"), nullable=True)

    designacion             = Column(String, nullable=False)
    unidad                  = Column(String, nullable=True)
    cantidad                = Column(Numeric(14, 3), nullable=False, default=0)
    pct_adicional           = Column(Numeric(6, 2), nullable=False, default=0)
    categoria               = Column(String, nullable=True)  # rubro manual (si no matcheó con el banco)
    precio_unitario_manual  = Column(Numeric(14, 2), nullable=True)  # si no hay match en el banco

    created_at              = Column(DateTime(timezone=True), server_default=func.now())

    analisis                = relationship("AnalisisInversion", back_populates="items")
    material                = relationship("Material")
