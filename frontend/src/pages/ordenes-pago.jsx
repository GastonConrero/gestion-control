import { useState, useEffect } from 'react'
import api from '../utils/api'

const FORMAS_PAGO = [
  { value: 'efectivo',      label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'cheque',        label: 'Cheque' },
]

const FORMAS_PAGO_MAP = Object.fromEntries(FORMAS_PAGO.map(f => [f.value, f.label]))

const EMPTY = {
  destinatario: '', proyecto_id: '',
  concepto: '', monto: '', forma_pago: 'efectivo', referencia: '', notas: '',
}

function fmt(n) {
  if (!n) return '—'
  return '$ ' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR')
}

export default function OrdenesPago() {
  const [ordenes, setOrdenes]     = useState([])
  const [proyectos, setProyectos] = useState([])
  const [loading, setLoading]     = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [form, setForm]               = useState(EMPTY)
  const [guardando, setGuardando]     = useState(false)
  const [error, setError]             = useState('')
  const [descargando, setDescargando] = useState(null)
  const [procesando, setProcesando]   = useState(null)

  const cargar = async () => {
    setLoading(true)
    try {
      const params = filtroEstado ? `?estado=${filtroEstado}` : ''
      const res = await api.get(`/api/ordenes-pago/${params}`)
      setOrdenes(res.data)
    } catch { setError('Error al cargar órdenes de pago') }
    finally { setLoading(false) }
  }

  const cargarProyectos = async () => {
    try {
      const res = await api.get('/api/ordenes-pago/proyectos-disponibles')
      setProyectos(res.data)
    } catch {}
  }

  useEffect(() => { cargar() }, [filtroEstado])
  useEffect(() => { cargarProyectos() }, [])

  // Cerrar el modal con Escape
  useEffect(() => {
    if (!modalAbierto) return
    const onKeyDown = (e) => { if (e.key === 'Escape') cerrar() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [modalAbierto])

  const abrirCrear = () => { setForm(EMPTY); setError(''); setModalAbierto(true) }
  const cerrar = () => { setModalAbierto(false); setError('') }

  const guardar = async () => {
    if (!form.destinatario) { setError('Ingresá el destinatario'); return }
    if (!form.concepto) { setError('Ingresá el concepto'); return }
    if (!form.monto) { setError('Ingresá el monto'); return }
    setGuardando(true); setError('')
    try {
      const payload = {
        destinatario: form.destinatario,
        proyecto_id: form.proyecto_id ? Number(form.proyecto_id) : null,
        concepto: form.concepto,
        monto: Number(form.monto),
        forma_pago: form.forma_pago,
        referencia: form.referencia || null,
        notas: form.notas || null,
      }
      await api.post('/api/ordenes-pago/', payload)
      cerrar(); cargar()
    } catch (e) {
      setError(e?.response?.data?.detail || 'Error al guardar')
    } finally { setGuardando(false) }
  }

  const marcarPagado = async (id) => {
    setProcesando(id)
    try {
      await api.post(`/api/ordenes-pago/${id}/pagar`)
      cargar()
    } catch (e) { alert(e?.response?.data?.detail || 'Error al marcar como pagado') }
    finally { setProcesando(null) }
  }

  const eliminar = async (id) => {
    if (!window.confirm('¿Eliminar esta orden de pago? Esta acción no se puede deshacer.')) return
    try {
      await api.delete(`/api/ordenes-pago/${id}`)
      cargar()
    } catch (e) { alert(e?.response?.data?.detail || 'Error al eliminar') }
  }

  const descargarPDF = async (id, numero) => {
    setDescargando(id)
    try {
      const res = await api.get(`/api/ordenes-pago/${id}/pdf`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url; a.download = `orden_pago_${numero}.pdf`; a.click()
      window.URL.revokeObjectURL(url)
    } catch { alert('Error al generar PDF') }
    finally { setDescargando(null) }
  }

  const etiquetaReferencia = form.forma_pago === 'cheque' ? 'Nro. de cheque' : 'Referencia de transferencia'

  return (
    <div>
      <div style={s.pageHeader}>
        <div>
          <h2 style={s.titulo}>Órdenes de Pago</h2>
          <p style={s.subtitulo}>{ordenes.length} orden{ordenes.length !== 1 ? 'es' : ''}</p>
        </div>
        <button onClick={abrirCrear} style={s.btnPrimario}>+ Nueva orden</button>
      </div>

      <div style={s.filtros}>
        <select style={s.filtroSelect} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="pagado">Pagado</option>
        </select>
      </div>

      {loading ? (
        <div style={s.empty}>Cargando...</div>
      ) : ordenes.length === 0 ? (
        <div style={s.empty}>No hay órdenes de pago aún.</div>
      ) : (
        <div style={s.lista}>
          {ordenes.map(o => (
            <div key={o.id} style={s.card}>
              <div style={s.cardLeft}>
                <div style={s.cardNumero}>{o.numero}</div>
                <div style={s.cardCliente}>{o.destinatario}</div>
                <div style={s.cardTipo}>{o.concepto}</div>
                <div style={s.cardDesc}>
                  {FORMAS_PAGO_MAP[o.forma_pago] || o.forma_pago}
                  {o.referencia ? ` · ${o.referencia}` : ''}
                  {o.proyecto_nombre ? ` · Proyecto: ${o.proyecto_nombre}` : ''}
                </div>
                <div style={s.cardFecha}>
                  Emitida: {fmtFecha(o.fecha_emision)}
                  {o.fecha_pago ? ` · Pagada: ${fmtFecha(o.fecha_pago)}` : ''}
                </div>
              </div>
              <div style={s.cardRight}>
                <span style={{...s.badge, ...(o.estado === 'pagado' ? s.badgeVerde : s.badgeAmarillo)}}>
                  {o.estado === 'pagado' ? 'Pagado' : 'Pendiente'}
                </span>
                <div style={s.cardMonto}>{fmt(o.monto)}</div>
                <div style={s.acciones}>
                  {o.estado !== 'pagado' && (
                    <button onClick={() => marcarPagado(o.id)} style={{...s.btnAccion, color:'#16a34a', borderColor:'#16a34a'}}
                      disabled={procesando === o.id}>
                      {procesando === o.id ? '...' : 'Marcar pagado'}
                    </button>
                  )}
                  <button onClick={() => descargarPDF(o.id, o.numero)} style={s.btnAccion} disabled={descargando === o.id}>
                    {descargando === o.id ? 'Generando...' : 'PDF'}
                  </button>
                  <button onClick={() => eliminar(o.id)} style={{...s.btnAccion, color:'#dc2626'}}>Eliminar</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalAbierto && (
        <div style={s.overlay} onClick={cerrar}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitulo}>Nueva orden de pago</h3>
              <button onClick={cerrar} style={s.btnCerrar}>✕</button>
            </div>
            <div style={s.modalBody}>
              <div style={s.grid}>
                <div style={s.fullWidth}>
                  <label style={s.label}>Destinatario <span style={{color:'#D4502A'}}>*</span></label>
                  <input style={s.input} value={form.destinatario} autoFocus
                    onChange={e => setForm({...form, destinatario: e.target.value})}
                    placeholder="Nombre de la persona o empresa" />
                </div>
                <div style={s.fullWidth}>
                  <label style={s.label}>Proyecto</label>
                  <select style={s.input} value={form.proyecto_id}
                    onChange={e => setForm({...form, proyecto_id: e.target.value})}>
                    <option value="">Opcional</option>
                    {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre} ({p.cliente})</option>)}
                  </select>
                </div>
                <div style={s.fullWidth}>
                  <label style={s.label}>Concepto <span style={{color:'#D4502A'}}>*</span></label>
                  <input style={s.input} value={form.concepto}
                    onChange={e => setForm({...form, concepto: e.target.value})}
                    placeholder="Ej: Pago subcontratista instalación eléctrica" />
                </div>
                <div>
                  <label style={s.label}>Monto ($) <span style={{color:'#D4502A'}}>*</span></label>
                  <input type="number" style={s.input} value={form.monto}
                    onChange={e => setForm({...form, monto: e.target.value})} placeholder="0" />
                </div>
                <div>
                  <label style={s.label}>Forma de pago</label>
                  <select style={s.input} value={form.forma_pago}
                    onChange={e => setForm({...form, forma_pago: e.target.value})}>
                    {FORMAS_PAGO.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
                {form.forma_pago !== 'efectivo' && (
                  <div style={s.fullWidth}>
                    <label style={s.label}>{etiquetaReferencia}</label>
                    <input style={s.input} value={form.referencia}
                      onChange={e => setForm({...form, referencia: e.target.value})}
                      placeholder="Opcional" />
                  </div>
                )}
                <div style={s.fullWidth}>
                  <label style={s.label}>Notas</label>
                  <textarea style={{...s.input, height:56, resize:'vertical'}} value={form.notas}
                    onChange={e => setForm({...form, notas: e.target.value})} />
                </div>
              </div>
              {error && <div style={s.errorMsg}>{error}</div>}
            </div>
            <div style={s.modalFooter}>
              <button onClick={cerrar} style={s.btnSecundario}>Cancelar</button>
              <button onClick={guardar} style={s.btnPrimario} disabled={guardando}>
                {guardando ? 'Guardando...' : 'Emitir orden'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  pageHeader:      { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 },
  titulo:          { fontSize:20, fontWeight:700, color:'#111', margin:0 },
  subtitulo:       { fontSize:13, color:'#888', margin:'4px 0 0' },
  btnPrimario:     { background:'#D4502A', color:'#fff', border:'none', padding:'9px 18px', borderRadius:3, cursor:'pointer', fontSize:13, fontWeight:600 },
  btnSecundario:   { background:'#fff', color:'#333', border:'1px solid #ddd', padding:'9px 18px', borderRadius:3, cursor:'pointer', fontSize:13 },
  filtros:         { display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' },
  filtroSelect:    { background:'#f5f5f5', border:'1px solid #ddd', color:'#555', padding:'6px 10px', borderRadius:3, fontSize:12 },
  lista:           { display:'flex', flexDirection:'column', gap:10 },
  card:            { background:'#fff', border:'1px solid #eee', borderRadius:4, padding:'14px 16px', display:'flex', justifyContent:'space-between', alignItems:'flex-start', boxShadow:'0 1px 3px rgba(0,0,0,0.05)' },
  cardLeft:        { flex:1, minWidth:0 },
  cardNumero:      { fontSize:11, fontWeight:700, color:'#D4502A', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:2 },
  cardCliente:     { fontSize:14, fontWeight:700, color:'#111', marginBottom:2 },
  cardTipo:        { fontSize:12, color:'#555', marginBottom:2 },
  cardDesc:        { fontSize:12, color:'#888', marginBottom:2 },
  cardFecha:       { fontSize:11, color:'#aaa', marginTop:4 },
  cardRight:       { display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6, marginLeft:16 },
  badge:           { fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20, display:'inline-block' },
  badgeVerde:      { color:'#16a34a', background:'#f0fdf4' },
  badgeAmarillo:   { color:'#b45309', background:'#fffbeb' },
  cardMonto:       { fontSize:15, fontWeight:700, color:'#111' },
  acciones:        { display:'flex', gap:6, flexWrap:'wrap', justifyContent:'flex-end' },
  btnAccion:       { background:'none', border:'1px solid #ddd', color:'#555', padding:'3px 10px', borderRadius:3, cursor:'pointer', fontSize:12 },
  empty:           { textAlign:'center', color:'#aaa', padding:40, background:'#fff', borderRadius:4, border:'1px dashed #ddd', fontSize:13 },
  overlay:         { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 },
  modalCard:       { background:'#fff', borderRadius:4, width:'100%', maxWidth:640, boxShadow:'0 8px 40px rgba(0,0,0,0.2)', overflow:'hidden', maxHeight:'92vh', overflowY:'auto' },
  modalHeader:     { padding:'16px 20px', borderBottom:'1px solid #eee', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, background:'#fff', zIndex:1 },
  modalTitulo:     { fontSize:16, fontWeight:700, margin:0, color:'#111' },
  btnCerrar:       { background:'none', border:'none', fontSize:18, cursor:'pointer', color:'#888' },
  modalBody:       { padding:'20px' },
  modalFooter:     { padding:'14px 20px', borderTop:'1px solid #eee', display:'flex', justifyContent:'flex-end', gap:10, position:'sticky', bottom:0, background:'#fff' },
  grid:            { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px 16px' },
  fullWidth:       { gridColumn:'1 / -1' },
  label:           { display:'block', fontSize:11, fontWeight:700, color:'#555', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.04em' },
  input:           { width:'100%', padding:'8px 10px', border:'1px solid #ddd', borderRadius:3, fontSize:13, outline:'none', boxSizing:'border-box' },
  errorMsg:        { marginTop:12, background:'#fff5f5', border:'1px solid #fca5a5', color:'#dc2626', padding:'8px 12px', borderRadius:3, fontSize:13, borderLeft:'3px solid #dc2626' },
}
