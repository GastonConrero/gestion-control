from sqlalchemy import Column, Integer, String, Numeric, Date, DateTime, Text, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum


class TipoFactura(str, enum.Enum):
    A = "A"  # precio ÷ 1.21 = precio sin IVA
    C = "C"  # precio final = precio sin IVA (monotributista)


class EstadoCotizacion(str, enum.Enum):
    pendiente_revision = "pendiente_revision"
    confirmada         = "confirmada"


# ── Etapa 1: Listado de materiales ────────────────────────────────────────────

class ListadoMateriales(Base):
    """Paquete de materiales a cotizar / comprar (sección 4.12, etapa 1)."""
    __tablename__ = "listados_materiales"

    id          = Column(Integer, primary_key=True, index=True)
    nombre      = Column(String, nullable=False)
    obra_id     = Column(Integer, ForeignKey("obras.id"), nullable=True)
    notas       = Column(Text, nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    obra        = relationship("Obra")
    items       = relationship(
        "ItemListado", back_populates="listado",
        cascade="all, delete-orphan", order_by="ItemListado.id"
    )
    cotizaciones = relationship(
        "CotizacionProveedor", back_populates="listado",
        cascade="all, delete-orphan", order_by="CotizacionProveedor.created_at.desc()"
    )


class ItemListado(Base):
    __tablename__ = "items_listado_materiales"

    id                  = Column(Integer, primary_key=True, index=True)
    listado_id          = Column(Integer, ForeignKey("listados_materiales.id"), nullable=False)
    designacion         = Column(String, nullable=False)
    unidad              = Column(String, nullable=True)
    cantidad_pedida     = Column(Numeric(14, 3), nullable=False, default=0)
    cantidad_entregada  = Column(Numeric(14, 3), nullable=False, default=0)
    created_at          = Column(DateTime(timezone=True), server_default=func.now())

    listado             = relationship("ListadoMateriales", back_populates="items")


# ── Etapa 2: Cotizaciones de proveedores ──────────────────────────────────────

class CotizacionProveedor(Base):
    """
    Cotización de un proveedor para un listado de materiales (sección 4.12,
    etapa 2). Se carga manualmente (o, más adelante, extraída con IA desde
    PDF/foto). Se compara siempre "sin IVA" contra las demás cotizaciones
    del mismo listado, y la decisión se toma por total del paquete.
    """
    __tablename__ = "cotizaciones_proveedor"

    id              = Column(Integer, primary_key=True, index=True)
    listado_id      = Column(Integer, ForeignKey("listados_materiales.id"), nullable=False)

    proveedor       = Column(String, nullable=False)
    tipo_factura    = Column(Enum(TipoFactura), nullable=False, default=TipoFactura.A)
    fecha           = Column(Date, nullable=True)
    archivo_url     = Column(String, nullable=True)  # link al PDF/foto subido (para IA a futuro)
    estado          = Column(Enum(EstadoCotizacion), nullable=False, default=EstadoCotizacion.pendiente_revision)
    ganadora        = Column(Boolean, nullable=False, default=False)
    notas           = Column(Text, nullable=True)

    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    listado         = relationship("ListadoMateriales", back_populates="cotizaciones")
    items           = relationship(
        "ItemCotizacion", back_populates="cotizacion",
        cascade="all, delete-orphan", order_by="ItemCotizacion.id"
    )


class ItemCotizacion(Base):
    __tablename__ = "items_cotizacion"

    id                       = Column(Integer, primary_key=True, index=True)
    cotizacion_id            = Column(Integer, ForeignKey("cotizaciones_proveedor.id"), nullable=False)
    item_listado_id          = Column(Integer, ForeignKey("items_listado_materiales.id"), nullable=True)

    designacion              = Column(String, nullable=False)
    unidad                   = Column(String, nullable=True)
    cantidad                 = Column(Numeric(14, 3), nullable=False, default=0)
    precio_unitario_factura  = Column(Numeric(14, 2), nullable=False, default=0)  # tal cual figura en la factura
    confianza_baja           = Column(Boolean, nullable=False, default=False)     # para revisión (uso futuro con IA)

    created_at               = Column(DateTime(timezone=True), server_default=func.now())

    cotizacion               = relationship("CotizacionProveedor", back_populates="items")
    item_listado             = relationship("ItemListado")
