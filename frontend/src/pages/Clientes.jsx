import { useState, useEffect } from 'react'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'
import ListaProyectos from './proyectos/ListaProyectos'
import ListaObras from './obras/ListaObras'

const CAMPOS = [
  { key: 'apellido',  label: 'Apellido',  required: true },
  { key: 'nombre',    label: 'Nombre',    required: true },
  { key: 'email',     label: 'Email',     required: false },
  { key: 'telefono',  label: 'Teléfono',  required: false },
  { key: 'direccion', label: 'Dirección', required: false },
  { key: 'localidad', label: 'Localidad', required: false },
  { key: 'notas',     label: 'Notas',     required: false, textarea: true },
]

const EMPTY = { apellido: '', nombre: '', email: '', telefono: '', direccion: '', localidad: '', notas: '' }

const TABS = [
  { key: 'proyectos',  label: 'Proyectos' },
  { key: 'obras',      label: 'Obras' },
  { key: 'documentos', label: 'Documentos' },
  { key: 'actividad',  label: 'Actividad' },
]

export default function Clientes() {
  const { usuario: user } = useAuth()
  const [clientes, setClientes]           = useState([])
  const [busqueda, setBusqueda]           = useState('')
  const [loading, setLoading]             = useState(true)
  const [modal, setModal]                 = useState(null)
  const [form, setForm]                   = useState(EMPTY)
  const [guardando, setGuardando]         = useState(false)
  const [error, setError]                 = useState('')
  const [clienteAbierto, setClienteAbierto] = useState(null)
  const [tabActivo, setTabActivo]         = useState('proyectos')

  const rol = user?.rol || ''

  const cargar = async (q = '') => {
    setLoading(true)
    try {
      const res = await api.get('/api/clientes/' + (q ? `?busqueda=${q}` : ''))
      setClientes(res.data)
    } catch { setError('Error al cargar clientes') }
    finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const buscar = (e) => { setBusqueda(e.target.value); cargar(e.target.value) }
  const abrirCrear  = () => { setForm(EMPTY); setError(''); setModal('crear') }
  const abrirEditar = (c) => { setForm({ ...c }); setError(''); setModal(c) }
  const cerrar = () => { setModal(null); setError('') }

  const guardar = async () => {
    if (!form.apellido || !form.nombre) { setError('Apellido y nombre son obligatorios'); return }
    setGuardando(true); setError('')
    try {
      if (modal === 'crear') {
        await api.post('/api/clientes/', form)
      } else {
        await api.put(`/api/clientes/${modal.id}`, form)
        if (clienteAbierto && clienteAbierto.id === modal.id) setClienteAbierto({ ...clienteAbierto, ...form })
      }
      cerrar(); cargar(busqueda)
    } catch { setError('Error al guardar') }
    finally { setGuardando(false) }
  }

  const eliminar = async (id) => {
    if (!window.confirm('¿Eliminar este cliente?')) return
    try {
      await api.delete(`/api/clientes/${id}`)
      if (clienteAbierto && clienteAbierto.id === id) setClienteAbierto(null)
      cargar(busqueda)
    } catch { alert('Error al eliminar') }
  }

  const abrirCarpeta = (c) => { setClienteAbierto(c); setTabActivo('proyectos') }

  // ── Carpeta del cliente ────────────────────────────────────────────────────
  if (clienteAbierto) {
    return (
      <div>
        <div style={st.breadcrumb}>
          <button onClick={() => setClienteAbierto(null)} style={st.btnVolver}>← Clientes</button>
          <span style={st.breadSep}>/</span>
          <span style={st.breadActual}>{clienteAbierto.apellido}, {clienteAbierto.nombre}</span>
        </div>

        <div style={st.carpetaLayout}>
          <div style={st.panelIzq}>
            <div style={st.clienteCard}>
              <div style={st.clienteNombre}>{clienteAbierto.apellido}, {clienteAbierto.nombre}</div>
              {clienteAbierto.email    && <div style={st.clienteDato}>{clienteAbierto.email}</div>}
              {clienteAbierto.telefono && <div style={st.clienteDato}>{clienteAbierto.telefono}</div>}
              {clienteAbierto.localidad && <div style={st.clienteDato}>{clienteAbierto.localidad}</div>}
              {clienteAbierto.direccion && <div style={{ ...st.clienteDato, color: '#aaa' }}>{clienteAbierto.direccion}</div>}
              {clienteAbierto.notas    && <div style={st.clienteNotas}>{clienteAbierto.notas}</div>}
              <div style={st.clienteAcciones}>
                <button onClick={() => abrirEditar(clienteAbierto)} style={st.btnAccionFull}>Editar datos</button>
                {rol === 'gaston' && (
                  <button onClick={() => eliminar(clienteAbierto.id)} style={{ ...st.btnAccionFull, color: '#dc2626', marginTop: 6 }}>Eliminar cliente</button>
                )}
              </div>
            </div>
          </div>

          <div style={st.panelDer}>
            <div style={st.tabsBar}>
              {TABS.map(t => (
                <button key={t.key} onClick={() => setTabActivo(t.key)}
                  style={{ ...st.tabBtn, ...(tabActivo === t.key ? st.tabBtnActivo : {}) }}>
                  {t.label}
                </button>
              ))}
            </div>
            <div style={st.tabContenido}>
              {tabActivo === 'proyectos' && <ListaProyectos clienteId={clienteAbierto.id} rol={rol} />}
              {tabActivo === 'obras'      && <ListaObras clienteId={clienteAbierto.id} rol={rol} />}
              {tabActivo === 'documentos' && <div style={st.proximamente}>Módulo de Documentos — próximamente</div>}
              {tabActivo === 'actividad'  && <div style={st.proximamente}>Historial de actividad — próximamente</div>}
            </div>
          </div>
        </div>

        {modal !== null && (
          <ModalCliente modal={modal} form={form} setForm={setForm} error={error}
            guardando={guardando} onGuardar={guardar} onCerrar={cerrar} />
        )}
      </div>
    )
  }

  // ── Lista de clientes ──────────────────────────────────────────────────────
  return (
    <div>
      <div style={st.pageHeader}>
        <div>
          <h2 style={st.titulo}>Clientes</h2>
          <p style={st.subtitulo}>{clientes.length} cliente{clientes.length !== 1 ? 's' : ''} registrado{clientes.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={abrirCrear} style={st.btnPrimario}>+ Nuevo cliente</button>
      </div>

      <div style={st.searchBar}>
        <input type="text" placeholder="Buscar por nombre o apellido..." value={busqueda} onChange={buscar} style={st.searchInput} />
      </div>

      {loading ? (
        <div style={st.loading}>Cargando...</div>
      ) : clientes.length === 0 ? (
        <div style={st.empty}>{busqueda ? 'No se encontraron clientes.' : 'No hay clientes registrados aún.'}</div>
      ) : (
        <div style={st.tableWrap}>
          <table style={st.table}>
            <thead>
              <tr>{['Apellido y nombre', 'Email', 'Teléfono', 'Localidad', ''].map(h => <th key={h} style={st.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {clientes.map(c => (
                <tr key={c.id} style={{ ...st.tr, cursor: 'pointer' }} onClick={() => abrirCarpeta(c)}>
                  <td style={{ ...st.td, fontWeight: 600 }}>{c.apellido}, {c.nombre}</td>
                  <td style={st.td}>{c.email || '—'}</td>
                  <td style={st.td}>{c.telefono || '—'}</td>
                  <td style={st.td}>{c.localidad || '—'}</td>
                  <td style={{ ...st.td, textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => abrirEditar(c)} style={st.btnAccion}>Editar</button>
                    {rol === 'gaston' && (
                      <button onClick={() => eliminar(c.id)} style={{ ...st.btnAccion, color: '#dc2626', marginLeft: 6 }}>Eliminar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal !== null && (
        <ModalCliente modal={modal} form={form} setForm={setForm} error={error}
          guardando={guardando} onGuardar={guardar} onCerrar={cerrar} />
      )}
    </div>
  )
}

function ModalCliente({ modal, form, setForm, error, guardando, onGuardar, onCerrar }) {
  return (
    <div style={st.overlay} onClick={onCerrar}>
      <div style={st.modalCard} onClick={e => e.stopPropagation()}>
        <div style={st.modalHeader}>
          <h3 style={st.modalTitulo}>{modal === 'crear' ? 'Nuevo cliente' : `Editar: ${modal.apellido}, ${modal.nombre}`}</h3>
          <button onClick={onCerrar} style={st.btnCerrar}>✕</button>
        </div>
        <div style={st.modalBody}>
          <div style={st.grid}>
            {CAMPOS.map(campo => (
              <div key={campo.key} style={campo.textarea ? st.fullWidth : {}}>
                <label style={st.label}>{campo.label}{campo.required && <span style={{ color: '#D4502A' }}> *</span>}</label>
                {campo.textarea ? (
                  <textarea value={form[campo.key] || ''} onChange={e => setForm({ ...form, [campo.key]: e.target.value })} style={{ ...st.input, height: 72, resize: 'vertical' }} />
                ) : (
                  <input type={campo.key === 'email' ? 'email' : 'text'} value={form[campo.key] || ''} onChange={e => setForm({ ...form, [campo.key]: e.target.value })} style={st.input} />
                )}
              </div>
            ))}
          </div>
          {error && <div style={st.errorMsg}>{error}</div>}
        </div>
        <div style={st.modalFooter}>
          <button onClick={onCerrar} style={st.btnSecundario}>Cancelar</button>
          <button onClick={onGuardar} style={st.btnPrimario} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  )
}

const st = {
  pageHeader:    { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  titulo:        { fontSize: 20, fontWeight: 700, color: '#111', margin: 0 },
  subtitulo:     { fontSize: 13, color: '#888', margin: '4px 0 0' },
  btnPrimario:   { background: '#D4502A', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: 3, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  btnSecundario: { background: '#fff', color: '#333', border: '1px solid #ddd', padding: '9px 18px', borderRadius: 3, cursor: 'pointer', fontSize: 13 },
  searchBar:     { marginBottom: 16 },
  searchInput:   { width: '100%', maxWidth: 360, padding: '8px 12px', border: '1px solid #ddd', borderRadius: 3, fontSize: 14, outline: 'none', boxSizing: 'border-box' },
  loading:       { textAlign: 'center', color: '#888', padding: 40 },
  empty:         { textAlign: 'center', color: '#aaa', padding: 40, background: '#fff', borderRadius: 4, border: '1px dashed #ddd' },
  tableWrap:     { background: '#fff', borderRadius: 4, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
  table:         { width: '100%', borderCollapse: 'collapse' },
  th:            { padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #eee', background: '#fafafa' },
  tr:            { borderBottom: '1px solid #f0f0f0' },
  td:            { padding: '11px 16px', fontSize: 13, color: '#333' },
  btnAccion:     { background: 'none', border: '1px solid #ddd', color: '#555', padding: '3px 10px', borderRadius: 3, cursor: 'pointer', fontSize: 12 },
  overlay:       { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalCard:     { background: '#fff', borderRadius: 4, width: '100%', maxWidth: 560, boxShadow: '0 8px 40px rgba(0,0,0,0.2)', overflow: 'hidden' },
  modalHeader:   { padding: '16px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  modalTitulo:   { fontSize: 16, fontWeight: 700, margin: 0, color: '#111' },
  btnCerrar:     { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888' },
  modalBody:     { padding: '20px' },
  grid:          { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' },
  fullWidth:     { gridColumn: '1 / -1' },
  label:         { display: 'block', fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' },
  input:         { width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 3, fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  errorMsg:      { marginTop: 12, background: '#fff5f5', border: '1px solid #fca5a5', color: '#dc2626', padding: '8px 12px', borderRadius: 3, fontSize: 13, borderLeft: '3px solid #dc2626' },
  modalFooter:   { padding: '14px 20px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: 10 },
  breadcrumb:    { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 },
  btnVolver:     { background: 'none', border: 'none', color: '#D4502A', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0 },
  breadSep:      { color: '#ccc', fontSize: 13 },
  breadActual:   { fontSize: 13, color: '#333', fontWeight: 600 },
  carpetaLayout: { display: 'grid', gridTemplateColumns: '240px 1fr', gap: 20, alignItems: 'start' },
  panelIzq:      {},
  panelDer:      {},
  clienteCard:   { background: '#fff', border: '1px solid #eee', borderRadius: 4, padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  clienteNombre: { fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 10, lineHeight: 1.3 },
  clienteDato:   { fontSize: 12, color: '#666', marginBottom: 4 },
  clienteNotas:  { fontSize: 12, color: '#888', marginTop: 10, paddingTop: 10, borderTop: '1px solid #f0f0f0', fontStyle: 'italic' },
  clienteAcciones: { marginTop: 14, paddingTop: 12, borderTop: '1px solid #f0f0f0' },
  btnAccionFull: { display: 'block', width: '100%', background: 'none', border: '1px solid #ddd', color: '#555', padding: '6px', borderRadius: 3, cursor: 'pointer', fontSize: 12, textAlign: 'center' },
  tabsBar:       { display: 'flex', borderBottom: '2px solid #eee', marginBottom: 16 },
  tabBtn:        { background: 'none', border: 'none', padding: '8px 16px', cursor: 'pointer', fontSize: 13, color: '#888', borderBottom: '2px solid transparent', marginBottom: -2 },
  tabBtnActivo:  { color: '#D4502A', borderBottom: '2px solid #D4502A', fontWeight: 700 },
  tabContenido:  { minHeight: 200 },
  proximamente:  { textAlign: 'center', color: '#aaa', padding: 40, background: '#fff', borderRadius: 4, border: '1px dashed #ddd', fontSize: 13 },
}
