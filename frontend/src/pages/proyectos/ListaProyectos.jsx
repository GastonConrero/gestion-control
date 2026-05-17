import { useState, useEffect } from 'react'
import api from '../../utils/api'
import FichaProyecto from './FichaProyecto'

const ESTADOS = {
  en_curso:  { label: 'En curso',   color: '#D4502A', bg: '#fff4f1' },
  terminado: { label: 'Terminado',  color: '#16a34a', bg: '#f0fdf4' },
  pausado:   { label: 'Pausado',    color: '#ca8a04', bg: '#fefce8' },
  cancelado: { label: 'Cancelado',  color: '#6b7280', bg: '#f3f4f6' },
}

const TIPOS = [
  'Proyecto de arquitectura',
  'Proyecto de ingeniería',
  'Dirección técnica',
  'Remodelación',
  'Ampliación',
  'Remodelación + Ampliación',
  'Personalizado',
]

const EMPTY_FORM = {
  nombre: '', tipo: '', descripcion: '', estado: 'en_curso',
  honorario_total: '', fecha_inicio: '', fecha_fin: '', notas: '',
}

export default function ListaProyectos({ clienteId, rol }) {
  const [proyectos, setProyectos]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [modal, setModal]           = useState(null)
  const [fichaId, setFichaId]       = useState(null)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [guardando, setGuardando]   = useState(false)

  const esGaston = rol === 'gaston'

  const cargar = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/api/clientes/${clienteId}/proyectos/`)
      setProyectos(res.data)
    } catch {
      setError('Error al cargar proyectos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [clienteId])

  const abrirCrear = () => { setForm(EMPTY_FORM); setError(''); setModal('crear') }

  const abrirEditar = (p) => {
    setForm({
      nombre:          p.nombre || '',
      tipo:            p.tipo || '',
      descripcion:     p.descripcion || '',
      estado:          p.estado || 'en_curso',
      honorario_total: p.honorario_total ?? '',
      fecha_inicio:    p.fecha_inicio ? p.fecha_inicio.slice(0, 10) : '',
      fecha_fin:       p.fecha_fin    ? p.fecha_fin.slice(0, 10)    : '',
      notas:           p.notas || '',
    })
    setError('')
    setModal(p)
  }

  const cerrar = () => { setModal(null); setError('') }

  const guardar = async () => {
    if (!form.nombre) { setError('El nombre es obligatorio'); return }
    setGuardando(true); setError('')
    try {
      const payload = {
        ...form,
        honorario_total: form.honorario_total === '' ? null : Number(form.honorario_total),
        fecha_inicio:    form.fecha_inicio || null,
        fecha_fin:       form.fecha_fin    || null,
      }
      if (modal === 'crear') {
        await api.post(`/api/clientes/${clienteId}/proyectos/`, payload)
      } else {
        await api.put(`/api/clientes/${clienteId}/proyectos/${modal.id}`, payload)
      }
      cerrar(); cargar()
    } catch {
      setError('Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (id) => {
    if (!window.confirm('¿Eliminar este proyecto?')) return
    try {
      await api.delete(`/api/clientes/${clienteId}/proyectos/${id}`)
      cargar()
    } catch { alert('Error al eliminar') }
  }

  if (fichaId !== null) {
    return (
      <FichaProyecto
        clienteId={clienteId}
        proyectoId={fichaId}
        rol={rol}
        onVolver={() => { setFichaId(null); cargar() }}
      />
    )
  }

  return (
    <div>
      <div style={s.header}>
        <span style={s.count}>{proyectos.length} proyecto{proyectos.length !== 1 ? 's' : ''}</span>
        {esGaston && (
          <button onClick={abrirCrear} style={s.btnPrimario}>+ Nuevo proyecto</button>
        )}
      </div>

      {loading ? (
        <div style={s.empty}>Cargando...</div>
      ) : proyectos.length === 0 ? (
        <div style={s.empty}>No hay proyectos registrados para este cliente.</div>
      ) : (
        <div style={s.lista}>
          {proyectos.map(p => {
            const est = ESTADOS[p.estado] || ESTADOS.en_curso
            return (
              <div key={p.id} style={s.card}>
                <div style={s.cardLeft}>
                  <div style={s.cardNombre}>{p.nombre}</div>
                  {p.tipo && <div style={s.cardTipo}>{p.tipo}</div>}
                  {p.descripcion && <div style={s.cardDesc}>{p.descripcion}</div>}
                </div>
                <div style={s.cardRight}>
                  <span style={{ ...s.badge, color: est.color, background: est.bg }}>
                    {est.label}
                  </span>
                  {esGaston && p.honorario_total && (
                    <div style={s.monto}>
                      $ {Number(p.honorario_total).toLocaleString('es-AR')}
                    </div>
                  )}
                  <div style={s.acciones}>
                    <button onClick={() => setFichaId(p.id)} style={s.btnAccion}>Ver ficha</button>
                    {esGaston && (
                      <>
                        <button onClick={() => abrirEditar(p)} style={s.btnAccion}>Editar</button>
                        <button onClick={() => eliminar(p.id)} style={{ ...s.btnAccion, color: '#dc2626' }}>Eliminar</button>
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
              <h3 style={s.modalTitulo}>
                {modal === 'crear' ? 'Nuevo proyecto' : `Editar: ${modal.nombre}`}
              </h3>
              <button onClick={cerrar} style={s.btnCerrar}>✕</button>
            </div>
            <div style={s.modalBody}>
              <div style={s.grid}>
                <div style={s.fullWidth}>
                  <label style={s.label}>Nombre <span style={{ color: '#D4502A' }}>*</span></label>
                  <input style={s.input} value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Tipo</label>
                  <select style={s.input} value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                    <option value="">— Sin especificar —</option>
                    {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={s.label}>Estado</label>
                  <select style={s.input} value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })}>
                    {Object.entries(ESTADOS).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                {esGaston && (
                  <div>
                    <label style={s.label}>Honorario total ($)</label>
                    <input type="number" style={s.input} value={form.honorario_total} onChange={e => setForm({ ...form, honorario_total: e.target.value })} />
                  </div>
                )}
                <div>
                  <label style={s.label}>Fecha inicio</label>
                  <input type="date" style={s.input} value={form.fecha_inicio} onChange={e => setForm({ ...form, fecha_inicio: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Fecha fin / entrega</label>
                  <input type="date" style={s.input} value={form.fecha_fin} onChange={e => setForm({ ...form, fecha_fin: e.target.value })} />
                </div>
                <div style={s.fullWidth}>
                  <label style={s.label}>Descripción</label>
                  <textarea style={{ ...s.input, height: 64, resize: 'vertical' }} value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} />
                </div>
                <div style={s.fullWidth}>
                  <label style={s.label}>Notas internas</label>
                  <textarea style={{ ...s.input, height: 56, resize: 'vertical' }} value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} />
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
  cardDesc:     { fontSize: 12, color: '#666', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 360 },
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
  errorMsg:     { marginTop: 12, background: '#fff5f5', border: '1px solid #fca5a5', color: '#dc2626', padding: '8px 12px', borderRadius: 3, fontSize: 13, borderLeft: '3px solid #dc2626' },
  modalFooter:  { padding: '14px 20px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: 10, position: 'sticky', bottom: 0, background: '#fff' },
  btnSecundario:{ background: '#fff', color: '#333', border: '1px solid #ddd', padding: '8px 16px', borderRadius: 3, cursor: 'pointer', fontSize: 13 },
}
