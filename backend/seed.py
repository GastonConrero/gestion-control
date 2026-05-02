"""
Script para crear los usuarios iniciales del sistema.
Ejecutar una sola vez: python seed.py
"""
import sys
sys.path.append(".")

from app.core.database import SessionLocal, engine, Base
from app.core.security import get_password_hash
from app.models.user import User, RolUsuario
from app.models.cliente import Cliente  # noqa

Base.metadata.create_all(bind=engine)

db = SessionLocal()

usuarios = [
    {
        "nombre": "Gastón Conrero",
        "email": "ggconrero@gmail.com",
        "password": "GC2026_admin",
        "rol": RolUsuario.gaston
    },
    {
        "nombre": "Valentina Martini",
        "email": "valentina@nodo.com",
        "password": "VM2026_nodo",
        "rol": RolUsuario.valentina
    },
    {
        "nombre": "Valentín Turaglio",
        "email": "valentin@nodo.com",
        "password": "VT2026_nodo",
        "rol": RolUsuario.valentin
    },
]

for u in usuarios:
    existe = db.query(User).filter(User.email == u["email"]).first()
    if not existe:
        db_user = User(
            nombre=u["nombre"],
            email=u["email"],
            hashed_password=get_password_hash(u["password"]),
            rol=u["rol"]
        )
        db.add(db_user)
        print(f"✓ Usuario creado: {u['nombre']} ({u['rol']})")
    else:
        print(f"— Ya existe: {u['nombre']}")

db.commit()
db.close()
print("\nUsuarios listos.")
print("IMPORTANTE: Cambiá las contraseñas desde el sistema en el primer login.")
