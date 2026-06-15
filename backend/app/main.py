from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import engine, Base
from app.api import auth, clientes, setup, proyectos, presupuesto as presupuestos
from app.models import user, cliente, proyecto, presupuesto  # noqa: F401
from app.models.cliente import Cliente
from app.models.proyecto import Proyecto
from app.models.presupuesto import Presupuesto
from sqlalchemy.orm import relationship

if not hasattr(Cliente, 'proyectos'):
    Cliente.proyectos = relationship("Proyecto", back_populates="cliente",
                                     cascade="all, delete-orphan")

if not hasattr(Cliente, 'presupuestos'):
    Cliente.presupuestos = relationship("Presupuesto", back_populates="cliente",
                                        cascade="all, delete-orphan")

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
app.include_router(presupuestos.router)

@app.get("/")
def root():
    return {"status": "ok", "sistema": "Gestión y Control v1.0"}
