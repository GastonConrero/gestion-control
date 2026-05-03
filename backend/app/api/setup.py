from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.user import User, RolUsuario

router = APIRouter(prefix="/api/setup", tags=["setup"])

@router.post("/crear-usuarios")
def crear_usuarios(db: Session = Depends(get_db)):
    """Crea los usuarios iniciales. Solo funciona si no hay usuarios."""
    if db.query(User).count() > 0:
        raise HTTPException(status_code=400, detail="Los usuarios ya fueron creados.")

    usuarios = [
        {"nombre": "Gastón Conrero",    "email": "ggconrero@gmail.com", "password": "GC2026admin", "rol": RolUsuario.gaston},
        {"nombre": "Valentina Martini", "email": "valentina@nodo.com",  "password": "VM2026nodo",  "rol": RolUsuario.valentina},
        {"nombre": "Valentín Turaglio", "email": "valentin@nodo.com",   "password": "VT2026nodo",  "rol": RolUsuario.valentin},
    ]

    creados = []
    for u in usuarios:
        user = User(
            nombre=u["nombre"],
            email=u["email"],
            hashed_password=get_password_hash(u["password"]),
            rol=u["rol"]
        )
        db.add(user)
        creados.append({"nombre": u["nombre"], "email": u["email"], "rol": u["rol"]})

    db.commit()
    return {"ok": True, "usuarios_creados": creados}
