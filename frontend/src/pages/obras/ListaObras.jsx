import { useState, useEffect } from 'react'
import api from '../../utils/api'
import FichaObra from './FichaObra'

const ESTADOS = {
  en_curso:  { label: 'En curso',  color: '#D4502A', bg: '#fff4f1' },
  terminada: { label: 'Terminada', color: '#16a34a', bg: '#f0fdf4' },
  pausada:   { label: 'Pausada',   color: '#ca8a04', bg: '#fefce8' },
  cancelada: { label: 'Cancelada', color: '#6b7280', bg: '#f3f4f6' },
}

const EMPTY_FORM = {
  nombre: '', tipo_obra: '', superficie: '', estado: 'en_curso',
  fecha_inicio: '', ipc_estimado_mensual: '1.5', notas: '',
}

function fmt(n) {
  if (n === null || n === undefined) return '—'
  return '$ ' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0 })
}

export default function ListaObras({ clienteId, rol }) {
  const [obras, setObras]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [modal, setModal]         = useState(null)
  const [fichaId, setFichaId]     = useState(null)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [guardando, setGuardando] = useState(false)

  const esGaston = rol === 'gaston'

  const cargar = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/api/clientes/${clienteId}/obras/`)
      setObras(res.data)
    } catch {
      setError('Error al cargar obras')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [clienteId])

  const abrirCrear = () => { setForm(EMPTY_FORM); setError(''); setModal('crear') }
  const cerrar = () => { setModal(null); setError('') }

  const guardar = async () => {
    if (!form.nombre) { setError('El nombre es obligatorio'); return }
    setGuardando(true); setError('')
    try {
      const payload = {
        ...form,
        superficie: form.superficie === '' ? null : Number(form.superficie),
        fecha_inicio: form.fecha_inicio || null,
        ipc_estimado_mensual: form.ipc_estimado_mensual === '' ? 1.5 : Number(form.ipc_estimado_mensual),
      }
      await api.post(`/api/clientes/${clienteId}/obras/`, payload)
      cerrar(); cargar()
    } catch {
      setError('Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (id) => {
    if (!window.confirm('¿Eliminar esta obra? Se borra también su cronograma de pagos.')) return
    try {
      await api.delete(`/api/clientes/${clienteId}/obras/${id}`)
      cargar()
    } catch { alert('Error al eliminar') }
  }

  if (fichaId !== null) {
    return (
      <FichaObra
        clienteId={clienteId}
        obraId={fichaId}
        rol={rol}
        onVolver={() => { setFichaId(null); cargar() }}
      />
    )
  }

  return (
    <div>
      <div style={s.header}>
        <span style={s.count}>{obras.length} obra{obras.length !== 1 ? 's' : ''}</span>
        {esGaston && (
          <button onClick={abrirCrear} style={s.btnPrimario}>+ Nueva obra</button>
        )}
      </div>

      {loading ? (
        <div style={s.empty}>Cargando...</div>
      ) : obras.length === 0 ? (
        <div style={s.empty}>No hay obras registradas para este cliente.</div>
      ) : (
        <div style={s.lista}>
          {obras.map(o => {
            const est = ESTADOS[o.estado] || ESTADOS.en_curso
            return (
              <div key={o.id} style={s.card}>
                <div style={s.cardLeft}>
                  <div style={s.cardNombre}>{o.nombre}</div>
                  {o.tipo_obra && <div style={s.cardTipo}>{o.tipo_obra}</div>}
                  <div style={s.cardDesc}>
                    {o.superficie ? `${o.superficie} m² · ` : ''}
                    {o.presupuesto_numero ? `Presup: ${o.presupuesto_numero}` : 'Sin presupuesto vinculado'}
                  </div>
                </div>
                <div style={s.cardRight}>
                  <span style={{ ...s.badge, color: est.color, background: est.bg }}>
                    {est.label}
                  </span>
                  {esGaston && o.total_cliente != null && (
                    <div style={s.monto}>{fmt(o.total_cliente)}</div>
                  )}
                  <div style={s.acciones}>
                    <button onClick={() => setFichaId(o.id)} style={s.btnAccion}>Ver ficha</button>
                    {esGaston && (
                      <button onClick={() => eliminar(o.id)} style={{ ...s.btnAccion, color: '#dc2626' }}>Eliminar</button>
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
              <h3 style={s.modalTitulo}>Nueva obra</h3>
              <button onClick={cerrar} style={s.btnCerrar}>✕</button>
            </div>
            <div style={s.modalBody}>
              <div style={s.grid}>
                <div style={s.fullWidth}>
                  <label style={s.label}>Nombre <span style={{ color: '#D4502A' }}>*</span></label>
                  <input style={s.input} value={form.nombre} autoFocus
                    onChange={e => setForm({ ...form, nombre: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Tipo de obra</label>
                  <input style={s.input} value={form.tipo_obra}
                    placeholder="Ej: Construcción nueva"
                    onChange={e => setForm({ ...form, tipo_obra: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Superficie (m²)</label>
                  <input type="number" style={s.input} value={form.superficie}
                    onChange={e => setForm({ ...form, superficie: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Estado</label>
                  <select style={s.input} value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })}>
                    {Object.entries(ESTADOS).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={s.label}>Fecha de inicio</label>
                  <input type="date" style={s.input} value={form.fecha_inicio}
                    onChange={e => setForm({ ...form, fecha_inicio: e.target.value })} />
                </div>
                <div style={s.fullWidth}>
                  <label style={s.label}>IPC estimado mensual (%)</label>
                  <input type="number" step="0.1" style={s.input} value={form.ipc_estimado_mensual}
                    onChange={e => setForm({ ...form, ipc_estimado_mensual: e.target.value })} />
                  <div style={s.hint}>Se usa como referencia para proyectar el cronograma. Se ajusta después con el IPC real de INDEC.</div>
                </div>
                <div style={s.fullWidth}>
                  <label style={s.label}>Notas</label>
                  <textarea style={{ ...s.input, height: 56, resize: 'vertical' }} value={form.notas}
                    onChange={e => setForm({ ...form, notas: e.target.value })} />
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
  header:       { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  count:        { fontSize: 13, color: '#888' },
  btnPrimario:  { background: '#D4502A', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 3, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  lista:        { display: 'flex', flexDirection: 'column', gap: 10 },
  card:         { background: '#fff', border: '1px solid #eee', borderRadius: 4, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  cardLeft:     { flex: 1, minWidth: 0 },
  cardNombre:   { fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 2 },
  cardTipo:     { fontSize: 12, color: '#888', marginBottom: 2 },
  cardDesc:     { fontSize: 12, color: '#666', marginTop: 4 },
  cardRight:    { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, marginLeft: 16 },
  badge:        { fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, display: 'inline-block' },
  monto:        { fontSize: 13, fontWeight: 700, color: '#111' },
  acciones:     { display: 'flex', gap: 6 },
  btnAccion:    { background: 'none', border: '1px solid #ddd', color: '#555', padding: '3px 10px', borderRadius: 3, cursor: 'pointer', fontSize: 12 },
  empty:        { textAlign: 'center', color: '#aaa', padding: 40, background: '#fff', borderRadius: 4, border: '1px dashed #ddd', fontSize: 13 },
  overlay:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalCard:    { background: '#fff', borderRadius: 4, width: '100%', maxWidth: 600, boxShadow: '0 8px 40px rgba(0,0,0,0.2)', overflow: 'hidden', maxHeight: '90vh', overflowY: 'auto' },
  modalHeader:  { padding: '16px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 1 },
  modalTitulo:  { fontSize: 16, fontWeight: 700, margin: 0, color: '#111' },
  btnCerrar:    { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888' },
  modalBody:    { padding: '20px' },
  grid:         { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' },
  fullWidth:    { gridColumn: '1 / -1' },
  label:        { display: 'block', fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' },
  input:        { width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 3, fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  hint:         { fontSize: 11, color: '#999', marginTop: 4 },
  errorMsg:     { marginTop: 12, background: '#fff5f5', border: '1px solid #fca5a5', color: '#dc2626', padding: '8px 12px', borderRadius: 3, fontSize: 13, borderLeft: '3px solid #dc2626' },
  modalFooter:  { padding: '14px 20px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: 10, position: 'sticky', bottom: 0, background: '#fff' },
  btnSecundario:{ background: '#fff', color: '#333', border: '1px solid #ddd', padding: '8px 16px', borderRadius: 3, cursor: 'pointer', fontSize: 13 },
}
