from sqlalchemy import Column, Integer, String, Numeric, Date, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


# ── Materiales ────────────────────────────────────────────────────────────────

class Material(Base):
    """Ficha maestra de un material del Banco de Precios (sección 4.13)."""
    __tablename__ = "materiales"

    id          = Column(Integer, primary_key=True, index=True)
    nombre      = Column(String, nullable=False)
    unidad      = Column(String, nullable=True)
    categoria   = Column(String, nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    precios     = relationship(
        "PrecioMaterial", back_populates="material",
        cascade="all, delete-orphan", order_by="PrecioMaterial.fecha.desc()"
    )


class PrecioMaterial(Base):
    """
    Historial de precios de un material. Cada carga nueva agrega una fila;
    el precio "actual" es siempre el de fecha más reciente.
    """
    __tablename__ = "precios_material"

    id                  = Column(Integer, primary_key=True, index=True)
    material_id         = Column(Integer, ForeignKey("materiales.id"), nullable=False)

    precio_sin_iva      = Column(Numeric(14, 2), nullable=False)
    tipo_cambio_bna     = Column(Numeric(10, 2), nullable=True)   # $/USD al momento de la carga
    equivalente_usd     = Column(Numeric(14, 2), nullable=True)   # precio_sin_iva / tipo_cambio_bna

    fecha               = Column(Date, nullable=False)
    proveedor           = Column(String, nullable=True)
    referencia_origen   = Column(String, nullable=True)  # ej: link/nota al presupuesto de origen

    created_at          = Column(DateTime(timezone=True), server_default=func.now())

    material            = relationship("Material", back_populates="precios")


# ── Mano de obra — albañilería (por ítem, precio por unidad ejecutada) ────────

class ManoObraItem(Base):
    __tablename__ = "mano_obra_items"

    id          = Column(Integer, primary_key=True, index=True)
    designacion = Column(String, nullable=False)
    unidad      = Column(String, nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    precios     = relationship(
        "PrecioManoObraItem", back_populates="item",
        cascade="all, delete-orphan", order_by="PrecioManoObraItem.fecha.desc()"
    )


class PrecioManoObraItem(Base):
    __tablename__ = "precios_mano_obra_item"

    id            = Column(Integer, primary_key=True, index=True)
    item_id       = Column(Integer, ForeignKey("mano_obra_items.id"), nullable=False)
    precio        = Column(Numeric(14, 2), nullable=False)
    fecha         = Column(Date, nullable=False)
    notas         = Column(Text, nullable=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    item          = relationship("ManoObraItem", back_populates="precios")


# ── Mano de obra — instalaciones (por rubro global, referencia histórica) ─────

class ManoObraInstalacion(Base):
    __tablename__ = "mano_obra_instalaciones"

    id          = Column(Integer, primary_key=True, index=True)
    rubro       = Column(String, nullable=False)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    referencias = relationship(
        "ReferenciaManoObraInstalacion", back_populates="instalacion",
        cascade="all, delete-orphan", order_by="ReferenciaManoObraInstalacion.fecha.desc()"
    )


class ReferenciaManoObraInstalacion(Base):
    __tablename__ = "referencias_mano_obra_instalacion"

    id              = Column(Integer, primary_key=True, index=True)
    instalacion_id  = Column(Integer, ForeignKey("mano_obra_instalaciones.id"), nullable=False)
    monto           = Column(Numeric(14, 2), nullable=False)
    fecha           = Column(Date, nullable=False)
    notas           = Column(Text, nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    instalacion     = relationship("ManoObraInstalacion", back_populates="referencias")
