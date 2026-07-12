import { useState, useEffect } from 'react'
import api from '../utils/api'
import FichaListadoMateriales from './materiales/FichaListadoMateriales'

export default function Materiales() {
  const [listados, setListados] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ nombre: '', notas: '' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [fichaId, setFichaId] = useState(null)

  const cargar = async () => {
    setLoading(true)
    try { const r = await api.get('/api/materiales/listados'); setListados(r.data) }
    catch { /* noop */ } finally { setLoading(false) }
  }
  useEffect(() => { cargar() }, [])

  const abrirCrear = () => { setForm({ nombre: '', notas: '' }); setError(''); setModal(true) }

  const guardar = async () => {
    if (!form.nombre) { setError('Ingresá un nombre para el listado'); return }
    setGuardando(true); setError('')
    try {
      const r = await api.post('/api/materiales/listados', { nombre: form.nombre, notas: form.notas || null })
      setModal(false); cargar(); setFichaId(r.data.id)
    } catch { setError('Error al guardar') }
    finally { setGuardando(false) }
  }

  const eliminar = async (id) => {
    if (!window.confirm('¿Eliminar este listado, sus ítems y todas sus cotizaciones?')) return
    try { await api.delete(`/api/materiales/listados/${id}`); cargar() } catch { alert('Error al eliminar') }
  }

  if (fichaId !== null) {
    return <FichaListadoMateriales listadoId={fichaId} onVolver={() => { setFichaId(null); cargar() }} />
  }

  return (
    <div>
      <div style={s.header}>
        <div>
          <h2 style={s.titulo}>Materiales</h2>
          <p style={s.subtitulo}>{listados.length} listado{listados.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={abrirCrear} style={s.btnPrimario}>+ Nuevo listado</button>
      </div>

      {loading ? (
        <div style={s.empty}>Cargando...</div>
      ) : listados.length === 0 ? (
        <div style={s.empty}>No hay listados de materiales cargados.</div>
      ) : (
        <div style={s.lista}>
          {listados.map(l => (
            <div key={l.id} style={s.card}>
              <div style={s.cardInfo} onClick={() => setFichaId(l.id)}>
                <div style={s.cardNombre}>{l.nombre}</div>
                <div style={s.cardSub}>
                  {l.obra_nombre ? `Obra: ${l.obra_nombre} · ` : ''}
                  {l.cant_items} ítem{l.cant_items !== 1 ? 's' : ''} · {l.cant_cotizaciones} cotización{l.cant_cotizaciones !== 1 ? 'es' : ''}
                </div>
              </div>
              <div style={s.cardAcciones}>
                <button onClick={() => setFichaId(l.id)} style={s.btnMini}>Ver ficha</button>
                <button onClick={() => eliminar(l.id)} style={{ ...s.btnMini, color: '#dc2626' }}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div style={s.overlay} onClick={() => setModal(false)}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitulo}>Nuevo listado de materiales</h3>
              <button onClick={() => setModal(false)} style={s.btnCerrar}>✕</button>
            </div>
            <div style={s.modalBody}>
              <label style={s.label}>Nombre <span style={{ color: '#D4502A' }}>*</span></label>
              <input style={s.input} value={form.nombre} autoFocus
                placeholder="Ej: Materiales 1era etapa - Obra Rasino"
                onChange={e => setForm({ ...form, nombre: e.target.value })} />
              <label style={{ ...s.label, marginTop: 12 }}>Notas</label>
              <textarea style={{ ...s.input, height: 60, resize: 'vertical' }} value={form.notas}
                onChange={e => setForm({ ...form, notas: e.target.value })} />
              {error && <div style={s.errorMsg}>{error}</div>}
            </div>
            <div style={s.modalFooter}>
              <button onClick={() => setModal(false)} style={s.btnSecundario}>Cancelar</button>
              <button onClick={guardar} style={s.btnPrimario} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  header:       { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  titulo:       { fontSize: 20, fontWeight: 700, color: '#111', margin: 0 },
  subtitulo:    { fontSize: 13, color: '#888', margin: '4px 0 0' },
  btnPrimario:  { background: '#D4502A', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: 3, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  lista:        { display: 'flex', flexDirection: 'column', gap: 10 },
  card:         { background: '#fff', border: '1px solid #eee', borderRadius: 4, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  cardInfo:     { flex: 1, cursor: 'pointer' },
  cardNombre:   { fontSize: 14, fontWeight: 700, color: '#111' },
  cardSub:      { fontSize: 12, color: '#888', marginTop: 3 },
  cardAcciones: { display: 'flex', gap: 6 },
  btnMini:      { background: 'none', border: '1px solid #ddd', color: '#555', padding: '4px 10px', borderRadius: 3, cursor: 'pointer', fontSize: 12 },
  empty:        { textAlign: 'center', color: '#aaa', padding: 40, background: '#fff', borderRadius: 4, border: '1px dashed #ddd', fontSize: 13 },
  overlay:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalCard:    { background: '#fff', borderRadius: 4, width: '100%', maxWidth: 480, boxShadow: '0 8px 40px rgba(0,0,0,0.2)' },
  modalHeader:  { padding: '16px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  modalTitulo:  { fontSize: 16, fontWeight: 700, margin: 0, color: '#111' },
  btnCerrar:    { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888' },
  modalBody:    { padding: '20px' },
  label:        { display: 'block', fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' },
  input:        { width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 3, fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  errorMsg:     { marginTop: 12, background: '#fff5f5', border: '1px solid #fca5a5', color: '#dc2626', padding: '8px 12px', borderRadius: 3, fontSize: 13, borderLeft: '3px solid #dc2626' },
  modalFooter:  { padding: '14px 20px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: 10 },
  btnSecundario:{ background: '#fff', color: '#333', border: '1px solid #ddd', padding: '9px 18px', borderRadius: 3, cursor: 'pointer', fontSize: 13 },
}
