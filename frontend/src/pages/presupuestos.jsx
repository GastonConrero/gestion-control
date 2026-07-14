import { useState, useEffect } from 'react'
import api from '../utils/api'

const ESTADOS = {
  borrador:   { label: 'Borrador',   color: '#888',    bg: '#f3f4f6' },
  enviado:    { label: 'Enviado',    color: '#ca8a04', bg: '#fefce8' },
  confirmado: { label: 'Confirmado', color: '#16a34a', bg: '#f0fdf4' },
  rechazado:  { label: 'Rechazado', color: '#dc2626', bg: '#fff5f5' },
}

const TIPOS = [
  'Nuevo proyecto de arquitectura',
  'Proyecto de remodelación de arquitectura',
  'Proyecto de ampliación de arquitectura',
  'Remodelación + Ampliación',
  'Nuevo proyecto de ingeniería',
  'Dirección técnica, gestión y administración de obra',
  'Mano de obra de albañilería',
  'Adicional de mano de obra de albañilería',
  'MdO remodelación + ampliación',
  'MdO instalación eléctrica',
  'MdO instalación cloacal',
  'MdO instalación pluvial',
  'MdO agua fría y caliente',
  'MdO termomecánica',
  'MdO instalación de gas',
  'MdO calefacción',
  'Personalizado',
]

const FORMAS_PAGO = [
  { value: 'contado',         label: 'Contado' },
  { value: 'cuotas',          label: 'Cuotas' },
  { value: 'anticipo_cuotas', label: 'Anticipo + cuotas' },
  { value: 'a_convenir',      label: 'A convenir' },
]

const EMPTY = {
  cliente_id: '', tipo: '', descripcion: '', honorario_total: '',
  forma_pago: 'a_convenir', detalle_pago: '', superficie: '',
  incluye: '', no_incluye: '', notas: '',
  profesional_1: 'Ing. Gastón Conrero', profesional_2: '',
}

function fmt(n) {
  if (!n) return '—'
  return '$ ' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR')
}

export default function Presupuestos() {
  const [presupuestos, setPresupuestos] = useState([])
  const [clientes, setClientes]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [modal, setModal]               = useState(null)
  const [form, setForm]                 = useState(EMPTY)
  const [guardando, setGuardando]       = useState(false)
  const [error, setError]               = useState('')
  const [descargando, setDescargando]   = useState(null)

  const cargar = async () => {
    setLoading(true)
    try {
      const params = filtroEstado ? `?estado=${filtroEstado}` : ''
      const res = await api.get(`/api/presupuestos/${params}`)
      setPresupuestos(res.data)
    } catch { setError('Error al cargar presupuestos') }
    finally { setLoading(false) }
  }

  const cargarClientes = async () => {
    try {
      const res = await api.get('/api/clientes/')
      setClientes(res.data)
    } catch {}
  }

  useEffect(() => { cargar() }, [filtroEstado])
  useEffect(() => { cargarClientes() }, [])

  const abrirCrear = () => { setForm(EMPTY); setError(''); setModal('crear') }
  const abrirEditar = (p) => {
    setForm({
      cliente_id: p.cliente_id || '', tipo: p.tipo || '',
      descripcion: p.descripcion || '', honorario_total: p.honorario_total || '',
      forma_pago: p.forma_pago || 'a_convenir', detalle_pago: p.detalle_pago || '',
      superficie: p.superficie || '', incluye: p.incluye || '',
      no_incluye: p.no_incluye || '', notas: p.notas || '',
      profesional_1: p.profesional_1 || 'Ing. Gastón Conrero',
      profesional_2: p.profesional_2 || '',
    })
    setError(''); setModal(p)
  }
  const cerrar = () => { setModal(null); setError('') }

  const guardar = async () => {
    if (!form.cliente_id) { setError('Seleccioná un cliente'); return }
    if (!form.tipo) { setError('Seleccioná el tipo de servicio'); return }
    if (!form.honorario_total) { setError('Ingresá el honorario'); return }
    setGuardando(true); setError('')
    try {
      const payload = {
        ...form,
        cliente_id: Number(form.cliente_id),
        honorario_total: Number(form.honorario_total),
        superficie: form.superficie ? Number(form.superficie) : null,
        detalle_pago: form.detalle_pago || null,
        descripcion: form.descripcion || null,
        incluye: form.incluye || null,
        no_incluye: form.no_incluye || null,
        notas: form.notas || null,
        profesional_2: form.profesional_2 || null,
      }
      if (modal === 'crear') {
        await api.post('/api/presupuestos/', payload)
      } else {
        await api.put(`/api/presupuestos/${modal.id}`, payload)
      }
      cerrar(); cargar()
    } catch (e) {
      setError(e?.response?.data?.detail || 'Error al guardar')
    } finally { setGuardando(false) }
  }

  const cambiarEstado = async (id, accion) => {
    try {
      await api.post(`/api/presupuestos/${id}/${accion}`)
      cargar()
    } catch (e) { alert(e?.response?.data?.detail || 'Error al cambiar estado') }
  }

  const eliminar = async (id) => {
    if (!window.confirm('¿Eliminar este presupuesto?')) return
    try {
      await api.delete(`/api/presupuestos/${id}`)
      cargar()
    } catch (e) { alert(e?.response?.data?.detail || 'Error al eliminar') }
  }

  const descargarPDF = async (id, numero) => {
    setDescargando(id)
    try {
      const res = await api.get(`/api/presupuestos/${id}/pdf`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url; a.download = `presupuesto_${numero}.pdf`; a.click()
      window.URL.revokeObjectURL(url)
    } catch { alert('Error al generar PDF') }
    finally { setDescargando(null) }
  }

  return (
    <div>
      <div style={s.pageHeader}>
        <div>
          <h2 style={s.titulo}>Presupuestos</h2>
          <p style={s.subtitulo}>{presupuestos.length} presupuesto{presupuestos.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={abrirCrear} style={s.btnPrimario}>+ Nuevo presupuesto</button>
      </div>

      <div style={s.filtros}>
        {[{value:'',label:'Todos'}, ...Object.entries(ESTADOS).map(([k,v])=>({value:k,label:v.label}))].map(f => (
          <button key={f.value} onClick={() => setFiltroEstado(f.value)}
            style={{...s.filtroBtnBase, ...(filtroEstado === f.value ? s.filtroBtnActivo : {})}}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={s.empty}>Cargando...</div>
      ) : presupuestos.length === 0 ? (
        <div style={s.empty}>No hay presupuestos{filtroEstado ? ` en estado "${ESTADOS[filtroEstado]?.label}"` : ''} aún.</div>
      ) : (
        <div style={s.lista}>
          {presupuestos.map(p => {
            const est = ESTADOS[p.estado] || ESTADOS.borrador
            return (
              <div key={p.id} style={s.card}>
                <div style={s.cardLeft}>
                  <div style={s.cardNumero}>{p.numero}</div>
                  <div style={s.cardCliente}>{p.cliente_apellido}, {p.cliente_nombre}</div>
                  <div style={s.cardTipo}>{p.tipo}</div>
                  {p.descripcion && <div style={s.cardDesc}>{p.descripcion}</div>}
                  <div style={s.cardFecha}>Emitido: {fmtFecha(p.fecha_emision)}</div>
                </div>
                <div style={s.cardRight}>
                  <span style={{...s.badge, color: est.color, background: est.bg}}>{est.label}</span>
                  <div style={s.cardMonto}>{fmt(p.honorario_total)}</div>
                  <div style={s.acciones}>
                    {p.estado === 'borrador' && (
                      <button onClick={() => cambiarEstado(p.id,'enviar')} style={s.btnAccion}>Marcar enviado</button>
                    )}
                    {p.estado === 'enviado' && (
                      <>
                        <button onClick={() => cambiarEstado(p.id,'confirmar')} style={{...s.btnAccion, color:'#16a34a'}}>Confirmar</button>
                        <button onClick={() => cambiarEstado(p.id,'rechazar')} style={{...s.btnAccion, color:'#dc2626'}}>Rechazar</button>
                      </>
                    )}
                  </div>
                  <div style={s.acciones}>
                    <button onClick={() => descargarPDF(p.id, p.numero)} style={s.btnAccion} disabled={descargando === p.id}>
                      {descargando === p.id ? 'Generando...' : 'PDF'}
                    </button>
                    {p.estado !== 'confirmado' && (
                      <>
                        <button onClick={() => abrirEditar(p)} style={s.btnAccion}>Editar</button>
                        <button onClick={() => eliminar(p.id)} style={{...s.btnAccion, color:'#dc2626'}}>Eliminar</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal !== null && (
        <div style={s.overlay} onClick={cerrar}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitulo}>{modal === 'crear' ? 'Nuevo presupuesto' : `Editar: ${modal.numero}`}</h3>
              <button onClick={cerrar} style={s.btnCerrar}>✕</button>
            </div>
            <div style={s.modalBody}>
              <div style={s.grid}>
                <div style={s.fullWidth}>
                  <label style={s.label}>Cliente <span style={{color:'#D4502A'}}>*</span></label>
                  <select style={s.input} value={form.cliente_id} onChange={e => setForm({...form, cliente_id: e.target.value})}>
                    <option value="">— Seleccioná un cliente —</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.apellido}, {c.nombre}</option>)}
                  </select>
                </div>
                <div style={s.fullWidth}>
                  <label style={s.label}>Tipo de servicio <span style={{color:'#D4502A'}}>*</span></label>
                  <select style={s.input} value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})}>
                    <option value="">— Seleccioná el tipo —</option>
                    {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={s.label}>Honorario total ($) <span style={{color:'#D4502A'}}>*</span></label>
                  <input type="number" style={s.input} value={form.honorario_total}
                    onChange={e => setForm({...form, honorario_total: e.target.value})} placeholder="0" />
                </div>
                <div>
                  <label style={s.label}>Superficie (m²)</label>
                  <input type="number" style={s.input} value={form.superficie}
                    onChange={e => setForm({...form, superficie: e.target.value})} placeholder="Opcional" />
                </div>
                <div>
                  <label style={s.label}>Forma de pago</label>
                  <select style={s.input} value={form.forma_pago} onChange={e => setForm({...form, forma_pago: e.target.value})}>
                    {FORMAS_PAGO.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={s.label}>Detalle forma de pago</label>
                  <input style={s.input} value={form.detalle_pago}
                    onChange={e => setForm({...form, detalle_pago: e.target.value})}
                    placeholder="Ej: 50% anticipo, resto en 3 cuotas" />
                </div>
                <div style={s.fullWidth}>
                  <label style={s.label}>Descripción</label>
                  <textarea style={{...s.input, height:60, resize:'vertical'}} value={form.descripcion}
                    onChange={e => setForm({...form, descripcion: e.target.value})} />
                </div>
                <div>
                  <label style={s.label}>Incluye</label>
                  <textarea style={{...s.input, height:56, resize:'vertical'}} value={form.incluye}
                    onChange={e => setForm({...form, incluye: e.target.value})} />
                </div>
                <div>
                  <label style={s.label}>No incluye</label>
                  <textarea style={{...s.input, height:56, resize:'vertical'}} value={form.no_incluye}
                    onChange={e => setForm({...form, no_incluye: e.target.value})} />
                </div>
                <div>
                  <label style={s.label}>Profesional firmante 1</label>
                  <input style={s.input} value={form.profesional_1}
                    onChange={e => setForm({...form, profesional_1: e.target.value})} />
                </div>
                <div>
                  <label style={s.label}>Profesional firmante 2</label>
                  <input style={s.input} value={form.profesional_2}
                    onChange={e => setForm({...form, profesional_2: e.target.value})} placeholder="Opcional" />
                </div>
                <div style={s.fullWidth}>
                  <label style={s.label}>Notas internas</label>
                  <textarea style={{...s.input, height:48, resize:'vertical'}} value={form.notas}
                    onChange={e => setForm({...form, notas: e.target.value})} />
                </div>
              </div>
              {error && <div style={s.errorMsg}>{error}</div>}
            </div>
            <div style={s.modalFooter}>
              <button onClick={cerrar} style={s.btnSecundario}>Cancelar</button>
              <button onClick={guardar} style={s.btnPrimario} disabled={guardando}>
                {guardando ? 'Guardando...' : 'Guardar'}
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
  filtroBtnBase:   { background:'#f5f5f5', border:'1px solid #ddd', color:'#555', padding:'5px 12px', borderRadius:20, cursor:'pointer', fontSize:12 },
  filtroBtnActivo: { background:'#D4502A', color:'#fff', border:'1px solid #D4502A' },
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
