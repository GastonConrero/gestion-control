# Gestión y Control — GC
Sistema de gestión integral · Ing. Gastón Conrero

## Stack
- Backend: Python + FastAPI
- Base de datos: PostgreSQL (Railway)
- Frontend: React (próximamente)

## Setup local
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env  # completar con datos reales
python seed.py        # crear usuarios iniciales
uvicorn app.main:app --reload
```

## Deploy
Conectado a Railway via GitHub. Cada push a `main` deploya automáticamente.
