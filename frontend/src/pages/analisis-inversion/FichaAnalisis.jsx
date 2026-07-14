import { useState, useEffect, useRef } from 'react'
import api from '../../utils/api'

function fmt(n) {
  if (n === null || n === undefined) return '—'
  return '$ ' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtUsd(n) {
  if (n === null || n === undefined) return '—'
  return 'USD ' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const FUENTE_LABEL = {
  banco:       { texto: 'Banco de precios', color: '#16a34a', bg: '#f0fdf4' },
  manual:      { texto: 'Precio manual', color: '#D4502A', bg: '#fff4f1' },
  sin_precio:  { texto: 'Sin precio', color: '#999', bg: '#f2f2f2' },
}

export default function FichaAnalisis({ analisisId, onVolver }) {
  const [analisis, setAnalisis] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fechaCalculo, setFechaCalculo] = useState('')
  const [subiendo, setSubiendo] = useState(false)
  const [resultadoImport, setResultadoImport] = useState(null)
  const fileInputRef = useRef(null)

  const [modalItem, setModalItem] = useState(null)  // 'crear' | item a editar
  const [formItem, setFormItem] = useState({ designacion: '', unidad: '', cantidad: '', pct_adicional: '', categoria: '', precio_unitario_manual: '' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const cargar = async () => {
    setLoading(true)
    try {
      const r = await api.get(`/api/analisis-inversion/${analisisId}`)
      setAnalisis(r.data)
      setFechaCalculo(r.data.fecha_calculo || '')
    } catch { /* noop */ } finally { setLoading(false) }
  }
  useEffect(() => { cargar() }, [analisisId])

  const aplicarFecha = async (usarActual) => {
    try {
      await api.put(`/api/analisis-inversion/${analisisId}`, { fecha_calculo: usarActual ? null : (fechaCalculo || null) })
      cargar()
    } catch { alert('Error al actualizar la fecha') }
  }

  const subirExcel = async (e) => {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    setSubiendo(true); setResultadoImport(null)
    try {
      const fd = new FormData()
      fd.append('archivo', archivo)
      const r = await api.post(`/api/analisis-inversion/${analisisId}/importar-excel`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResultadoImport(r.data)
      cargar()
    } catch (err) {
      alert(err?.response?.data?.detail || 'Error al importar el Excel')
    } finally {
      setSubiendo(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const abrirCrearItem = () => {
    setFormItem({ designacion: '', unidad: '', cantidad: '', pct_adicional: '', categoria: '', precio_unitario_manual: '' })
    setError(''); setModalItem('crear')
  }

  const abrirEditarItem = (it) => {
    setFormItem({
      designacion: it.designacion, unidad: it.unidad || '', cantidad: it.cantidad,
      pct_adicional: it.pct_adicional, categoria: it.categoria || '',
      precio_unitario_manual: it.precio_unitario_manual ?? '',
    })
    setError(''); setModalItem(it)
  }

  const guardarItem = async () => {
    if (!formItem.designacion) { setError('Ingresá la designación'); return }
    setGuardando(true); setError('')
    try {
      const payload = {
        designacion: formItem.designacion, unidad: formItem.unidad || null,
        cantidad: formItem.cantidad === '' ? 0 : Number(formItem.cantidad),
        pct_adicional: formItem.pct_adicional === '' ? 0 : Number(formItem.pct_adicional),
        categoria: formItem.categoria || null,
        precio_unitario_manual: formItem.precio_unitario_manual === '' ? null : Number(formItem.precio_unitario_manual),
      }
      if (modalItem === 'crear') {
        await api.post(`/api/analisis-inversion/${analisisId}/items`, payload)
      } else {
        await api.put(`/api/analisis-inversion/${analisisId}/items/${modalItem.id}`, payload)
      }
      setModalItem(null); cargar()
    } catch { setError('Error al guardar') }
    finally { setGuardando(false) }
  }

  const eliminarItem = async (id) => {
    if (!window.confirm('¿Eliminar este ítem?')) return
    try { await api.delete(`/api/analisis-inversion/${analisisId}/items/${id}`); cargar() } catch { alert('Error al eliminar') }
  }

  if (loading) return <div style={s.empty}>Cargando...</div>
  if (!analisis) return <div style={s.empty}>No se encontró el análisis</div>

  return (
    <div>
      <button onClick={onVolver} style={s.btnVolver}>← Análisis de Inversión</button>

      <div style={s.encabezado}>
        <h2 style={s.titulo}>{analisis.nombre}</h2>
      </div>

      {/* Fecha de cálculo */}
      <div style={s.seccion}>
        <div style={s.seccionTitulo}>Fecha de cálculo</div>
        <div style={s.fechaFila}>
          <button onClick={() => aplicarFecha(true)} style={{ ...s.btnToggle, ...(!analisis.fecha_calculo ? s.btnToggleActivo : {}) }}>
            Precios actuales
          </button>
          <input type="date" style={s.inputFecha} value={fechaCalculo} onChange={e => setFechaCalculo(e.target.value)} />
          <button onClick={() => aplicarFecha(false)} style={s.btnAplicarFecha} disabled={!fechaCalculo}>Calcular a esta fecha</button>
        </div>
        {analisis.fecha_calculo && <div style={s.hint}>Calculando con los precios vigentes al {new Date(analisis.fecha_calculo + 'T00:00:00').toLocaleDateString('es-AR')}.</div>}
      </div>

      {/* Resumen */}
      <div style={s.resumenGrid}>
        <div style={s.resumenCard}>
          <div style={s.resumenLabel}>Total en pesos</div>
          <div style={s.resumenValor}>{fmt(analisis.total_pesos)}</div>
        </div>
        <div style={s.resumenCard}>
          <div style={s.resumenLabel}>Total en USD</div>
          <div style={s.resumenValor}>{fmtUsd(analisis.total_usd)}</div>
        </div>
        <div style={s.resumenCard}>
          <div style={s.resumenLabel}>Ítems sin precio</div>
          <div style={{ ...s.resumenValor, color: analisis.items_sin_precio > 0 ? '#dc2626' : '#111' }}>{analisis.items_sin_precio}</div>
        </div>
        <div style={s.resumenCard}>
          <div style={s.resumenLabel}>Precios desactualizados</div>
          <div style={{ ...s.resumenValor, color: analisis.items_desactualizados > 0 ? '#b45309' : '#111' }}>{analisis.items_desactualizados}</div>
        </div>
      </div>

      {/* Desglose por rubro */}
      {analisis.por_rubro.length > 0 && (
        <div style={s.seccion}>
          <div style={s.seccionTitulo}>Desglose por rubro</div>
          <div style={s.rubroLista}>
            {analisis.por_rubro.map(r => (
              <div key={r.rubro} style={s.rubroFila}>
                <span style={s.rubroNombre}>{r.rubro}</span>
                <span style={s.rubroMonto}>{fmt(r.total_pesos)}{r.total_usd != null ? ` · ${fmtUsd(r.total_usd)}` : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Importar Excel */}
      <div style={s.seccion}>
        <div style={s.seccionTitulo}>Importar cómputo (Excel)</div>
        <div style={s.hint}>El archivo debe tener columnas de Designación y Cantidad (y opcionalmente Unidad y % Adicional) en alguna de las primeras filas.</div>
        <input ref={fileInputRef} type="file" accept=".xlsx" onChange={subirExcel} style={{ marginTop: 10 }} disabled={subiendo} />
        {subiendo && <div style={s.hint}>Importando...</div>}
        {resultadoImport && (
          <div style={s.importResultado}>
            <div>✓ {resultadoImport.items_creados} ítems creados{resultadoImport.filas_omitidas > 0 ? `, ${resultadoImport.filas_omitidas} filas omitidas` : ''}.</div>
            {resultadoImport.avisos.map((a, i) => <div key={i} style={s.avisoImport}>⚠ {a}</div>)}
          </div>
        )}
      </div>

      {/* Ítems */}
      <div style={s.seccion}>
        <div style={s.seccionHeader}>
          <div style={s.seccionTitulo}>Ítems ({analisis.items.length})</div>
          <button onClick={abrirCrearItem} style={s.btnSecPrimario}>+ Nuevo ítem</button>
        </div>
        {analisis.items.length === 0 ? (
          <div style={s.emptyChico}>Todavía no hay ítems. Importá un Excel o cargalos a mano.</div>
        ) : (
          <div style={s.itemsLista}>
            {analisis.items.map(it => {
              const fuente = FUENTE_LABEL[it.fuente_precio] || FUENTE_LABEL.sin_precio
              return (
                <div key={it.id} style={s.itemCard}>
                  <div style={s.itemInfo}>
                    <div style={s.itemNombreFila}>
                      <span style={s.itemNombre}>{it.designacion}</span>
                      <span style={{ ...s.badgeFuente, color: fuente.color, background: fuente.bg }}>{fuente.texto}</span>
                      {it.desactualizado && <span style={s.badgeDesact}>⚠ {it.dias_sin_actualizar}d</span>}
                    </div>
                    <div style={s.itemSub}>
                      {Number(it.cantidad)} {it.unidad || ''}
                      {Number(it.pct_adicional) > 0 ? ` · +${Number(it.pct_adicional)}% adicional` : ''}
                      {it.categoria ? ` · ${it.categoria}` : ''}
                      {it.precio_unitario_usado != null ? ` · ${fmt(it.precio_unitario_usado)}/u` : ''}
                    </div>
                  </div>
                  <div style={s.itemDerecha}>
                    <div style={s.itemSubtotal}>{fmt(it.subtotal_pesos)}</div>
                    <div style={s.itemAcciones}>
                      <button onClick={() => abrirEditarItem(it)} style={s.btnMini}>Editar</button>
                      <button onClick={() => eliminarItem(it.id)} style={{ ...s.btnMini, color: '#dc2626' }}>Eliminar</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal: crear/editar ítem */}
      {modalItem !== null && (
        <div style={s.overlay} onClick={() => setModalItem(null)}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitulo}>{modalItem === 'crear' ? 'Nuevo ítem' : 'Editar ítem'}</h3>
              <button onClick={() => setModalItem(null)} style={s.btnCerrar}>✕</button>
            </div>
            <div style={s.modalBody}>
              <div style={s.grid}>
                <div style={s.fullWidth}>
                  <label style={s.label}>Designación <span style={{ color: '#D4502A' }}>*</span></label>
                  <input style={s.input} value={formItem.designacion} autoFocus onChange={e => setFormItem({ ...formItem, designacion: e.target.value })} />
                  <div style={s.hintChico}>Si coincide con un nombre del Banco de Precios, se cruza automáticamente.</div>
                </div>
                <div>
                  <label style={s.label}>Unidad</label>
                  <input style={s.input} value={formItem.unidad} onChange={e => setFormItem({ ...formItem, unidad: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Cantidad</label>
                  <input type="number" style={s.input} value={formItem.cantidad} onChange={e => setFormItem({ ...formItem, cantidad: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>% Adicional</label>
                  <input type="number" style={s.input} value={formItem.pct_adicional} onChange={e => setFormItem({ ...formItem, pct_adicional: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Rubro (opcional)</label>
                  <input style={s.input} value={formItem.categoria} onChange={e => setFormItem({ ...formItem, categoria: e.target.value })} />
                </div>
                <div style={s.fullWidth}>
                  <label style={s.label}>Precio unitario manual</label>
                  <input type="number" style={s.input} value={formItem.precio_unitario_manual}
                    placeholder="Solo si no hay match en el Banco de Precios"
                    onChange={e => setFormItem({ ...formItem, precio_unitario_manual: e.target.value })} />
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
    </div>
  )
}

const s = {
  btnVolver:      { background: 'none', border: 'none', color: '#D4502A', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0, marginBottom: 16 },
  encabezado:     { marginBottom: 20 },
  titulo:         { fontSize: 20, fontWeight: 700, color: '#111', margin: 0 },
  seccion:        { background: '#fff', borderRadius: 4, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: '16px 20px', marginBottom: 16 },
  seccionHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  seccionTitulo:  { fontSize: 13, fontWeight: 700, color: '#111', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 10 },
  fechaFila:      { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  btnToggle:      { background: '#f5f5f5', color: '#555', border: '1px solid #ddd', padding: '7px 14px', borderRadius: 3, cursor: 'pointer', fontSize: 12.5 },
  btnToggleActivo:{ background: '#D4502A', color: '#fff', borderColor: '#D4502A' },
  inputFecha:     { padding: '7px 10px', border: '1px solid #ddd', borderRadius: 3, fontSize: 13 },
  btnAplicarFecha:{ background: '#fff', border: '1px solid #D4502A', color: '#D4502A', padding: '7px 14px', borderRadius: 3, cursor: 'pointer', fontSize: 12.5, fontWeight: 600 },
  hint:           { fontSize: 11, color: '#999', marginTop: 8 },
  hintChico:      { fontSize: 10.5, color: '#aaa', marginTop: 3 },
  resumenGrid:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 },
  resumenCard:    { background: '#fff', borderRadius: 4, padding: '12px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
  resumenLabel:   { fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 4 },
  resumenValor:   { fontSize: 18, fontWeight: 700, color: '#111' },
  rubroLista:     { display: 'flex', flexDirection: 'column', gap: 6 },
  rubroFila:      { display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f2f2f2', fontSize: 13 },
  rubroNombre:    { fontWeight: 600, color: '#111' },
  rubroMonto:     { color: '#555' },
  importResultado:{ marginTop: 12, background: '#f9f9f9', borderRadius: 3, padding: '10px 12px', fontSize: 12 },
  avisoImport:    { color: '#b45309', marginTop: 4 },
  emptyChico:     { textAlign: 'center', color: '#aaa', padding: 16, fontSize: 12.5 },
  itemsLista:     { display: 'flex', flexDirection: 'column', gap: 8 },
  itemCard:       { display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #eee', borderRadius: 3, padding: '10px 14px', gap: 12 },
  itemInfo:       { flex: 1, minWidth: 0 },
  itemNombreFila: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  itemNombre:     { fontSize: 13, fontWeight: 700, color: '#111' },
  badgeFuente:    { fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 20 },
  badgeDesact:    { fontSize: 9.5, fontWeight: 700, color: '#b45309', background: '#fefce8', padding: '2px 7px', borderRadius: 20 },
  itemSub:        { fontSize: 11.5, color: '#888', marginTop: 3 },
  itemDerecha:    { textAlign: 'right', flexShrink: 0 },
  itemSubtotal:   { fontSize: 14, fontWeight: 700, color: '#111' },
  itemAcciones:   { display: 'flex', gap: 4, marginTop: 5 },
  btnSecPrimario: { background: '#D4502A', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 3, cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  btnMini:        { background: 'none', border: '1px solid #ddd', color: '#555', padding: '3px 9px', borderRadius: 3, cursor: 'pointer', fontSize: 11 },
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
