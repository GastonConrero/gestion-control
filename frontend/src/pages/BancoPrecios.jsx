import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../utils/api'

function fmt(n) {
  if (n === null || n === undefined) return '—'
  return '$ ' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2 })
}
function fmtUsd(n) {
  if (n === null || n === undefined) return null
  return 'USD ' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2 })
}
function fmtFecha(iso) {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR')
}

const TABS = [
  { key: 'materiales', label: 'Materiales' },
  { key: 'item', label: 'Mano de obra (ítem)' },
  { key: 'instalacion', label: 'Mano de obra (instalaciones)' },
]

export default function BancoPrecios() {
  const { usuario } = useAuth()
  const esGaston = usuario?.rol === 'gaston'
  const [tab, setTab] = useState('materiales')

  return (
    <div>
      <div style={s.header}>
        <h2 style={s.titulo}>Banco de Precios</h2>
      </div>
      <div style={s.tabsBar}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ ...s.tabBtn, ...(tab === t.key ? s.tabBtnActivo : {}) }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'materiales' && <SeccionMateriales esGaston={esGaston} />}
      {tab === 'item' && <SeccionManoObraItem esGaston={esGaston} />}
      {tab === 'instalacion' && <SeccionManoObraInstalacion esGaston={esGaston} />}
    </div>
  )
}

// ── Materiales ─────────────────────────────────────────────────────────────

function SeccionMateriales({ esGaston }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)       // 'crear' | null
  const [form, setForm] = useState({ nombre: '', unidad: '', categoria: '', precio_sin_iva: '', tipo_cambio_bna: '', proveedor: '', referencia_origen: '' })
  const [modalPrecio, setModalPrecio] = useState(null)  // material sobre el que cargar precio
  const [formPrecio, setFormPrecio] = useState({ precio_sin_iva: '', tipo_cambio_bna: '', proveedor: '', fecha: '', referencia_origen: '' })
  const [expandido, setExpandido] = useState(null)
  const [detalle, setDetalle] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const cargar = async () => {
    setLoading(true)
    try { const r = await api.get('/api/banco-precios/materiales'); setItems(r.data) }
    catch { /* noop */ }
    finally { setLoading(false) }
  }
  useEffect(() => { cargar() }, [])

  const abrirCrear = () => {
    setForm({ nombre: '', unidad: '', categoria: '', precio_sin_iva: '', tipo_cambio_bna: '', proveedor: '', referencia_origen: '' })
    setError(''); setModal('crear')
  }

  const guardar = async () => {
    if (!form.nombre) { setError('Ingresá el nombre del material'); return }
    setGuardando(true); setError('')
    try {
      const payload = {
        nombre: form.nombre, unidad: form.unidad || null, categoria: form.categoria || null,
        precio_sin_iva: form.precio_sin_iva === '' ? null : Number(form.precio_sin_iva),
        tipo_cambio_bna: form.tipo_cambio_bna === '' ? null : Number(form.tipo_cambio_bna),
        proveedor: form.proveedor || null, referencia_origen: form.referencia_origen || null,
      }
      await api.post('/api/banco-precios/materiales', payload)
      setModal(null); cargar()
    } catch { setError('Error al guardar') }
    finally { setGuardando(false) }
  }

  const abrirCargarPrecio = (m) => {
    setFormPrecio({ precio_sin_iva: '', tipo_cambio_bna: '', proveedor: '', fecha: new Date().toISOString().slice(0, 10), referencia_origen: '' })
    setError(''); setModalPrecio(m)
  }

  const guardarPrecio = async () => {
    if (!formPrecio.precio_sin_iva) { setError('Ingresá el precio'); return }
    setGuardando(true); setError('')
    try {
      const payload = {
        precio_sin_iva: Number(formPrecio.precio_sin_iva),
        tipo_cambio_bna: formPrecio.tipo_cambio_bna === '' ? null : Number(formPrecio.tipo_cambio_bna),
        proveedor: formPrecio.proveedor || null, fecha: formPrecio.fecha || null,
        referencia_origen: formPrecio.referencia_origen || null,
      }
      await api.post(`/api/banco-precios/materiales/${modalPrecio.id}/precio`, payload)
      setModalPrecio(null); cargar()
    } catch { setError('Error al guardar el precio') }
    finally { setGuardando(false) }
  }

  const toggleHistorial = async (m) => {
    if (expandido === m.id) { setExpandido(null); return }
    setExpandido(m.id)
    try {
      const r = await api.get(`/api/banco-precios/materiales/${m.id}`)
      setDetalle(r.data)
    } catch { /* noop */ }
  }

  const eliminar = async (id) => {
    if (!window.confirm('¿Eliminar este material y todo su historial de precios?')) return
    try { await api.delete(`/api/banco-precios/materiales/${id}`); cargar() }
    catch { alert('Error al eliminar') }
  }

  return (
    <div>
      <div style={s.subHeader}>
        <span style={s.count}>{items.length} material{items.length !== 1 ? 'es' : ''}</span>
        <button onClick={abrirCrear} style={s.btnPrimario}>+ Nuevo material</button>
      </div>

      {loading ? <div style={s.empty}>Cargando...</div> : items.length === 0 ? (
        <div style={s.empty}>No hay materiales cargados.</div>
      ) : (
        <div style={s.lista}>
          {items.map(m => (
            <div key={m.id} style={s.card}>
              <div style={s.cardHeader}>
                <div>
                  <div style={s.cardNombre}>{m.nombre}</div>
                  <div style={s.cardSub}>{m.categoria ? `${m.categoria} · ` : ''}{m.unidad || 'sin unidad'}</div>
                </div>
                {m.desactualizado && <span style={s.badgeAlerta}>⚠ Desactualizado ({m.dias_sin_actualizar}d)</span>}
              </div>

              {m.precio_actual ? (
                <div style={s.precioBox}>
                  <div style={s.precioValor}>{fmt(m.precio_actual.precio_sin_iva)}</div>
                  {m.precio_actual.equivalente_usd && <div style={s.precioUsd}>{fmtUsd(m.precio_actual.equivalente_usd)}</div>}
                  <div style={s.precioMeta}>
                    {fmtFecha(m.precio_actual.fecha)}{m.precio_actual.proveedor ? ` · ${m.precio_actual.proveedor}` : ''}
                  </div>
                </div>
              ) : (
                <div style={s.sinPrecio}>Sin precio cargado</div>
              )}

              <div style={s.cardAcciones}>
                <button onClick={() => abrirCargarPrecio(m)} style={s.btnMini}>+ Cargar precio</button>
                <button onClick={() => toggleHistorial(m)} style={s.btnMini}>
                  {expandido === m.id ? 'Ocultar historial' : 'Ver historial'}
                </button>
                {esGaston && <button onClick={() => eliminar(m.id)} style={{ ...s.btnMini, color: '#dc2626' }}>Eliminar</button>}
              </div>

              {expandido === m.id && detalle && (
                <div style={s.historialBox}>
                  {detalle.historial.map(h => (
                    <div key={h.id} style={s.historialFila}>
                      <span>{fmtFecha(h.fecha)}</span>
                      <span>{fmt(h.precio_sin_iva)}{h.equivalente_usd ? ` · ${fmtUsd(h.equivalente_usd)}` : ''}</span>
                      <span style={s.historialProveedor}>{h.proveedor || '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modal === 'crear' && (
        <div style={s.overlay} onClick={() => setModal(null)}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitulo}>Nuevo material</h3>
              <button onClick={() => setModal(null)} style={s.btnCerrar}>✕</button>
            </div>
            <div style={s.modalBody}>
              <div style={s.grid}>
                <div style={s.fullWidth}>
                  <label style={s.label}>Nombre <span style={{ color: '#D4502A' }}>*</span></label>
                  <input style={s.input} value={form.nombre} autoFocus onChange={e => setForm({ ...form, nombre: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Unidad</label>
                  <input style={s.input} value={form.unidad} placeholder="bolsa, m2, kg..." onChange={e => setForm({ ...form, unidad: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Categoría</label>
                  <input style={s.input} value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} />
                </div>
                <div style={s.fullWidth}><hr style={s.hr} /><div style={s.miniLabel}>Precio inicial (opcional)</div></div>
                <div>
                  <label style={s.label}>Precio sin IVA ($)</label>
                  <input type="number" style={s.input} value={form.precio_sin_iva} onChange={e => setForm({ ...form, precio_sin_iva: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Tipo de cambio BNA</label>
                  <input type="number" style={s.input} value={form.tipo_cambio_bna} onChange={e => setForm({ ...form, tipo_cambio_bna: e.target.value })} />
                </div>
                <div style={s.fullWidth}>
                  <label style={s.label}>Proveedor</label>
                  <input style={s.input} value={form.proveedor} onChange={e => setForm({ ...form, proveedor: e.target.value })} />
                </div>
              </div>
              {error && <div style={s.errorMsg}>{error}</div>}
            </div>
            <div style={s.modalFooter}>
              <button onClick={() => setModal(null)} style={s.btnSecundario}>Cancelar</button>
              <button onClick={guardar} style={s.btnPrimario} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {modalPrecio !== null && (
        <div style={s.overlay} onClick={() => setModalPrecio(null)}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitulo}>Cargar precio — {modalPrecio.nombre}</h3>
              <button onClick={() => setModalPrecio(null)} style={s.btnCerrar}>✕</button>
            </div>
            <div style={s.modalBody}>
              <div style={s.grid}>
                <div>
                  <label style={s.label}>Precio sin IVA ($) <span style={{ color: '#D4502A' }}>*</span></label>
                  <input type="number" style={s.input} value={formPrecio.precio_sin_iva} autoFocus onChange={e => setFormPrecio({ ...formPrecio, precio_sin_iva: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Tipo de cambio BNA</label>
                  <input type="number" style={s.input} value={formPrecio.tipo_cambio_bna} onChange={e => setFormPrecio({ ...formPrecio, tipo_cambio_bna: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Fecha</label>
                  <input type="date" style={s.input} value={formPrecio.fecha} onChange={e => setFormPrecio({ ...formPrecio, fecha: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Proveedor</label>
                  <input style={s.input} value={formPrecio.proveedor} onChange={e => setFormPrecio({ ...formPrecio, proveedor: e.target.value })} />
                </div>
                <div style={s.fullWidth}>
                  <label style={s.label}>Referencia de origen</label>
                  <input style={s.input} value={formPrecio.referencia_origen} placeholder="Ej: Presupuesto obra X, proveedor Y" onChange={e => setFormPrecio({ ...formPrecio, referencia_origen: e.target.value })} />
                </div>
              </div>
              {error && <div style={s.errorMsg}>{error}</div>}
            </div>
            <div style={s.modalFooter}>
              <button onClick={() => setModalPrecio(null)} style={s.btnSecundario}>Cancelar</button>
              <button onClick={guardarPrecio} style={s.btnPrimario} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar precio'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Mano de obra — ítem ──────────────────────────────────────────────────────

function SeccionManoObraItem({ esGaston }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ designacion: '', unidad: '', precio: '', notas: '' })
  const [modalPrecio, setModalPrecio] = useState(null)
  const [formPrecio, setFormPrecio] = useState({ precio: '', fecha: '', notas: '' })
  const [expandido, setExpandido] = useState(null)
  const [detalle, setDetalle] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const cargar = async () => {
    setLoading(true)
    try { const r = await api.get('/api/banco-precios/mano-obra-item'); setItems(r.data) }
    catch { /* noop */ } finally { setLoading(false) }
  }
  useEffect(() => { cargar() }, [])

  const abrirCrear = () => { setForm({ designacion: '', unidad: '', precio: '', notas: '' }); setError(''); setModal('crear') }

  const guardar = async () => {
    if (!form.designacion) { setError('Ingresá la designación'); return }
    setGuardando(true); setError('')
    try {
      await api.post('/api/banco-precios/mano-obra-item', {
        designacion: form.designacion, unidad: form.unidad || null,
        precio: form.precio === '' ? null : Number(form.precio), notas: form.notas || null,
      })
      setModal(null); cargar()
    } catch { setError('Error al guardar') }
    finally { setGuardando(false) }
  }

  const abrirCargarPrecio = (i) => { setFormPrecio({ precio: '', fecha: new Date().toISOString().slice(0, 10), notas: '' }); setError(''); setModalPrecio(i) }

  const guardarPrecio = async () => {
    if (!formPrecio.precio) { setError('Ingresá el precio'); return }
    setGuardando(true); setError('')
    try {
      await api.post(`/api/banco-precios/mano-obra-item/${modalPrecio.id}/precio`, {
        precio: Number(formPrecio.precio), fecha: formPrecio.fecha || null, notas: formPrecio.notas || null,
      })
      setModalPrecio(null); cargar()
    } catch { setError('Error al guardar el precio') }
    finally { setGuardando(false) }
  }

  const toggleHistorial = async (i) => {
    if (expandido === i.id) { setExpandido(null); return }
    setExpandido(i.id)
    try { const r = await api.get(`/api/banco-precios/mano-obra-item/${i.id}`); setDetalle(r.data) } catch { /* noop */ }
  }

  const eliminar = async (id) => {
    if (!window.confirm('¿Eliminar este ítem y todo su historial?')) return
    try { await api.delete(`/api/banco-precios/mano-obra-item/${id}`); cargar() } catch { alert('Error al eliminar') }
  }

  return (
    <div>
      <div style={s.subHeader}>
        <span style={s.count}>{items.length} ítem{items.length !== 1 ? 's' : ''}</span>
        <button onClick={abrirCrear} style={s.btnPrimario}>+ Nuevo ítem</button>
      </div>

      {loading ? <div style={s.empty}>Cargando...</div> : items.length === 0 ? (
        <div style={s.empty}>No hay ítems cargados.</div>
      ) : (
        <div style={s.lista}>
          {items.map(i => (
            <div key={i.id} style={s.card}>
              <div style={s.cardHeader}>
                <div>
                  <div style={s.cardNombre}>{i.designacion}</div>
                  <div style={s.cardSub}>{i.unidad || 'sin unidad'}</div>
                </div>
                {i.desactualizado && <span style={s.badgeAlerta}>⚠ Desactualizado ({i.dias_sin_actualizar}d)</span>}
              </div>

              {i.precio_actual ? (
                <div style={s.precioBox}>
                  <div style={s.precioValor}>{fmt(i.precio_actual.precio)}</div>
                  <div style={s.precioMeta}>{fmtFecha(i.precio_actual.fecha)}</div>
                </div>
              ) : <div style={s.sinPrecio}>Sin precio cargado</div>}

              <div style={s.cardAcciones}>
                <button onClick={() => abrirCargarPrecio(i)} style={s.btnMini}>+ Cargar precio</button>
                <button onClick={() => toggleHistorial(i)} style={s.btnMini}>{expandido === i.id ? 'Ocultar historial' : 'Ver historial'}</button>
                {esGaston && <button onClick={() => eliminar(i.id)} style={{ ...s.btnMini, color: '#dc2626' }}>Eliminar</button>}
              </div>

              {expandido === i.id && detalle && (
                <div style={s.historialBox}>
                  {detalle.historial.map(h => (
                    <div key={h.id} style={s.historialFila}>
                      <span>{fmtFecha(h.fecha)}</span>
                      <span>{fmt(h.precio)}</span>
                      <span style={s.historialProveedor}>{h.notas || ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modal === 'crear' && (
        <div style={s.overlay} onClick={() => setModal(null)}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitulo}>Nuevo ítem de mano de obra</h3>
              <button onClick={() => setModal(null)} style={s.btnCerrar}>✕</button>
            </div>
            <div style={s.modalBody}>
              <div style={s.grid}>
                <div style={s.fullWidth}>
                  <label style={s.label}>Designación <span style={{ color: '#D4502A' }}>*</span></label>
                  <input style={s.input} value={form.designacion} autoFocus placeholder="Ej: Mampostería 0.15m" onChange={e => setForm({ ...form, designacion: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Unidad</label>
                  <input style={s.input} value={form.unidad} placeholder="m2, m3, gl..." onChange={e => setForm({ ...form, unidad: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Precio inicial ($/unidad)</label>
                  <input type="number" style={s.input} value={form.precio} onChange={e => setForm({ ...form, precio: e.target.value })} />
                </div>
              </div>
              {error && <div style={s.errorMsg}>{error}</div>}
            </div>
            <div style={s.modalFooter}>
              <button onClick={() => setModal(null)} style={s.btnSecundario}>Cancelar</button>
              <button onClick={guardar} style={s.btnPrimario} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {modalPrecio !== null && (
        <div style={s.overlay} onClick={() => setModalPrecio(null)}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitulo}>Cargar precio — {modalPrecio.designacion}</h3>
              <button onClick={() => setModalPrecio(null)} style={s.btnCerrar}>✕</button>
            </div>
            <div style={s.modalBody}>
              <div style={s.grid}>
                <div>
                  <label style={s.label}>Precio ($/unidad) <span style={{ color: '#D4502A' }}>*</span></label>
                  <input type="number" style={s.input} value={formPrecio.precio} autoFocus onChange={e => setFormPrecio({ ...formPrecio, precio: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Fecha</label>
                  <input type="date" style={s.input} value={formPrecio.fecha} onChange={e => setFormPrecio({ ...formPrecio, fecha: e.target.value })} />
                </div>
                <div style={s.fullWidth}>
                  <label style={s.label}>Notas</label>
                  <input style={s.input} value={formPrecio.notas} onChange={e => setFormPrecio({ ...formPrecio, notas: e.target.value })} />
                </div>
              </div>
              {error && <div style={s.errorMsg}>{error}</div>}
            </div>
            <div style={s.modalFooter}>
              <button onClick={() => setModalPrecio(null)} style={s.btnSecundario}>Cancelar</button>
              <button onClick={guardarPrecio} style={s.btnPrimario} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar precio'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Mano de obra — instalaciones (rubro global) ───────────────────────────────

function SeccionManoObraInstalacion({ esGaston }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ rubro: '', monto: '', notas: '' })
  const [modalRef, setModalRef] = useState(null)
  const [formRef, setFormRef] = useState({ monto: '', fecha: '', notas: '' })
  const [expandido, setExpandido] = useState(null)
  const [detalle, setDetalle] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const cargar = async () => {
    setLoading(true)
    try { const r = await api.get('/api/banco-precios/mano-obra-instalacion'); setItems(r.data) }
    catch { /* noop */ } finally { setLoading(false) }
  }
  useEffect(() => { cargar() }, [])

  const abrirCrear = () => { setForm({ rubro: '', monto: '', notas: '' }); setError(''); setModal('crear') }

  const guardar = async () => {
    if (!form.rubro) { setError('Ingresá el rubro'); return }
    setGuardando(true); setError('')
    try {
      await api.post('/api/banco-precios/mano-obra-instalacion', {
        rubro: form.rubro, monto: form.monto === '' ? null : Number(form.monto), notas: form.notas || null,
      })
      setModal(null); cargar()
    } catch { setError('Error al guardar') }
    finally { setGuardando(false) }
  }

  const abrirCargarRef = (i) => { setFormRef({ monto: '', fecha: new Date().toISOString().slice(0, 10), notas: '' }); setError(''); setModalRef(i) }

  const guardarRef = async () => {
    if (!formRef.monto) { setError('Ingresá el monto'); return }
    setGuardando(true); setError('')
    try {
      await api.post(`/api/banco-precios/mano-obra-instalacion/${modalRef.id}/referencia`, {
        monto: Number(formRef.monto), fecha: formRef.fecha || null, notas: formRef.notas || null,
      })
      setModalRef(null); cargar()
    } catch { setError('Error al guardar') }
    finally { setGuardando(false) }
  }

  const toggleHistorial = async (i) => {
    if (expandido === i.id) { setExpandido(null); return }
    setExpandido(i.id)
    try { const r = await api.get(`/api/banco-precios/mano-obra-instalacion/${i.id}`); setDetalle(r.data) } catch { /* noop */ }
  }

  const eliminar = async (id) => {
    if (!window.confirm('¿Eliminar este rubro y todo su historial?')) return
    try { await api.delete(`/api/banco-precios/mano-obra-instalacion/${id}`); cargar() } catch { alert('Error al eliminar') }
  }

  return (
    <div>
      <div style={s.hintSeccion}>Referencia histórica global por rubro (no por ítem) — ej: "Instalación eléctrica completa".</div>
      <div style={s.subHeader}>
        <span style={s.count}>{items.length} rubro{items.length !== 1 ? 's' : ''}</span>
        <button onClick={abrirCrear} style={s.btnPrimario}>+ Nuevo rubro</button>
      </div>

      {loading ? <div style={s.empty}>Cargando...</div> : items.length === 0 ? (
        <div style={s.empty}>No hay rubros cargados.</div>
      ) : (
        <div style={s.lista}>
          {items.map(i => (
            <div key={i.id} style={s.card}>
              <div style={s.cardHeader}>
                <div style={s.cardNombre}>{i.rubro}</div>
                {i.desactualizado && <span style={s.badgeAlerta}>⚠ Desactualizado ({i.dias_sin_actualizar}d)</span>}
              </div>

              {i.referencia_actual ? (
                <div style={s.precioBox}>
                  <div style={s.precioValor}>{fmt(i.referencia_actual.monto)}</div>
                  <div style={s.precioMeta}>{fmtFecha(i.referencia_actual.fecha)}</div>
                </div>
              ) : <div style={s.sinPrecio}>Sin referencia cargada</div>}

              <div style={s.cardAcciones}>
                <button onClick={() => abrirCargarRef(i)} style={s.btnMini}>+ Cargar referencia</button>
                <button onClick={() => toggleHistorial(i)} style={s.btnMini}>{expandido === i.id ? 'Ocultar historial' : 'Ver historial'}</button>
                {esGaston && <button onClick={() => eliminar(i.id)} style={{ ...s.btnMini, color: '#dc2626' }}>Eliminar</button>}
              </div>

              {expandido === i.id && detalle && (
                <div style={s.historialBox}>
                  {detalle.historial.map(h => (
                    <div key={h.id} style={s.historialFila}>
                      <span>{fmtFecha(h.fecha)}</span>
                      <span>{fmt(h.monto)}</span>
                      <span style={s.historialProveedor}>{h.notas || ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modal === 'crear' && (
        <div style={s.overlay} onClick={() => setModal(null)}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitulo}>Nuevo rubro</h3>
              <button onClick={() => setModal(null)} style={s.btnCerrar}>✕</button>
            </div>
            <div style={s.modalBody}>
              <div style={s.grid}>
                <div style={s.fullWidth}>
                  <label style={s.label}>Rubro <span style={{ color: '#D4502A' }}>*</span></label>
                  <input style={s.input} value={form.rubro} autoFocus placeholder="Ej: Instalación eléctrica completa" onChange={e => setForm({ ...form, rubro: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Monto de referencia inicial ($)</label>
                  <input type="number" style={s.input} value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} />
                </div>
              </div>
              {error && <div style={s.errorMsg}>{error}</div>}
            </div>
            <div style={s.modalFooter}>
              <button onClick={() => setModal(null)} style={s.btnSecundario}>Cancelar</button>
              <button onClick={guardar} style={s.btnPrimario} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {modalRef !== null && (
        <div style={s.overlay} onClick={() => setModalRef(null)}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitulo}>Cargar referencia — {modalRef.rubro}</h3>
              <button onClick={() => setModalRef(null)} style={s.btnCerrar}>✕</button>
            </div>
            <div style={s.modalBody}>
              <div style={s.grid}>
                <div>
                  <label style={s.label}>Monto ($) <span style={{ color: '#D4502A' }}>*</span></label>
                  <input type="number" style={s.input} value={formRef.monto} autoFocus onChange={e => setFormRef({ ...formRef, monto: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Fecha</label>
                  <input type="date" style={s.input} value={formRef.fecha} onChange={e => setFormRef({ ...formRef, fecha: e.target.value })} />
                </div>
                <div style={s.fullWidth}>
                  <label style={s.label}>Notas</label>
                  <input style={s.input} value={formRef.notas} onChange={e => setFormRef({ ...formRef, notas: e.target.value })} />
                </div>
              </div>
              {error && <div style={s.errorMsg}>{error}</div>}
            </div>
            <div style={s.modalFooter}>
              <button onClick={() => setModalRef(null)} style={s.btnSecundario}>Cancelar</button>
              <button onClick={guardarRef} style={s.btnPrimario} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar referencia'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  header:         { marginBottom: 4 },
  titulo:         { fontSize: 20, fontWeight: 700, color: '#111', margin: 0 },
  tabsBar:        { display: 'flex', gap: 4, marginBottom: 18, background: '#e9e9e9', borderRadius: 6, padding: 3, maxWidth: 560 },
  tabBtn:         { flex: 1, background: 'none', border: 'none', padding: '8px 6px', borderRadius: 4, fontSize: 12, fontWeight: 600, color: '#666', cursor: 'pointer' },
  tabBtnActivo:   { background: '#fff', color: '#D4502A', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  subHeader:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  count:          { fontSize: 13, color: '#888' },
  hintSeccion:    { fontSize: 12, color: '#999', marginBottom: 10 },
  btnPrimario:    { background: '#D4502A', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 3, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  lista:          { display: 'flex', flexDirection: 'column', gap: 10 },
  card:           { background: '#fff', border: '1px solid #eee', borderRadius: 4, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  cardHeader:     { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  cardNombre:     { fontSize: 14, fontWeight: 700, color: '#111' },
  cardSub:        { fontSize: 12, color: '#888', marginTop: 2 },
  badgeAlerta:    { fontSize: 10, fontWeight: 700, color: '#b45309', background: '#fefce8', padding: '3px 8px', borderRadius: 20, whiteSpace: 'nowrap' },
  precioBox:      { background: '#f9f9f9', borderRadius: 3, padding: '8px 12px', marginBottom: 10 },
  precioValor:    { fontSize: 17, fontWeight: 700, color: '#111' },
  precioUsd:      { fontSize: 12, color: '#666', marginTop: 1 },
  precioMeta:     { fontSize: 11, color: '#999', marginTop: 3 },
  sinPrecio:      { fontSize: 12, color: '#bbb', fontStyle: 'italic', marginBottom: 10 },
  cardAcciones:   { display: 'flex', gap: 6, flexWrap: 'wrap' },
  btnMini:        { background: 'none', border: '1px solid #ddd', color: '#555', padding: '3px 10px', borderRadius: 3, cursor: 'pointer', fontSize: 11.5 },
  historialBox:   { marginTop: 10, paddingTop: 10, borderTop: '1px solid #f2f2f2', display: 'flex', flexDirection: 'column', gap: 4 },
  historialFila:  { display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#555' },
  historialProveedor: { color: '#999', textAlign: 'right', flex: 1, marginLeft: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  empty:          { textAlign: 'center', color: '#aaa', padding: 30, background: '#fff', borderRadius: 4, border: '1px dashed #ddd', fontSize: 13 },
  overlay:        { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalCard:      { background: '#fff', borderRadius: 4, width: '100%', maxWidth: 520, boxShadow: '0 8px 40px rgba(0,0,0,0.2)', overflow: 'hidden', maxHeight: '90vh', overflowY: 'auto' },
  modalHeader:    { padding: '16px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 1 },
  modalTitulo:    { fontSize: 15, fontWeight: 700, margin: 0, color: '#111' },
  btnCerrar:      { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888' },
  modalBody:      { padding: '20px' },
  grid:           { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' },
  fullWidth:      { gridColumn: '1 / -1' },
  hr:             { border: 'none', borderTop: '1px solid #eee', margin: '4px 0 8px' },
  miniLabel:      { fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.03em' },
  label:          { display: 'block', fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' },
  input:          { width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 3, fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  errorMsg:       { marginTop: 12, background: '#fff5f5', border: '1px solid #fca5a5', color: '#dc2626', padding: '8px 12px', borderRadius: 3, fontSize: 13, borderLeft: '3px solid #dc2626' },
  modalFooter:    { padding: '14px 20px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: 10, position: 'sticky', bottom: 0, background: '#fff' },
  btnSecundario:  { background: '#fff', color: '#333', border: '1px solid #ddd', padding: '8px 16px', borderRadius: 3, cursor: 'pointer', fontSize: 13 },
}
