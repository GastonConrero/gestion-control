import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../utils/api'

function fmtFecha(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
}

export default function PlanificacionSemanal() {
  const { usuario } = useAuth()
  const [tareas, setTareas] = useState([])
  const [loading, setLoading] = useState(true)
  const [nueva, setNueva] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [mostrarCompletadas, setMostrarCompletadas] = useState(false)

  const cargar = async () => {
    setLoading(true)
    try {
      const res = await api.get('/api/tareas/')
      setTareas(res.data)
    } catch { /* silencioso */ }
    finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const crear = async () => {
    if (!nueva.trim()) return
    setGuardando(true)
    try {
      await api.post('/api/tareas/', { descripcion: nueva.trim() })
      setNueva(''); cargar()
    } catch { alert('Error al crear la tarea') }
    finally { setGuardando(false) }
  }

  const onKeyDown = (e) => { if (e.key === 'Enter') crear() }

  const toggle = async (t) => {
    try {
      const accion = t.completada ? 'reabrir' : 'completar'
      await api.post(`/api/tareas/${t.id}/${accion}`)
      cargar()
    } catch { alert('No podés modificar esta tarea') }
  }

  const eliminar = async (id) => {
    try {
      await api.delete(`/api/tareas/${id}`)
      cargar()
    } catch { alert('No podés eliminar esta tarea') }
  }

  const pendientes = tareas.filter(t => !t.completada)
  const completadas = tareas.filter(t => t.completada)

  return (
    <div style={s.box}>
      <div style={s.header}>
        <h3 style={s.titulo}>Planificación semanal</h3>
        <span style={s.contador}>{pendientes.length} pendiente{pendientes.length !== 1 ? 's' : ''}</span>
      </div>

      <div style={s.nuevaFila}>
        <input
          style={s.input}
          value={nueva}
          onChange={e => setNueva(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Agregar tarea..."
        />
        <button onClick={crear} style={s.btnAgregar} disabled={guardando || !nueva.trim()}>+</button>
      </div>

      {loading ? (
        <div style={s.vacio}>Cargando...</div>
      ) : pendientes.length === 0 ? (
        <div style={s.vacio}>No hay tareas pendientes.</div>
      ) : (
        <div style={s.lista}>
          {pendientes.map(t => (
            <div key={t.id} style={s.fila}>
              <input type="checkbox" checked={false} onChange={() => toggle(t)} style={s.checkbox} />
              <div style={s.filaTexto}>
                <span style={s.descripcion}>{t.descripcion}</span>
                <span style={s.autor}>{t.usuario_nombre} · {fmtFecha(t.created_at)}</span>
              </div>
              {(t.usuario_id === usuario?.id || usuario?.rol === 'gaston') && (
                <button onClick={() => eliminar(t.id)} style={s.btnEliminar}>✕</button>
              )}
            </div>
          ))}
        </div>
      )}

      {completadas.length > 0 && (
        <>
          <button onClick={() => setMostrarCompletadas(!mostrarCompletadas)} style={s.btnToggleCompletadas}>
            {mostrarCompletadas ? 'Ocultar' : 'Ver'} completadas ({completadas.length})
          </button>
          {mostrarCompletadas && (
            <div style={s.lista}>
              {completadas.map(t => (
                <div key={t.id} style={{ ...s.fila, opacity: 0.5 }}>
                  <input type="checkbox" checked={true} onChange={() => toggle(t)} style={s.checkbox} />
                  <div style={s.filaTexto}>
                    <span style={{ ...s.descripcion, textDecoration: 'line-through' }}>{t.descripcion}</span>
                    <span style={s.autor}>{t.usuario_nombre} · completada {fmtFecha(t.fecha_completada)}</span>
                  </div>
                  {(t.usuario_id === usuario?.id || usuario?.rol === 'gaston') && (
                    <button onClick={() => eliminar(t.id)} style={s.btnEliminar}>✕</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

const s = {
  box:          { background: '#fff', borderRadius: 4, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: '18px 20px', marginBottom: 24 },
  header:       { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  titulo:       { fontSize: 14, fontWeight: 700, color: '#111', margin: 0 },
  contador:     { fontSize: 12, color: '#888' },
  nuevaFila:    { display: 'flex', gap: 8, marginBottom: 14 },
  input:        { flex: 1, padding: '8px 10px', border: '1px solid #ddd', borderRadius: 3, fontSize: 13, outline: 'none' },
  btnAgregar:   { background: '#D4502A', color: '#fff', border: 'none', width: 36, borderRadius: 3, cursor: 'pointer', fontSize: 16, fontWeight: 700 },
  lista:        { display: 'flex', flexDirection: 'column', gap: 2 },
  fila:         { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f2f2f2' },
  checkbox:      { width: 16, height: 16, cursor: 'pointer', flexShrink: 0 },
  filaTexto:    { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  descripcion:  { fontSize: 13, color: '#111' },
  autor:        { fontSize: 11, color: '#999', marginTop: 1 },
  btnEliminar:  { background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 13, padding: '0 4px' },
  vacio:        { textAlign: 'center', color: '#aaa', fontSize: 13, padding: '10px 0' },
  btnToggleCompletadas: { background: 'none', border: 'none', color: '#D4502A', fontSize: 12, cursor: 'pointer', marginTop: 10, padding: 0, fontWeight: 600 },
}
