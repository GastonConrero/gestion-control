from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Tarea(Base):
    """
    Planificación semanal (sección 4.1): los tres integrantes cargan tareas
    y las tachan al completarlas. Visible para todo el equipo, cada uno
    gestiona las suyas.
    """
    __tablename__ = "tareas"

    id                = Column(Integer, primary_key=True, index=True)
    usuario_id        = Column(Integer, ForeignKey("usuarios.id"), nullable=False)

    descripcion       = Column(Text, nullable=False)
    completada        = Column(Boolean, nullable=False, default=False)

    created_at        = Column(DateTime(timezone=True), server_default=func.now())
    fecha_completada  = Column(DateTime(timezone=True), nullable=True)

    usuario           = relationship("User")
