import { useState, useEffect, useRef } from 'react'
import api from '../../utils/api'

const EMPTY_MOV = { fecha: '', tipo: 'cargo', monto_cliente: '', monto_albanil: '', concepto: '', es_ajuste_ipc: false }
const EMPTY_IPC = { fecha: '', ipc_pct: '', cuenta: 'ambas', fuente: 'estimado' }

function fmt(n) {
  if (n === null || n === undefined) return '—'
  return '$ ' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtFecha(iso) {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR')
}

export default function CronogramaPagos({ clienteId, obraId, ipcEstimado, onCambio }) {
  const [movimientos, setMovimientos] = useState([])
  const [resumen, setResumen] = useState(null)
  const [loading, setLoading] = useState(true)

  const [modalMov, setModalMov] = useState(null)   // 'crear' | movimiento a editar | null
  const [formMov, setFormMov] = useState(EMPTY_MOV)
  const [modalIPC, setModalIPC] = useState(false)
  const [formIPC, setFormIPC] = useState(EMPTY_IPC)

  const [subiendoExcel, setSubiendoExcel] = useState(false)
  const [resultadoExcel, setResultadoExcel] = useState(null)
  const fileInputRef = useRef(null)

  const [guardando, setGuardando] = useState(false)
  const [errorModal, setErrorModal] = useState('')

  const base = `/api/clientes/${clienteId}/obras/${obraId}/cronograma`

  const cargar = async () => {
    setLoading(true)
    try {
      const [rm, rr] = await Promise.all([
        api.get(base),
        api.get(`${base}/resumen`),
      ])
      setMovimientos(rm.data)
      setResumen(rr.data)
    } catch { /* noop */ } finally { setLoading(false) }
  }
  useEffect(() => { cargar() }, [obraId])

  // ── Movimientos: crear / editar / eliminar ───────────────────────────────
  const abrirCrear = () => {
    setFormMov({ ...EMPTY_MOV, fecha: new Date().toISOString().slice(0, 10) })
    setErrorModal(''); setModalMov('crear')
  }
  const abrirEditar = (m) => {
    setFormMov({
      fecha: m.fecha, tipo: m.tipo, monto_cliente: m.monto_cliente, monto_albanil: m.monto_albanil,
      concepto: m.concepto || '', es_ajuste_ipc: m.es_ajuste_ipc,
    })
    setErrorModal(''); setModalMov(m)
  }
  const cerrarMov = () => { setModalMov(null); setErrorModal('') }

  const guardarMov = async () => {
    if (!formMov.fecha) { setErrorModal('Ingresá la fecha'); return }
    setGuardando(true); setErrorModal('')
    try {
      const payload = {
        fecha: formMov.fecha, tipo: formMov.tipo,
        monto_cliente: formMov.monto_cliente === '' ? 0 : Number(formMov.monto_cliente),
        monto_albanil: formMov.monto_albanil === '' ? 0 : Number(formMov.monto_albanil),
        concepto: formMov.concepto || null,
        es_ajuste_ipc: formMov.es_ajuste_ipc,
      }
      if (modalMov === 'crear') {
        await api.post(base, payload)
      } else {
        await api.put(`${base}/${modalMov.id}`, payload)
      }
      cerrarMov(); cargar(); onCambio?.()
    } catch (e) {
      setErrorModal(e?.response?.data?.detail || 'Error al guardar')
    } finally { setGuardando(false) }
  }

  const eliminarMov = async (id) => {
    if (!window.confirm('¿Eliminar este movimiento?')) return
    try {
      await api.delete(`${base}/${id}`)
      cargar(); onCambio?.()
    } catch { alert('Error al eliminar') }
  }

  // ── Ajustar IPC (sobre el saldo total) ───────────────────────────────────
  const abrirIPC = () => {
    setFormIPC({ fecha: new Date().toISOString().slice(0, 10), ipc_pct: ipcEstimado ?? '', cuenta: 'ambas', fuente: 'estimado' })
    setErrorModal(''); setModalIPC(true)
  }
  const cerrarIPC = () => { setModalIPC(false); setErrorModal('') }

  const confirmarIPC = async () => {
    if (!formIPC.ipc_pct || !formIPC.fecha) { setErrorModal('Completá la fecha y el porcentaje'); return }
    setGuardando(true); setErrorModal('')
    try {
      await api.post(`${base}/ajustar-ipc`, {
        fecha: formIPC.fecha, ipc_pct: Number(formIPC.ipc_pct), cuenta: formIPC.cuenta, fuente: formIPC.fuente,
      })
      cerrarIPC(); cargar(); onCambio?.()
    } catch (e) {
      setErrorModal(e?.response?.data?.detail || 'Error al aplicar el ajuste')
    } finally { setGuardando(false) }
  }

  // ── Importar Excel ────────────────────────────────────────────────────────
  const subirExcel = async (e) => {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    setSubiendoExcel(true); setResultadoExcel(null)
    try {
      const fd = new FormData()
      fd.append('archivo', archivo)
      const r = await api.post(`${base}/importar-excel`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResultadoExcel(r.data)
      cargar(); onCambio?.()
    } catch (err) {
      alert(err?.response?.data?.detail || 'Error al importar el Excel')
    } finally {
      setSubiendoExcel(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div style={s.seccion}>
      <div style={s.seccionHeader}>
        <div style={s.seccionTitulo}>Cronograma de pagos (cuenta corriente)</div>
        <div style={s.accionesHeader}>
          <button onClick={() => fileInputRef.current?.click()} style={s.btnImportar} disabled={subiendoExcel}>
            {subiendoExcel ? 'Importando...' : '📄 Importar Excel'}
          </button>
          <input ref={fileInputRef} type="file" accept=".xlsx" onChange={subirExcel} style={{ display: 'none' }} />
          <button onClick={abrirIPC} style={s.btnSecundarioChico}>Ajustar IPC</button>
          <button onClick={abrirCrear} style={s.btnPrimarioChico}>+ Nuevo movimiento</button>
        </div>
      </div>

      {resultadoExcel && (
        <div style={s.resultadoExcel}>
          <div>✓ {resultadoExcel.movimientos_creados} movimientos importados{resultadoExcel.filas_omitidas > 0 ? `, ${resultadoExcel.filas_omitidas} filas omitidas` : ''}.</div>
          {resultadoExcel.avisos.map((a, i) => <div key={i} style={s.avisoExcel}>⚠ {a}</div>)}
        </div>
      )}
      <div style={s.hintExcel}>
        El Excel necesita columnas <b>Fecha</b> y al menos una de <b>Presupuesto</b> (cargo) / <b>Pagos</b>, y opcionalmente Observaciones. La columna "Resto" se recalcula sola.
      </div>

      {resumen && (
        <div style={s.resumenMiniGrid}>
          <div style={s.resumenMiniCard}>
            <div style={s.resumenMiniLabel}>Cargos (cliente)</div>
            <div style={s.resumenMiniValor}>{fmt(resumen.total_cargos_cliente)}</div>
          </div>
          <div style={s.resumenMiniCard}>
            <div style={s.resumenMiniLabel}>Pagos (cliente)</div>
            <div style={{ ...s.resumenMiniValor, color: '#16a34a' }}>{fmt(resumen.total_pagos_cliente)}</div>
          </div>
          <div style={s.resumenMiniCard}>
            <div style={s.resumenMiniLabel}>Saldo (cliente)</div>
            <div style={{ ...s.resumenMiniValor, color: '#D4502A' }}>{fmt(resumen.saldo_cliente)}</div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={s.empty}>Cargando...</div>
      ) : movimientos.length === 0 ? (
        <div style={s.empty}>Todavía no hay movimientos cargados.</div>
      ) : (
        <div style={s.lista}>
          {movimientos.map(m => (
            <div key={m.id} style={s.fila}>
              <div style={s.filaIzq}>
                <span style={{ ...s.badgeTipo, ...(m.tipo === 'cargo' ? s.badgeCargo : s.badgePago) }}>
                  {m.tipo === 'cargo' ? '+ Cargo' : '− Pago'}
                </span>
                <div style={s.filaInfo}>
                  <span style={s.filaFecha}>{fmtFecha(m.fecha)}</span>
                  {m.concepto && <span style={s.filaConcepto}> · {m.concepto}</span>}
                  {m.es_ajuste_ipc && <span style={s.badgeIPC}>IPC</span>}
                </div>
              </div>
              <div style={s.filaDer}>
                <div style={s.filaMontos}>
                  <span style={{ ...s.filaMonto, color: m.tipo === 'cargo' ? '#D4502A' : '#16a34a' }}>
                    {m.tipo === 'cargo' ? '+' : '−'}{fmt(m.monto_cliente)}
                  </span>
                  {Number(m.monto_albanil) > 0 && <span style={s.filaMontoAlbanil}>{fmt(m.monto_albanil)} albañil</span>}
                </div>
                <div style={s.filaSaldo}>saldo: {fmt(m.saldo_cliente_acumulado)}</div>
                <div style={s.filaAcciones}>
                  <button onClick={() => abrirEditar(m)} style={s.btnMini}>Editar</button>
                  <button onClick={() => eliminarMov(m.id)} style={{ ...s.btnMini, color: '#dc2626' }}>Eliminar</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={s.hintFormula}>
        El saldo pendiente es la suma de cargos menos pagos. "Ajustar IPC" aplica el porcentaje sobre el saldo total en ese momento (compuesto automáticamente, ya que arrastra los ajustes previos), y queda registrado como un cargo más.
      </div>

      {/* Modal: nuevo/editar movimiento */}
      {modalMov !== null && (
        <div style={s.overlay} onClick={cerrarMov}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitulo}>{modalMov === 'crear' ? 'Nuevo movimiento' : 'Editar movimiento'}</h3>
              <button onClick={cerrarMov} style={s.btnCerrar}>✕</button>
            </div>
            <div style={s.modalBody}>
              <div style={s.grid}>
                <div>
                  <label style={s.label}>Fecha <span style={{ color: '#D4502A' }}>*</span></label>
                  <input type="date" style={s.input} value={formMov.fecha} autoFocus
                    onChange={e => setFormMov({ ...formMov, fecha: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Tipo</label>
                  <select style={s.input} value={formMov.tipo} onChange={e => setFormMov({ ...formMov, tipo: e.target.value })}>
                    <option value="cargo">Cargo (aumenta lo debido)</option>
                    <option value="pago">Pago (reduce lo debido)</option>
                  </select>
                </div>
                <div>
                  <label style={s.label}>Monto cliente ($)</label>
                  <input type="number" style={s.input} value={formMov.monto_cliente}
                    onChange={e => setFormMov({ ...formMov, monto_cliente: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Monto albañil ($)</label>
                  <input type="number" style={s.input} value={formMov.monto_albanil}
                    onChange={e => setFormMov({ ...formMov, monto_albanil: e.target.value })} />
                </div>
                <div style={s.fullWidth}>
                  <label style={s.label}>Concepto</label>
                  <input style={s.input} value={formMov.concepto} placeholder="Ej: Anticipo, Instalación de cloacas etapa 1..."
                    onChange={e => setFormMov({ ...formMov, concepto: e.target.value })} />
                </div>
                <div style={s.fullWidth}>
                  <label style={s.checkboxLabel}>
                    <input type="checkbox" checked={formMov.es_ajuste_ipc}
                      onChange={e => setFormMov({ ...formMov, es_ajuste_ipc: e.target.checked })} />
                    Es un ajuste por IPC
                  </label>
                </div>
              </div>
              {errorModal && <div style={s.errorMsg}>{errorModal}</div>}
            </div>
            <div style={s.modalFooter}>
              <button onClick={cerrarMov} style={s.btnSecundario}>Cancelar</button>
              <button onClick={guardarMov} style={s.btnPrimario} disabled={guardando}>
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: ajustar IPC */}
      {modalIPC && (
        <div style={s.overlay} onClick={cerrarIPC}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitulo}>Ajustar IPC sobre el saldo total</h3>
              <button onClick={cerrarIPC} style={s.btnCerrar}>✕</button>
            </div>
            <div style={s.modalBody}>
              <div style={s.grid}>
                <div>
                  <label style={s.label}>Fecha <span style={{ color: '#D4502A' }}>*</span></label>
                  <input type="date" style={s.input} value={formIPC.fecha} autoFocus
                    onChange={e => setFormIPC({ ...formIPC, fecha: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>IPC (%) <span style={{ color: '#D4502A' }}>*</span></label>
                  <input type="number" step="0.1" style={s.input} value={formIPC.ipc_pct}
                    onChange={e => setFormIPC({ ...formIPC, ipc_pct: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Cuenta</label>
                  <select style={s.input} value={formIPC.cuenta} onChange={e => setFormIPC({ ...formIPC, cuenta: e.target.value })}>
                    <option value="ambas">Ambas (cliente y albañil)</option>
                    <option value="cliente">Solo cliente</option>
                    <option value="albanil">Solo albañil</option>
                  </select>
                </div>
                <div>
                  <label style={s.label}>Fuente</label>
                  <select style={s.input} value={formIPC.fuente} onChange={e => setFormIPC({ ...formIPC, fuente: e.target.value })}>
                    <option value="estimado">Estimado</option>
                    <option value="indec">Real INDEC</option>
                  </select>
                </div>
              </div>
              <div style={s.hint}>
                Se aplica sobre el saldo pendiente total a esa fecha (cargos menos pagos hasta ese momento), no sobre un movimiento puntual. Se agrega como un nuevo cargo.
              </div>
              {errorModal && <div style={s.errorMsg}>{errorModal}</div>}
            </div>
            <div style={s.modalFooter}>
              <button onClick={cerrarIPC} style={s.btnSecundario}>Cancelar</button>
              <button onClick={confirmarIPC} style={s.btnPrimario} disabled={guardando}>
                {guardando ? 'Aplicando...' : 'Aplicar ajuste'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  seccion:          { background: '#fff', borderRadius: 4, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: '16px 20px', marginBottom: 16 },
  seccionHeader:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 },
  seccionTitulo:    { fontSize: 13, fontWeight: 700, color: '#111', textTransform: 'uppercase', letterSpacing: '0.03em' },
  accionesHeader:   { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  btnPrimarioChico: { background: '#D4502A', color: '#fff', border: 'none', padding: '7px 14px', borderRadius: 3, cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  btnSecundarioChico:{ background: '#fff', color: '#D4502A', border: '1px solid #D4502A', padding: '7px 14px', borderRadius: 3, cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  btnImportar:      { background: '#fff', color: '#555', border: '1px solid #ddd', padding: '7px 14px', borderRadius: 3, cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  resultadoExcel:   { marginTop: 4, marginBottom: 8, background: '#f9f9f9', borderRadius: 3, padding: '8px 12px', fontSize: 12 },
  avisoExcel:       { color: '#b45309', marginTop: 4 },
  hintExcel:        { fontSize: 11, color: '#999', marginBottom: 14 },
  resumenMiniGrid:  { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 },
  resumenMiniCard:  { background: '#f9f9f9', borderRadius: 3, padding: '10px 12px' },
  resumenMiniLabel: { fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 3 },
  resumenMiniValor: { fontSize: 15, fontWeight: 700, color: '#111' },
  lista:            { display: 'flex', flexDirection: 'column', gap: 6 },
  fila:             { display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #eee', borderRadius: 3, padding: '9px 12px', gap: 12 },
  filaIzq:          { display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  badgeTipo:        { fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0 },
  badgeCargo:       { color: '#D4502A', background: '#fff4f1' },
  badgePago:        { color: '#16a34a', background: '#f0fdf4' },
  filaInfo:         { minWidth: 0 },
  filaFecha:        { fontSize: 12.5, fontWeight: 600, color: '#111' },
  filaConcepto:     { fontSize: 12.5, color: '#666' },
  badgeIPC:         { fontSize: 9, fontWeight: 700, color: '#b45309', background: '#fefce8', padding: '1px 6px', borderRadius: 20, marginLeft: 6 },
  filaDer:          { textAlign: 'right', flexShrink: 0 },
  filaMontos:       { display: 'flex', flexDirection: 'column', alignItems: 'flex-end' },
  filaMonto:        { fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' },
  filaMontoAlbanil: { fontSize: 10.5, color: '#999', whiteSpace: 'nowrap' },
  filaSaldo:        { fontSize: 10.5, color: '#999', marginTop: 2, whiteSpace: 'nowrap' },
  filaAcciones:     { display: 'flex', gap: 4, marginTop: 4, justifyContent: 'flex-end' },
  btnMini:          { background: 'none', border: '1px solid #ddd', color: '#555', padding: '2px 8px', borderRadius: 3, cursor: 'pointer', fontSize: 11 },
  hintFormula:      { fontSize: 11, color: '#999', marginTop: 12 },
  empty:            { textAlign: 'center', color: '#aaa', padding: 20, background: '#fafafa', borderRadius: 4, border: '1px dashed #ddd', fontSize: 13, marginBottom: 10 },
  overlay:          { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalCard:        { background: '#fff', borderRadius: 4, width: '100%', maxWidth: 560, boxShadow: '0 8px 40px rgba(0,0,0,0.2)', overflow: 'hidden', maxHeight: '90vh', overflowY: 'auto' },
  modalHeader:      { padding: '16px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 1 },
  modalTitulo:      { fontSize: 15, fontWeight: 700, margin: 0, color: '#111' },
  btnCerrar:        { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888' },
  modalBody:        { padding: '20px' },
  grid:             { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' },
  fullWidth:        { gridColumn: '1 / -1' },
  label:            { display: 'block', fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' },
  checkboxLabel:    { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#333', cursor: 'pointer' },
  input:            { width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 3, fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  hint:             { fontSize: 11, color: '#999', marginTop: 10 },
  errorMsg:         { marginTop: 12, background: '#fff5f5', border: '1px solid #fca5a5', color: '#dc2626', padding: '8px 12px', borderRadius: 3, fontSize: 13, borderLeft: '3px solid #dc2626' },
  modalFooter:      { padding: '14px 20px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: 10, position: 'sticky', bottom: 0, background: '#fff' },
  btnPrimario:      { background: '#D4502A', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 3, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  btnSecundario:    { background: '#fff', color: '#333', border: '1px solid #ddd', padding: '8px 16px', borderRadius: 3, cursor: 'pointer', fontSize: 13 },
}
