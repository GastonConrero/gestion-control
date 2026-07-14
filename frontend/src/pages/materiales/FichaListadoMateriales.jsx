import { useState, useEffect } from 'react'
import api from '../../utils/api'

const TIPOS_FACTURA = [
  { value: 'A', label: 'Factura A (÷ 1.21)' },
  { value: 'C', label: 'Factura C (precio final)' },
]

function fmt(n) {
  if (n === null || n === undefined) return '—'
  return '$ ' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtPct(n) {
  if (n === null || n === undefined) return '—'
  const v = Number(n)
  return (v >= 0 ? '+' : '') + v.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'
}
function fmtFecha(iso) {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR')
}

export default function FichaListadoMateriales({ listadoId, onVolver }) {
  const [listado, setListado] = useState(null)
  const [cotizaciones, setCotizaciones] = useState([])
  const [comparativa, setComparativa] = useState(null)
  const [loading, setLoading] = useState(true)

  const [modalItem, setModalItem] = useState(null)
  const [formItem, setFormItem] = useState({ designacion: '', unidad: '', cantidad_pedida: '' })

  const [modalCot, setModalCot] = useState(false)
  const [formCot, setFormCot] = useState({ proveedor: '', tipo_factura: 'A', fecha: '' })

  const [cotAbierta, setCotAbierta] = useState(null)
  const [detalleCot, setDetalleCot] = useState(null)
  const [modalItemCot, setModalItemCot] = useState(null)   // cotizacion sobre la que agregar item
  const [formItemCot, setFormItemCot] = useState({ designacion: '', unidad: '', cantidad: '', precio_unitario_factura: '' })

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const cargar = async () => {
    setLoading(true)
    try {
      const [rl, rc, rcomp] = await Promise.all([
        api.get(`/api/materiales/listados/${listadoId}`),
        api.get(`/api/materiales/listados/${listadoId}/cotizaciones`),
        api.get(`/api/materiales/listados/${listadoId}/comparativa`),
      ])
      setListado(rl.data); setCotizaciones(rc.data); setComparativa(rcomp.data)
    } catch { /* noop */ } finally { setLoading(false) }
  }
  useEffect(() => { cargar() }, [listadoId])

  // ── Ítems del listado ────────────────────────────────────────────────────
  const abrirCrearItem = () => { setFormItem({ designacion: '', unidad: '', cantidad_pedida: '' }); setError(''); setModalItem('crear') }

  const guardarItem = async () => {
    if (!formItem.designacion) { setError('Ingresá la designación'); return }
    setGuardando(true); setError('')
    try {
      await api.post(`/api/materiales/listados/${listadoId}/items`, {
        designacion: formItem.designacion, unidad: formItem.unidad || null,
        cantidad_pedida: formItem.cantidad_pedida === '' ? 0 : Number(formItem.cantidad_pedida),
      })
      setModalItem(null); cargar()
    } catch { setError('Error al guardar') }
    finally { setGuardando(false) }
  }

  const actualizarEntrega = async (item, valor) => {
    try {
      await api.post(`/api/materiales/listados/${listadoId}/items/${item.id}/entrega`, {
        cantidad_entregada: Number(valor) || 0,
      })
      cargar()
    } catch { alert('Error al registrar la entrega') }
  }

  const eliminarItem = async (id) => {
    if (!window.confirm('¿Eliminar este ítem del listado?')) return
    try { await api.delete(`/api/materiales/listados/${listadoId}/items/${id}`); cargar() } catch { alert('Error al eliminar') }
  }

  // ── Cotizaciones ─────────────────────────────────────────────────────────
  const abrirCrearCot = () => { setFormCot({ proveedor: '', tipo_factura: 'A', fecha: new Date().toISOString().slice(0, 10) }); setError(''); setModalCot(true) }

  const guardarCot = async () => {
    if (!formCot.proveedor) { setError('Ingresá el proveedor'); return }
    setGuardando(true); setError('')
    try {
      await api.post(`/api/materiales/listados/${listadoId}/cotizaciones`, formCot)
      setModalCot(false); cargar()
    } catch { setError('Error al guardar') }
    finally { setGuardando(false) }
  }

  const toggleCot = async (c) => {
    if (cotAbierta === c.id) { setCotAbierta(null); return }
    setCotAbierta(c.id)
    try { const r = await api.get(`/api/materiales/cotizaciones/${c.id}`); setDetalleCot(r.data) } catch { /* noop */ }
  }

  const eliminarCot = async (id) => {
    if (!window.confirm('¿Eliminar esta cotización y sus ítems?')) return
    try { await api.delete(`/api/materiales/cotizaciones/${id}`); cargar() } catch { alert('Error al eliminar') }
  }

  const confirmarCot = async (id) => {
    try { await api.post(`/api/materiales/cotizaciones/${id}/confirmar`); cargar() } catch { alert('Error al confirmar') }
  }

  const abrirItemCot = (c) => {
    setFormItemCot({ designacion: '', unidad: '', cantidad: '', precio_unitario_factura: '' })
    setError(''); setModalItemCot(c)
  }

  const guardarItemCot = async () => {
    if (!formItemCot.designacion || !formItemCot.precio_unitario_factura) { setError('Completá designación y precio'); return }
    setGuardando(true); setError('')
    try {
      await api.post(`/api/materiales/cotizaciones/${modalItemCot.id}/items`, {
        designacion: formItemCot.designacion, unidad: formItemCot.unidad || null,
        cantidad: formItemCot.cantidad === '' ? 0 : Number(formItemCot.cantidad),
        precio_unitario_factura: Number(formItemCot.precio_unitario_factura),
      })
      setModalItemCot(null)
      cargar()
      const r = await api.get(`/api/materiales/cotizaciones/${modalItemCot.id}`)
      setDetalleCot(r.data)
    } catch { setError('Error al guardar') }
    finally { setGuardando(false) }
  }

  const eliminarItemCot = async (cotId, itemId) => {
    try {
      await api.delete(`/api/materiales/cotizaciones/${cotId}/items/${itemId}`)
      cargar()
      const r = await api.get(`/api/materiales/cotizaciones/${cotId}`)
      setDetalleCot(r.data)
    } catch { alert('Error al eliminar') }
  }

  const elegirGanadora = async (cotizacionId) => {
    try { await api.post(`/api/materiales/listados/${listadoId}/elegir-ganadora`, { cotizacion_id: cotizacionId }); cargar() }
    catch { alert('Error al elegir ganadora') }
  }

  if (loading) return <div style={s.empty}>Cargando...</div>
  if (!listado) return <div style={s.empty}>No se encontró el listado</div>

  return (
    <div>
      <button onClick={onVolver} style={s.btnVolver}>← Materiales</button>

      <div style={s.encabezado}>
        <h2 style={s.titulo}>{listado.nombre}</h2>
        {listado.notas && <div style={s.notas}>{listado.notas}</div>}
      </div>

      {/* Ítems del listado */}
      <div style={s.seccion}>
        <div style={s.seccionHeader}>
          <div style={s.seccionTitulo}>Ítems del listado</div>
          <button onClick={abrirCrearItem} style={s.btnSecPrimario}>+ Nuevo ítem</button>
        </div>
        {listado.items.length === 0 ? (
          <div style={s.emptyChico}>Todavía no hay ítems cargados.</div>
        ) : (
          <div style={s.itemsLista}>
            {listado.items.map(it => (
              <div key={it.id} style={s.itemCard}>
                <div style={s.itemInfo}>
                  <span style={s.itemNombre}>{it.designacion}</span>
                  <span style={s.itemSub}>{it.unidad || ''} · Pedido: {Number(it.cantidad_pedida)}</span>
                </div>
                <div style={s.itemEntrega}>
                  <label style={s.itemEntregaLabel}>Entregado</label>
                  <input
                    type="number"
                    style={s.itemEntregaInput}
                    defaultValue={Number(it.cantidad_entregada)}
                    onBlur={e => actualizarEntrega(it, e.target.value)}
                  />
                  <span style={{ ...s.saldoTag, ...(Number(it.saldo) > 0 ? s.saldoPendiente : s.saldoCompleto) }}>
                    Saldo: {Number(it.saldo)}
                  </span>
                </div>
                <button onClick={() => eliminarItem(it.id)} style={s.btnEliminarItem}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Comparativa */}
      {comparativa && comparativa.filas.length > 0 && (
        <div style={s.seccion}>
          <div style={s.seccionTitulo}>Comparativa (sin IVA — decisión por total del paquete)</div>
          <div style={s.comparativaLista}>
            {comparativa.filas.map(f => (
              <div key={f.cotizacion_id} style={{ ...s.compFila, ...(f.ganadora ? s.compFilaGanadora : {}) }}>
                <div style={s.compInfo}>
                  <span style={s.compProveedor}>{f.proveedor}</span>
                  {f.ganadora && <span style={s.badgeGanadora}>★ Elegida</span>}
                  {f.alerta && <span style={s.badgeAlertaComp}>⚠ {fmtPct(f.pct_dispersion)}</span>}
                  <div style={s.compSub}>Fact. {f.tipo_factura} · {fmtFecha(f.fecha)} · {f.estado === 'confirmada' ? 'Confirmada' : 'Pendiente de revisión'}</div>
                </div>
                <div style={s.compDerecha}>
                  <div style={s.compTotal}>{fmt(f.total_sin_iva)}</div>
                  {!f.ganadora && (
                    <button onClick={() => elegirGanadora(f.cotizacion_id)} style={s.btnMini}>Elegir</button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div style={s.compPromedio}>Promedio: {fmt(comparativa.promedio_sin_iva)} · Alerta si la diferencia supera ±10%</div>
        </div>
      )}

      {/* Cotizaciones */}
      <div style={s.seccion}>
        <div style={s.seccionHeader}>
          <div style={s.seccionTitulo}>Cotizaciones de proveedores</div>
          <button onClick={abrirCrearCot} style={s.btnSecPrimario}>+ Nueva cotización</button>
        </div>
        {cotizaciones.length === 0 ? (
          <div style={s.emptyChico}>Todavía no hay cotizaciones cargadas.</div>
        ) : (
          <div style={s.cotLista}>
            {cotizaciones.map(c => (
              <div key={c.id} style={s.cotCard}>
                <div style={s.cotHeader} onClick={() => toggleCot(c)}>
                  <div>
                    <span style={s.cotProveedor}>{c.proveedor}</span>
                    <span style={s.cotBadgeEstado}>{c.estado === 'confirmada' ? 'Confirmada' : 'Pendiente'}</span>
                    {c.ganadora && <span style={s.badgeGanadora}>★ Elegida</span>}
                    <div style={s.cotSub}>Factura {c.tipo_factura} · {fmtFecha(c.fecha)}</div>
                  </div>
                  <div style={s.cotTotal}>{fmt(c.total_sin_iva)}</div>
                </div>

                {cotAbierta === c.id && detalleCot && (
                  <div style={s.cotDetalle}>
                    {detalleCot.items.length === 0 ? (
                      <div style={s.emptyChico}>Sin ítems cargados todavía.</div>
                    ) : (
                      detalleCot.items.map(it => (
                        <div key={it.id} style={s.itemCotFila}>
                          <span style={s.itemCotNombre}>{it.designacion} {it.confianza_baja && <span title="Confianza baja">⚠️</span>}</span>
                          <span style={s.itemCotDetalle}>{Number(it.cantidad)} {it.unidad || ''} × {fmt(it.precio_unitario_factura)} → {fmt(it.precio_unitario_sin_iva)} sin IVA</span>
                          <span style={s.itemCotSubtotal}>{fmt(it.subtotal_sin_iva)}</span>
                          <button onClick={() => eliminarItemCot(c.id, it.id)} style={s.btnEliminarItem}>✕</button>
                        </div>
                      ))
                    )}
                    <div style={s.cotAcciones}>
                      <button onClick={() => abrirItemCot(c)} style={s.btnMini}>+ Agregar ítem</button>
                      {c.estado !== 'confirmada' && (
                        <button onClick={() => confirmarCot(c.id)} style={{ ...s.btnMini, color: '#16a34a', borderColor: '#16a34a' }}>Confirmar</button>
                      )}
                      <button onClick={() => eliminarCot(c.id)} style={{ ...s.btnMini, color: '#dc2626' }}>Eliminar cotización</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <div style={s.hint}>Factura A: se divide por 1,21 para comparar sin IVA. Factura C: el precio ya se toma como final/comparable.</div>
      </div>

      {/* Modal: nuevo ítem del listado */}
      {modalItem !== null && (
        <div style={s.overlay} onClick={() => setModalItem(null)}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitulo}>Nuevo ítem</h3>
              <button onClick={() => setModalItem(null)} style={s.btnCerrar}>✕</button>
            </div>
            <div style={s.modalBody}>
              <div style={s.grid}>
                <div style={s.fullWidth}>
                  <label style={s.label}>Designación <span style={{ color: '#D4502A' }}>*</span></label>
                  <input style={s.input} value={formItem.designacion} autoFocus onChange={e => setFormItem({ ...formItem, designacion: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Unidad</label>
                  <input style={s.input} value={formItem.unidad} onChange={e => setFormItem({ ...formItem, unidad: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Cantidad pedida</label>
                  <input type="number" style={s.input} value={formItem.cantidad_pedida} onChange={e => setFormItem({ ...formItem, cantidad_pedida: e.target.value })} />
                </div>
              </div>
              {error && <div style={s.errorMsg}>{error}</div>}
            </div>
            <div style={s.modalFooter}>
              <button onClick={() => setModalItem(null)} style={s.btnSecundario}>Cancelar</button>
              <button onClick={guardarItem} style={s.btnPrimario} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: nueva cotización */}
      {modalCot && (
        <div style={s.overlay} onClick={() => setModalCot(false)}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitulo}>Nueva cotización</h3>
              <button onClick={() => setModalCot(false)} style={s.btnCerrar}>✕</button>
            </div>
            <div style={s.modalBody}>
              <div style={s.grid}>
                <div style={s.fullWidth}>
                  <label style={s.label}>Proveedor <span style={{ color: '#D4502A' }}>*</span></label>
                  <input style={s.input} value={formCot.proveedor} autoFocus onChange={e => setFormCot({ ...formCot, proveedor: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Tipo de factura</label>
                  <select style={s.input} value={formCot.tipo_factura} onChange={e => setFormCot({ ...formCot, tipo_factura: e.target.value })}>
                    {TIPOS_FACTURA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={s.label}>Fecha</label>
                  <input type="date" style={s.input} value={formCot.fecha} onChange={e => setFormCot({ ...formCot, fecha: e.target.value })} />
                </div>
              </div>
              {error && <div style={s.errorMsg}>{error}</div>}
            </div>
            <div style={s.modalFooter}>
              <button onClick={() => setModalCot(false)} style={s.btnSecundario}>Cancelar</button>
              <button onClick={guardarCot} style={s.btnPrimario} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: agregar ítem a cotización */}
      {modalItemCot !== null && (
        <div style={s.overlay} onClick={() => setModalItemCot(null)}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitulo}>Agregar ítem — {modalItemCot.proveedor}</h3>
              <button onClick={() => setModalItemCot(null)} style={s.btnCerrar}>✕</button>
            </div>
            <div style={s.modalBody}>
              <div style={s.grid}>
                <div style={s.fullWidth}>
                  <label style={s.label}>Designación <span style={{ color: '#D4502A' }}>*</span></label>
                  <input style={s.input} value={formItemCot.designacion} autoFocus onChange={e => setFormItemCot({ ...formItemCot, designacion: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Unidad</label>
                  <input style={s.input} value={formItemCot.unidad} onChange={e => setFormItemCot({ ...formItemCot, unidad: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Cantidad</label>
                  <input type="number" style={s.input} value={formItemCot.cantidad} onChange={e => setFormItemCot({ ...formItemCot, cantidad: e.target.value })} />
                </div>
                <div style={s.fullWidth}>
                  <label style={s.label}>Precio unitario (según factura) <span style={{ color: '#D4502A' }}>*</span></label>
                  <input type="number" style={s.input} value={formItemCot.precio_unitario_factura} onChange={e => setFormItemCot({ ...formItemCot, precio_unitario_factura: e.target.value })} />
                </div>
              </div>
              {error && <div style={s.errorMsg}>{error}</div>}
            </div>
            <div style={s.modalFooter}>
              <button onClick={() => setModalItemCot(null)} style={s.btnSecundario}>Cancelar</button>
              <button onClick={guardarItemCot} style={s.btnPrimario} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  btnVolver:      { background: 'none', border: 'none', color: '#D4502A', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0, marginBottom: 16 },
  encabezado:     { marginBottom: 20 },
  titulo:         { fontSize: 20, fontWeight: 700, color: '#111', margin: 0 },
  notas:          { fontSize: 13, color: '#888', marginTop: 6 },
  seccion:        { background: '#fff', borderRadius: 4, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: '16px 20px', marginBottom: 16 },
  seccionHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  seccionTitulo:  { fontSize: 13, fontWeight: 700, color: '#111', textTransform: 'uppercase', letterSpacing: '0.03em' },
  btnSecPrimario: { background: '#D4502A', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 3, cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  emptyChico:     { textAlign: 'center', color: '#aaa', padding: 16, fontSize: 12.5 },
  itemsLista:     { display: 'flex', flexDirection: 'column', gap: 6 },
  itemCard:       { display: 'flex', alignItems: 'center', gap: 12, border: '1px solid #eee', borderRadius: 3, padding: '8px 12px' },
  itemInfo:       { flex: 1, display: 'flex', flexDirection: 'column' },
  itemNombre:     { fontSize: 13, fontWeight: 600, color: '#111' },
  itemSub:        { fontSize: 11, color: '#999', marginTop: 2 },
  itemEntrega:    { display: 'flex', alignItems: 'center', gap: 6 },
  itemEntregaLabel: { fontSize: 10, color: '#999' },
  itemEntregaInput: { width: 60, padding: '4px 6px', border: '1px solid #ddd', borderRadius: 3, fontSize: 12 },
  saldoTag:       { fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 },
  saldoPendiente: { color: '#b45309', background: '#fefce8' },
  saldoCompleto:  { color: '#16a34a', background: '#f0fdf4' },
  btnEliminarItem:{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 13 },
  comparativaLista: { display: 'flex', flexDirection: 'column', gap: 8 },
  compFila:       { display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #eee', borderRadius: 3, padding: '10px 14px' },
  compFilaGanadora: { borderColor: '#16a34a', background: '#f0fdf4' },
  compInfo:       { display: 'flex', flexDirection: 'column' },
  compProveedor:  { fontSize: 13, fontWeight: 700, color: '#111', marginRight: 8 },
  compSub:        { fontSize: 11, color: '#999', marginTop: 2 },
  compDerecha:    { display: 'flex', alignItems: 'center', gap: 10 },
  compTotal:      { fontSize: 15, fontWeight: 700, color: '#111' },
  compPromedio:   { fontSize: 11, color: '#999', marginTop: 10 },
  badgeGanadora:  { fontSize: 10, fontWeight: 700, color: '#16a34a', background: '#f0fdf4', padding: '2px 8px', borderRadius: 20, marginRight: 6 },
  badgeAlertaComp:{ fontSize: 10, fontWeight: 700, color: '#dc2626', background: '#fef2f2', padding: '2px 8px', borderRadius: 20 },
  cotLista:       { display: 'flex', flexDirection: 'column', gap: 8 },
  cotCard:        { border: '1px solid #eee', borderRadius: 4, overflow: 'hidden' },
  cotHeader:      { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', cursor: 'pointer', background: '#fafafa' },
  cotProveedor:   { fontSize: 13, fontWeight: 700, color: '#111', marginRight: 8 },
  cotBadgeEstado: { fontSize: 10, fontWeight: 700, color: '#666', background: '#eee', padding: '2px 8px', borderRadius: 20 },
  cotSub:         { fontSize: 11, color: '#999', marginTop: 2 },
  cotTotal:       { fontSize: 14, fontWeight: 700, color: '#111' },
  cotDetalle:     { padding: '10px 14px', borderTop: '1px solid #f2f2f2' },
  itemCotFila:    { display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid #f7f7f7', fontSize: 12 },
  itemCotNombre:  { fontWeight: 600, color: '#111', minWidth: 100 },
  itemCotDetalle: { flex: 1, color: '#888', fontSize: 11 },
  itemCotSubtotal:{ fontWeight: 700, color: '#111' },
  cotAcciones:    { display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' },
  btnMini:        { background: 'none', border: '1px solid #ddd', color: '#555', padding: '3px 10px', borderRadius: 3, cursor: 'pointer', fontSize: 11.5 },
  hint:           { fontSize: 11, color: '#999', marginTop: 10 },
  empty:          { textAlign: 'center', color: '#aaa', padding: 30, background: '#fff', borderRadius: 4, border: '1px dashed #ddd', fontSize: 13 },
  overlay:        { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalCard:      { background: '#fff', borderRadius: 4, width: '100%', maxWidth: 520, boxShadow: '0 8px 40px rgba(0,0,0,0.2)', overflow: 'hidden', maxHeight: '90vh', overflowY: 'auto' },
  modalHeader:    { padding: '16px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 1 },
  modalTitulo:    { fontSize: 15, fontWeight: 700, margin: 0, color: '#111' },
  btnCerrar:      { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888' },
  modalBody:      { padding: '20px' },
  grid:           { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' },
  fullWidth:      { gridColumn: '1 / -1' },
  label:          { display: 'block', fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' },
  input:          { width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 3, fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  errorMsg:       { marginTop: 12, background: '#fff5f5', border: '1px solid #fca5a5', color: '#dc2626', padding: '8px 12px', borderRadius: 3, fontSize: 13, borderLeft: '3px solid #dc2626' },
  modalFooter:    { padding: '14px 20px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: 10, position: 'sticky', bottom: 0, background: '#fff' },
  btnPrimario:    { background: '#D4502A', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 3, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  btnSecundario:  { background: '#fff', color: '#333', border: '1px solid #ddd', padding: '8px 16px', borderRadius: 3, cursor: 'pointer', fontSize: 13 },
}
