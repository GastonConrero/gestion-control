from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import engine, Base
from app.api import auth, clientes, setup, proyectos
from app.models import user, cliente, proyecto  # noqa: F401

# Relación inversa Cliente → Proyectos
from app.models.cliente import Cliente
from app.models.proyecto import Proyecto
if not hasattr(Cliente, 'proyectos'):
    from sqlalchemy.orm import relationship
    Cliente.proyectos = relationship("Proyecto", back_populates="cliente",
                                     cascade="all, delete-orphan")

# Crear tablas
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Gestión y Control — GC",
    description="Sistema de gestión integral Ing. Gastón Conrero",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(clientes.router)
app.include_router(setup.router)
app.include_router(proyectos.router)

@app.get("/")
def root():
    return {"status": "ok", "sistema": "Gestión y Control v1.0"}
