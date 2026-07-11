import { useState, useEffect } from 'react'
import api from '../utils/api'

const FORMAS_COBRO = [
  { value: 'efectivo',      label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'cheque',        label: 'Cheque' },
]

const FORMAS_COBRO_MAP = Object.fromEntries(FORMAS_COBRO.map(f => [f.value, f.label]))

const EMPTY = {
  cliente_id: '', proyecto_id: '', presupuesto_id: '',
  concepto: '', monto: '', forma_cobro: 'efectivo', referencia: '', notas: '',
}

function fmt(n) {
  if (!n) return '—'
  return '$ ' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0 })
}

function fmtFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR')
}

export default function Recibos() {
  const [recibos, setRecibos]           = useState([])
  const [clientes, setClientes]         = useState([])
  const [proyectos, setProyectos]       = useState([])
  const [presupuestos, setPresupuestos] = useState([])
  const [loading, setLoading]           = useState(true)
  const [filtroCliente, setFiltroCliente] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)
  const [form, setForm]                 = useState(EMPTY)
  const [guardando, setGuardando]       = useState(false)
  const [error, setError]               = useState('')
  const [descargando, setDescargando]   = useState(null)

  const cargar = async () => {
    setLoading(true)
    try {
      const params = filtroCliente ? `?cliente_id=${filtroCliente}` : ''
      const res = await api.get(`/api/recibos/${params}`)
      setRecibos(res.data)
    } catch { setError('Error al cargar recibos') }
    finally { setLoading(false) }
  }

  const cargarClientes = async () => {
    try {
      const res = await api.get('/api/clientes/')
      setClientes(res.data)
    } catch {}
  }

  useEffect(() => { cargar() }, [filtroCliente])
  useEffect(() => { cargarClientes() }, [])

  // Cerrar el modal con Escape
  useEffect(() => {
    if (!modalAbierto) return
    const onKeyDown = (e) => { if (e.key === 'Escape') cerrar() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [modalAbierto])

  // Cuando cambia el cliente elegido en el form, cargamos sus proyectos y presupuestos
  useEffect(() => {
    if (!form.cliente_id) { setProyectos([]); setPresupuestos([]); return }
    api.get(`/api/clientes/${form.cliente_id}/proyectos/`).then(r => setProyectos(r.data)).catch(() => setProyectos([]))
    api.get(`/api/presupuestos/?cliente_id=${form.cliente_id}`).then(r => setPresupuestos(r.data)).catch(() => setPresupuestos([]))
  }, [form.cliente_id])

  const abrirCrear = () => { setForm(EMPTY); setError(''); setModalAbierto(true) }
  const cerrar = () => { setModalAbierto(false); setError('') }

  const guardar = async () => {
    if (!form.cliente_id) { setError('Seleccioná un cliente'); return }
    if (!form.concepto) { setError('Ingresá el concepto'); return }
    if (!form.monto) { setError('Ingresá el monto recibido'); return }
    setGuardando(true); setError('')
    try {
      const payload = {
        cliente_id: Number(form.cliente_id),
        proyecto_id: form.proyecto_id ? Number(form.proyecto_id) : null,
        presupuesto_id: form.presupuesto_id ? Number(form.presupuesto_id) : null,
        concepto: form.concepto,
        monto: Number(form.monto),
        forma_cobro: form.forma_cobro,
        referencia: form.referencia || null,
        notas: form.notas || null,
      }
      await api.post('/api/recibos/', payload)
      cerrar(); cargar()
    } catch (e) {
      setError(e?.response?.data?.detail || 'Error al guardar')
    } finally { setGuardando(false) }
  }

  const eliminar = async (id) => {
    if (!window.confirm('¿Eliminar este recibo? Esta acción no se puede deshacer.')) return
    try {
      await api.delete(`/api/recibos/${id}`)
      cargar()
    } catch (e) { alert(e?.response?.data?.detail || 'Error al eliminar') }
  }

  const descargarPDF = async (id, numero) => {
    setDescargando(id)
    try {
      const res = await api.get(`/api/recibos/${id}/pdf`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url; a.download = `recibo_${numero}.pdf`; a.click()
      window.URL.revokeObjectURL(url)
    } catch { alert('Error al generar PDF') }
    finally { setDescargando(null) }
  }

  const etiquetaReferencia = form.forma_cobro === 'cheque' ? 'Nro. de cheque' : 'Referencia de transferencia'

  return (
    <div>
      <div style={s.pageHeader}>
        <div>
          <h2 style={s.titulo}>Recibos</h2>
          <p style={s.subtitulo}>{recibos.length} recibo{recibos.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={abrirCrear} style={s.btnPrimario}>+ Nuevo recibo</button>
      </div>

      <div style={s.filtros}>
        <select style={s.filtroSelect} value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)}>
          <option value="">Todos los clientes</option>
          {clientes.map(c => <option key={c.id} value={c.id}>{c.apellido}, {c.nombre}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={s.empty}>Cargando...</div>
      ) : recibos.length === 0 ? (
        <div style={s.empty}>No hay recibos aún.</div>
      ) : (
        <div style={s.lista}>
          {recibos.map(r => (
            <div key={r.id} style={s.card}>
              <div style={s.cardLeft}>
                <div style={s.cardNumero}>{r.numero}</div>
                <div style={s.cardCliente}>{r.cliente_apellido}, {r.cliente_nombre}</div>
                <div style={s.cardTipo}>{r.concepto}</div>
                <div style={s.cardDesc}>
                  {FORMAS_COBRO_MAP[r.forma_cobro] || r.forma_cobro}
                  {r.referencia ? ` · ${r.referencia}` : ''}
                  {r.proyecto_nombre ? ` · Proyecto: ${r.proyecto_nombre}` : ''}
                  {r.presupuesto_numero ? ` · Presup: ${r.presupuesto_numero}` : ''}
                </div>
                <div style={s.cardFecha}>Emitido: {fmtFecha(r.fecha_emision)}</div>
              </div>
              <div style={s.cardRight}>
                <span style={s.badge}>Emitido</span>
                <div style={s.cardMonto}>{fmt(r.monto)}</div>
                <div style={s.acciones}>
                  <button onClick={() => descargarPDF(r.id, r.numero)} style={s.btnAccion} disabled={descargando === r.id}>
                    {descargando === r.id ? 'Generando...' : 'PDF'}
                  </button>
                  <button onClick={() => eliminar(r.id)} style={{...s.btnAccion, color:'#dc2626'}}>Eliminar</button>
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
              <h3 style={s.modalTitulo}>Nuevo recibo</h3>
              <button onClick={cerrar} style={s.btnCerrar}>✕</button>
            </div>
            <div style={s.modalBody}>
              <div style={s.grid}>
                <div style={s.fullWidth}>
                  <label style={s.label}>Cliente <span style={{color:'#D4502A'}}>*</span></label>
                  <select style={s.input} value={form.cliente_id} autoFocus
                    onChange={e => setForm({...form, cliente_id: e.target.value, proyecto_id: '', presupuesto_id: ''})}>
                    <option value="">— Seleccioná un cliente —</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.apellido}, {c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label style={s.label}>Proyecto</label>
                  <select style={s.input} value={form.proyecto_id} disabled={!form.cliente_id}
                    onChange={e => setForm({...form, proyecto_id: e.target.value})}>
                    <option value="">Opcional</option>
                    {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label style={s.label}>Presupuesto de origen</label>
                  <select style={s.input} value={form.presupuesto_id} disabled={!form.cliente_id}
                    onChange={e => setForm({...form, presupuesto_id: e.target.value})}>
                    <option value="">Opcional</option>
                    {presupuestos.map(p => <option key={p.id} value={p.id}>{p.numero} — {p.tipo}</option>)}
                  </select>
                </div>
                <div style={s.fullWidth}>
                  <label style={s.label}>Concepto <span style={{color:'#D4502A'}}>*</span></label>
                  <input style={s.input} value={form.concepto}
                    onChange={e => setForm({...form, concepto: e.target.value})}
                    placeholder="Ej: Pago anticipo proyecto Casa Pérez" />
                </div>
                <div>
                  <label style={s.label}>Monto recibido ($) <span style={{color:'#D4502A'}}>*</span></label>
                  <input type="number" style={s.input} value={form.monto}
                    onChange={e => setForm({...form, monto: e.target.value})} placeholder="0" />
                </div>
                <div>
                  <label style={s.label}>Forma de cobro</label>
                  <select style={s.input} value={form.forma_cobro}
                    onChange={e => setForm({...form, forma_cobro: e.target.value})}>
                    {FORMAS_COBRO.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
                {form.forma_cobro !== 'efectivo' && (
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
                {guardando ? 'Guardando...' : 'Emitir recibo'}
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
  badge:           { fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20, display:'inline-block', color:'#16a34a', background:'#f0fdf4' },
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
