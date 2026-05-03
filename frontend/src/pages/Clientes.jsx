import { useState, useEffect } from 'react'
import api from '../utils/api'

const CAMPOS = [
  { key: 'apellido', label: 'Apellido', required: true },
  { key: 'nombre', label: 'Nombre', required: true },
  { key: 'email', label: 'Email', required: false },
  { key: 'telefono', label: 'Teléfono', required: false },
  { key: 'direccion', label: 'Dirección', required: false },
  { key: 'localidad', label: 'Localidad', required: false },
  { key: 'notas', label: 'Notas', required: false, textarea: true },
]

const EMPTY = { apellido: '', nombre: '', email: '', telefono: '', direccion: '', localidad: '', notas: '' }

export default function Clientes() {
  const [clientes, setClientes] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | 'crear' | cliente
  const [form, setForm] = useState(EMPTY)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const cargar = async (q = '') => {
    setLoading(true)
    try {
      const res = await api.get('/api/clientes/' + (q ? `?busqueda=${q}` : ''))
      setClientes(res.data)
    } catch {
      setError('Error al cargar clientes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const buscar = (e) => {
    setBusqueda(e.target.value)
    cargar(e.target.value)
  }

  const abrirCrear = () => {
    setForm(EMPTY)
    setError('')
    setModal('crear')
  }

  const abrirEditar = (c) => {
    setForm({ ...c })
    setError('')
    setModal(c)
  }

  const cerrar = () => { setModal(null); setError('') }

  const guardar = async () => {
    if (!form.apellido || !form.nombre) { setError('Apellido y nombre son obligatorios'); return }
    setGuardando(true)
    setError('')
    try {
      if (modal === 'crear') {
        await api.post('/api/clientes/', form)
      } else {
        await api.put(`/api/clientes/${modal.id}`, form)
      }
      cerrar()
      cargar(busqueda)
    } catch (e) {
      setError('Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  const eliminar = async (id) => {
    if (!window.confirm('¿Eliminar este cliente?')) return
    try {
      await api.delete(`/api/clientes/${id}`)
      cargar(busqueda)
    } catch {
      alert('Error al eliminar')
    }
  }

  return (
    <div>
      {/* Header de sección */}
      <div style={styles.pageHeader}>
        <div>
          <h2 style={styles.titulo}>Clientes</h2>
          <p style={styles.subtitulo}>{clientes.length} cliente{clientes.length !== 1 ? 's' : ''} registrado{clientes.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={abrirCrear} style={styles.btnPrimario}>
          + Nuevo cliente
        </button>
      </div>

      {/* Buscador */}
      <div style={styles.searchBar}>
        <input
          type="text"
          placeholder="Buscar por nombre o apellido..."
          value={busqueda}
          onChange={buscar}
          style={styles.searchInput}
        />
      </div>

      {/* Tabla */}
      {loading ? (
        <div style={styles.loading}>Cargando...</div>
      ) : clientes.length === 0 ? (
        <div style={styles.empty}>
          {busqueda ? 'No se encontraron clientes con esa búsqueda.' : 'No hay clientes registrados aún.'}
        </div>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Apellido y nombre', 'Email', 'Teléfono', 'Localidad', ''].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clientes.map(c => (
                <tr key={c.id} style={styles.tr}>
                  <td style={{ ...styles.td, fontWeight: 600 }}>{c.apellido}, {c.nombre}</td>
                  <td style={styles.td}>{c.email || '—'}</td>
                  <td style={styles.td}>{c.telefono || '—'}</td>
                  <td style={styles.td}>{c.localidad || '—'}</td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>
                    <button onClick={() => abrirEditar(c)} style={styles.btnAccion}>Editar</button>
                    <button onClick={() => eliminar(c.id)} style={{ ...styles.btnAccion, color: '#dc2626', marginLeft: 6 }}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal !== null && (
        <div style={styles.overlay} onClick={cerrar}>
          <div style={styles.modalCard} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitulo}>
                {modal === 'crear' ? 'Nuevo cliente' : `Editar: ${modal.apellido}, ${modal.nombre}`}
              </h3>
              <button onClick={cerrar} style={styles.btnCerrar}>✕</button>
            </div>

            <div style={styles.modalBody}>
              <div style={styles.grid}>
                {CAMPOS.map(campo => (
                  <div key={campo.key} style={campo.textarea ? styles.fullWidth : styles.fieldWrap}>
                    <label style={styles.label}>
                      {campo.label}{campo.required && <span style={{ color: '#D4502A' }}> *</span>}
                    </label>
                    {campo.textarea ? (
                      <textarea
                        value={form[campo.key] || ''}
                        onChange={e => setForm({ ...form, [campo.key]: e.target.value })}
                        style={{ ...styles.input, height: 72, resize: 'vertical' }}
                      />
                    ) : (
                      <input
                        type={campo.key === 'email' ? 'email' : 'text'}
                        value={form[campo.key] || ''}
                        onChange={e => setForm({ ...form, [campo.key]: e.target.value })}
                        style={styles.input}
                      />
                    )}
                  </div>
                ))}
              </div>

              {error && <div style={styles.errorMsg}>{error}</div>}
            </div>

            <div style={styles.modalFooter}>
              <button onClick={cerrar} style={styles.btnSecundario}>Cancelar</button>
              <button onClick={guardar} style={styles.btnPrimario} disabled={guardando}>
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  pageHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20,
  },
  titulo: { fontSize: 20, fontWeight: 700, color: '#111', margin: 0 },
  subtitulo: { fontSize: 13, color: '#888', margin: '4px 0 0' },
  btnPrimario: {
    background: '#D4502A', color: '#fff', border: 'none', padding: '9px 18px',
    borderRadius: 3, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
  btnSecundario: {
    background: '#fff', color: '#333', border: '1px solid #ddd', padding: '9px 18px',
    borderRadius: 3, cursor: 'pointer', fontSize: 13,
  },
  searchBar: { marginBottom: 16 },
  searchInput: {
    width: '100%', maxWidth: 360, padding: '8px 12px', border: '1px solid #ddd',
    borderRadius: 3, fontSize: 14, outline: 'none', boxSizing: 'border-box',
  },
  loading: { textAlign: 'center', color: '#888', padding: 40 },
  empty: {
    textAlign: 'center', color: '#aaa', padding: 40,
    background: '#fff', borderRadius: 4, border: '1px dashed #ddd',
  },
  tableWrap: { background: '#fff', borderRadius: 4, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700,
    color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em',
    borderBottom: '1px solid #eee', background: '#fafafa',
  },
  tr: { borderBottom: '1px solid #f0f0f0' },
  td: { padding: '11px 16px', fontSize: 13, color: '#333' },
  btnAccion: {
    background: 'none', border: '1px solid #ddd', color: '#555',
    padding: '3px 10px', borderRadius: 3, cursor: 'pointer', fontSize: 12,
  },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modalCard: {
    background: '#fff', borderRadius: 4, width: '100%', maxWidth: 560,
    boxShadow: '0 8px 40px rgba(0,0,0,0.2)', overflow: 'hidden',
  },
  modalHeader: {
    padding: '16px 20px', borderBottom: '1px solid #eee',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  modalTitulo: { fontSize: 16, fontWeight: 700, margin: 0, color: '#111' },
  btnCerrar: {
    background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888', lineHeight: 1,
  },
  modalBody: { padding: '20px' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' },
  fullWidth: { gridColumn: '1 / -1' },
  fieldWrap: {},
  label: { display: 'block', fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' },
  input: {
    width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 3,
    fontSize: 13, outline: 'none', boxSizing: 'border-box',
  },
  errorMsg: {
    marginTop: 12, background: '#fff5f5', border: '1px solid #fca5a5',
    color: '#dc2626', padding: '8px 12px', borderRadius: 3, fontSize: 13,
    borderLeft: '3px solid #dc2626',
  },
  modalFooter: {
    padding: '14px 20px', borderTop: '1px solid #eee',
    display: 'flex', justifyContent: 'flex-end', gap: 10,
  },
}
