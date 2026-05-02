from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.sql import func
from app.core.database import Base

class Cliente(Base):
    __tablename__ = "clientes"

    id          = Column(Integer, primary_key=True, index=True)
    apellido    = Column(String, nullable=False, index=True)
    nombre      = Column(String, nullable=False)
    email       = Column(String, nullable=True)
    telefono    = Column(String, nullable=True)
    direccion   = Column(String, nullable=True)
    localidad   = Column(String, nullable=True)
    notas       = Column(Text, nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now())
