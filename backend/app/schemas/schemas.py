from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from app.models.user import RolUsuario

# ── AUTH ──────────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    usuario: dict

# ── USUARIOS ──────────────────────────────────────────────────────────────────
class UsuarioOut(BaseModel):
    id: int
    nombre: str
    email: str
    rol: RolUsuario
    is_active: bool

    class Config:
        from_attributes = True

# ── CLIENTES ──────────────────────────────────────────────────────────────────
class ClienteBase(BaseModel):
    apellido: str
    nombre: str
    email: Optional[str] = None
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    localidad: Optional[str] = None
    notas: Optional[str] = None

class ClienteCreate(ClienteBase):
    pass

class ClienteUpdate(ClienteBase):
    apellido: Optional[str] = None
    nombre: Optional[str] = None

class ClienteOut(ClienteBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
