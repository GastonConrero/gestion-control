from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from decimal import Decimal
from datetime import date
import io

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.obra import Obra
from app.models.banco_precios import Material, PrecioMaterial
from app.models.analisis_inversion import AnalisisInversion, ItemAnalisisInversion
from app.schemas.analisis_inversion import (
    AnalisisCreate, AnalisisUpdate, AnalisisOut, AnalisisDetalle,
    ItemAnalisisCreate, ItemAnalisisUpdate, ItemAnalisisOut,
    ImportarExcelResultado,
)

router = APIRouter(prefix="/api/analisis-inversion", tags=["analisis_inversion"])

DIAS_DESACTUALIZADO = 30


def _solo_gaston(user: User):
    if user.rol != "gaston":
        raise HTTPException(status_code=403, detail="Solo Gastón puede eliminar")


def _get_analisis(db: Session, analisis_id: int) -> AnalisisInversion:
    a = db.query(AnalisisInversion).filter(AnalisisInversion.id == analisis_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Análisis no encontrado")
    return a


def _precio_material_a_fecha(db: Session, material_id: int, fecha_ref: date):
    """Precio de un material vigente a una fecha dada (o el más reciente si no hay fecha)."""
    q = db.query(PrecioMaterial).filter(PrecioMaterial.material_id == material_id)
    if fecha_ref:
        q = q.filter(PrecioMaterial.fecha <= fecha_ref)
    return q.order_by(PrecioMaterial.fecha.desc()).first()


def _item_out(db: Session, it: ItemAnalisisInversion, fecha_calculo: Optional[date]) -> dict:
    d = {c.name: getattr(it, c.name) for c in it.__table__.columns}
    d["material_nombre"] = it.material.nombre if it.material else None

    fecha_ref = fecha_calculo or date.today()
    precio_unitario = None
    fuente = "sin_precio"
    desactualizado = False
    dias = None

    if it.material_id:
        pm = _precio_material_a_fecha(db, it.material_id, fecha_ref)
        if pm:
            precio_unitario = pm.precio_sin_iva
            fuente = "banco"
            dias = (fecha_ref - pm.fecha).days
            desactualizado = dias > DIAS_DESACTUALIZADO

    if precio_unitario is None and it.precio_unitario_manual is not None:
        precio_unitario = it.precio_unitario_manual
        fuente = "manual"

    subtotal_pesos = Decimal("0")
    subtotal_usd = None
    if precio_unitario is not None:
        factor = (Decimal("1") + (it.pct_adicional / Decimal("100")))
        subtotal_pesos = it.cantidad * precio_unitario * factor
        if fuente == "banco" and pm and pm.equivalente_usd:
            subtotal_usd = it.cantidad * pm.equivalente_usd * factor

    d["precio_unitario_usado"] = precio_unitario
    d["fuente_precio"] = fuente
    d["subtotal_pesos"] = subtotal_pesos
    d["subtotal_usd"] = subtotal_usd
    d["desactualizado"] = desactualizado
    d["dias_sin_actualizar"] = dias
    return d


def _analisis_out(a: AnalisisInversion) -> dict:
    d = {c.name: getattr(a, c.name) for c in a.__table__.columns}
    d["obra_nombre"] = a.obra.nombre if a.obra else None
    d["cant_items"] = len(a.items)
    return d


def _analisis_detalle(db: Session, a: AnalisisInversion) -> dict:
    d = _analisis_out(a)
    items_out = [_item_out(db, it, a.fecha_calculo) for it in a.items]
    d["items"] = items_out

    total_pesos = sum((i["subtotal_pesos"] for i in items_out), Decimal("0"))
    total_usd_vals = [i["subtotal_usd"] for i in items_out if i["subtotal_usd"] is not None]
    total_usd = sum(total_usd_vals, Decimal("0")) if total_usd_vals else None

    d["total_pesos"] = total_pesos
    d["total_usd"] = total_usd
    d["items_sin_precio"] = sum(1 for i in items_out if i["fuente_precio"] == "sin_precio")
    d["items_desactualizados"] = sum(1 for i in items_out if i["desactualizado"])

    rubros = {}
    for i, it_model in zip(items_out, a.items):
        rubro = it_model.categoria or (it_model.material.categoria if it_model.material else None) or "Sin categoría"
        if rubro not in rubros:
            rubros[rubro] = {"total_pesos": Decimal("0"), "total_usd": Decimal("0"), "tiene_usd": False}
        rubros[rubro]["total_pesos"] += i["subtotal_pesos"]
        if i["subtotal_usd"] is not None:
            rubros[rubro]["total_usd"] += i["subtotal_usd"]
            rubros[rubro]["tiene_usd"] = True

    d["por_rubro"] = [
        {"rubro": r, "total_pesos": v["total_pesos"], "total_usd": v["total_usd"] if v["tiene_usd"] else None}
        for r, v in rubros.items()
    ]
    return d


# ── CRUD análisis ─────────────────────────────────────────────────────────────

@router.get("/", response_model=List[AnalisisOut])
def listar_analisis(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    analisis = db.query(AnalisisInversion).order_by(AnalisisInversion.created_at.desc()).all()
    return [_analisis_out(a) for a in analisis]


@router.post("/", response_model=AnalisisOut)
def crear_analisis(
    datos: AnalisisCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if datos.obra_id:
        obra = db.query(Obra).filter(Obra.id == datos.obra_id).first()
        if not obra:
            raise HTTPException(status_code=404, detail="Obra no encontrada")
    a = AnalisisInversion(**datos.model_dump())
    db.add(a)
    db.commit()
    db.refresh(a)
    return _analisis_out(a)


@router.get("/{analisis_id}", response_model=AnalisisDetalle)
def obtener_analisis(
    analisis_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    a = _get_analisis(db, analisis_id)
    return _analisis_detalle(db, a)


@router.put("/{analisis_id}", response_model=AnalisisOut)
def actualizar_analisis(
    analisis_id: int,
    datos: AnalisisUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    a = _get_analisis(db, analisis_id)
    for k, v in datos.model_dump(exclude_unset=True).items():
        setattr(a, k, v)
    db.commit()
    db.refresh(a)
    return _analisis_out(a)


@router.delete("/{analisis_id}")
def eliminar_analisis(
    analisis_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _solo_gaston(current_user)
    a = _get_analisis(db, analisis_id)
    db.delete(a)
    db.commit()
    return {"ok": True}


# ── Ítems ──────────────────────────────────────────────────────────────────────

def _buscar_material_por_nombre(db: Session, nombre: str) -> Optional[Material]:
    if not nombre:
        return None
    return db.query(Material).filter(Material.nombre.ilike(nombre.strip())).first()


@router.post("/{analisis_id}/items", response_model=ItemAnalisisOut)
def crear_item(
    analisis_id: int,
    datos: ItemAnalisisCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    a = _get_analisis(db, analisis_id)
    payload = datos.model_dump()
    if not payload.get("material_id"):
        match = _buscar_material_por_nombre(db, payload["designacion"])
        if match:
            payload["material_id"] = match.id
    it = ItemAnalisisInversion(analisis_id=a.id, **payload)
    db.add(it)
    db.commit()
    db.refresh(it)
    return _item_out(db, it, a.fecha_calculo)


@router.put("/{analisis_id}/items/{item_id}", response_model=ItemAnalisisOut)
def actualizar_item(
    analisis_id: int,
    item_id: int,
    datos: ItemAnalisisUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    a = _get_analisis(db, analisis_id)
    it = db.query(ItemAnalisisInversion).filter(
        ItemAnalisisInversion.id == item_id, ItemAnalisisInversion.analisis_id == analisis_id
    ).first()
    if not it:
        raise HTTPException(status_code=404, detail="Ítem no encontrado")
    for k, v in datos.model_dump(exclude_unset=True).items():
        setattr(it, k, v)
    db.commit()
    db.refresh(it)
    return _item_out(db, it, a.fecha_calculo)


@router.delete("/{analisis_id}/items/{item_id}")
def eliminar_item(
    analisis_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    it = db.query(ItemAnalisisInversion).filter(
        ItemAnalisisInversion.id == item_id, ItemAnalisisInversion.analisis_id == analisis_id
    ).first()
    if not it:
        raise HTTPException(status_code=404, detail="Ítem no encontrado")
    db.delete(it)
    db.commit()
    return {"ok": True}


# ── Importar Excel de cómputo ──────────────────────────────────────────────────

CANDIDATOS_DESIGNACION = ["designacion", "designación", "item", "ítem", "descripcion", "descripción", "material", "detalle"]
CANDIDATOS_UNIDAD = ["unidad", "un", "u", "und"]
CANDIDATOS_CANTIDAD = ["cantidad", "cant", "qty", "cant."]
CANDIDATOS_ADICIONAL = ["% adicional", "%adicional", "adicional", "porcentaje adicional", "pct adicional", "% adic"]


def _normalizar(txt) -> str:
    return str(txt).strip().lower() if txt is not None else ""


@router.post("/{analisis_id}/importar-excel", response_model=ImportarExcelResultado)
async def importar_excel(
    analisis_id: int,
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Importa un Excel de cómputo (sección 4.14): busca una fila de encabezados
    con columnas de designación / unidad / cantidad / % adicional (en
    cualquier orden), y crea un ítem del análisis por cada fila con datos.
    Cruza automáticamente con el Banco de Precios por nombre.
    """
    a = _get_analisis(db, analisis_id)

    try:
        import openpyxl
    except ImportError:
        raise HTTPException(status_code=500, detail="openpyxl no está instalado")

    contenido = await archivo.read()
    try:
        wb = openpyxl.load_workbook(io.BytesIO(contenido), data_only=True)
    except Exception:
        raise HTTPException(status_code=400, detail="No se pudo leer el archivo. ¿Es un .xlsx válido?")

    ws = wb.active
    filas = list(ws.iter_rows(values_only=True))
    if not filas:
        raise HTTPException(status_code=400, detail="El archivo está vacío")

    # Buscar la fila de encabezados entre las primeras 5 filas
    idx_header = None
    col_map = {}
    for i, fila in enumerate(filas[:5]):
        normal = [_normalizar(c) for c in fila]
        col_desig = next((j for j, v in enumerate(normal) if v in CANDIDATOS_DESIGNACION), None)
        col_cant = next((j for j, v in enumerate(normal) if v in CANDIDATOS_CANTIDAD), None)
        if col_desig is not None and col_cant is not None:
            idx_header = i
            col_map["designacion"] = col_desig
            col_map["cantidad"] = col_cant
            col_map["unidad"] = next((j for j, v in enumerate(normal) if v in CANDIDATOS_UNIDAD), None)
            col_map["adicional"] = next((j for j, v in enumerate(normal) if v in CANDIDATOS_ADICIONAL), None)
            break

    if idx_header is None:
        raise HTTPException(
            status_code=400,
            detail="No encontré columnas de Designación y Cantidad en las primeras filas. Revisá los encabezados del Excel.",
        )

    creados = 0
    omitidas = 0
    avisos = []

    for fila in filas[idx_header + 1:]:
        if fila is None:
            continue
        desig = fila[col_map["designacion"]] if col_map["designacion"] < len(fila) else None
        if not desig or not str(desig).strip():
            omitidas += 1
            continue

        cantidad_raw = fila[col_map["cantidad"]] if col_map["cantidad"] < len(fila) else None
        try:
            cantidad = Decimal(str(cantidad_raw)) if cantidad_raw is not None else Decimal("0")
        except Exception:
            cantidad = Decimal("0")
            avisos.append(f"Cantidad inválida en fila con '{desig}', se cargó en 0.")

        unidad = None
        if col_map["unidad"] is not None and col_map["unidad"] < len(fila):
            unidad = fila[col_map["unidad"]]
            unidad = str(unidad).strip() if unidad else None

        pct_adicional = Decimal("0")
        if col_map["adicional"] is not None and col_map["adicional"] < len(fila):
            val = fila[col_map["adicional"]]
            if val is not None:
                try:
                    pct_adicional = Decimal(str(val))
                    if pct_adicional <= 1:  # viene como 0.1 en vez de 10
                        pct_adicional *= Decimal("100")
                except Exception:
                    pass

        match = _buscar_material_por_nombre(db, str(desig))
        it = ItemAnalisisInversion(
            analisis_id=a.id, designacion=str(desig).strip(), unidad=unidad,
            cantidad=cantidad, pct_adicional=pct_adicional,
            material_id=match.id if match else None,
        )
        db.add(it)
        creados += 1
        if not match:
            avisos.append(f"'{desig}' no tiene precio en el Banco de Precios — carga manual pendiente.")

    db.commit()
    return {"items_creados": creados, "filas_omitidas": omitidas, "avisos": avisos[:20]}
