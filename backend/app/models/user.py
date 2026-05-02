from sqlalchemy import Column, Integer, String, Boolean, Enum
from app.core.database import Base
import enum

class RolUsuario(str, enum.Enum):
    gaston   = "gaston"
    valentina = "valentina"
    valentin  = "valentin"

class User(Base):
    __tablename__ = "usuarios"

    id          = Column(Integer, primary_key=True, index=True)
    nombre      = Column(String, nullable=False)
    email       = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    rol         = Column(Enum(RolUsuario), nullable=False)
    is_active   = Column(Boolean, default=True)
