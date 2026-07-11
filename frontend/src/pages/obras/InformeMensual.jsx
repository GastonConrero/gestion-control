import { useState, useEffect } from 'react'
import api from '../../utils/api'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function periodoActual() {
  const d = new Date()
  return `${MESES[d.getMonth()]} ${d.getFullYear()}`
}

function fmtFechaHora(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('es-AR') + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

export default function InformeMensual({ clienteId, obraId }) {
  const [periodo, setPeriodo] = useState(periodoActual())
  const [semanas, setSemanas] = useState({})       // { 1: {...}, 2: {...}, ... }
  const [sintesis, setSintesis] = useState('')
  const [loading, setLoading] = useState(true)
  const [guardandoSemana, setGuardandoSemana] = useState(null)
  const [guardandoSintesis, setGuardandoSintesis] = useState(false)
  const [descargando, setDescargando] = useState(false)
  const [guardadoOk, setGuardadoOk] = useState(null)
  const [historial, setHistorial] = useState([])
  const [editandoHistId, setEditandoHistId] = useState(null)
  const [textoEditHist, setTextoEditHist] = useState('')

  const base = `/api/clientes/${clienteId}/obras/${obraId}/informe`

  const cargar = async () => {
    setLoading(true)
    try {
      const [rs, rsin, rh] = await Promise.all([
        api.get(`${base}/seguimiento`, { params: { periodo } }),
        api.get(`${base}/sintesis`, { params: { periodo } }),
        api.get(`${base}/historial`),
      ])
      const mapa = {}
      for (let n = 1; n <= 4; n++) {
        const encontrado = rs.data.find(s => s.semana_numero === n)
        mapa[n] = encontrado || { descripcion: '', foto_url_1: '', foto_url_2: '' }
      }
      setSemanas(mapa)
      setSintesis(rsin.data?.texto || '')
      setHistorial(rh.data)
    } catch {
      setSemanas({ 1: {}, 2: {}, 3: {}, 4: {} })
    } finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [periodo, obraId])

  const actualizarCampo = (n, campo, valor) => {
    setSemanas(prev => ({ ...prev, [n]: { ...prev[n], [campo]: valor } }))
  }

  const guardarSemana = async (n) => {
    setGuardandoSemana(n); setGuardadoOk(null)
    try {
      const s = semanas[n]
      await api.post(`${base}/seguimiento`, {
        periodo, semana_numero: n,
        descripcion: s.descripcion || null,
        foto_url_1: s.foto_url_1 || null,
        foto_url_2: s.foto_url_2 || null,
      })
      setGuardadoOk(n)
      setTimeout(() => setGuardadoOk(null), 1500)
    } catch { alert('Error al guardar la semana') }
    finally { setGuardandoSemana(null) }
  }

  const guardarSintesis = async () => {
    setGuardandoSintesis(true)
    try {
      await api.post(`${base}/sintesis`, { periodo, texto: sintesis || null })
    } catch { alert('Error al guardar la síntesis') }
    finally { setGuardandoSintesis(false) }
  }

  const descargarPDF = async (periodoDescarga = periodo) => {
    setDescargando(true)
    try {
      const res = await api.get(`${base}/pdf`, { params: { periodo: periodoDescarga }, responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url; a.download = `informe_${periodoDescarga.replace(' ', '_')}.pdf`; a.click()
      window.URL.revokeObjectURL(url)
      const rh = await api.get(`${base}/historial`)
      setHistorial(rh.data)
    } catch { alert('Error al generar el PDF. Revisá que haya al menos un certificado cargado para este período.') }
    finally { setDescargando(false) }
  }

  const eliminarInforme = async (id) => {
    if (!window.confirm('¿Eliminar este registro del historial? El informe ya descargado no se ve afectado, solo se borra el registro.')) return
    try {
      await api.delete(`${base}/historial/${id}`)
      const rh = await api.get(`${base}/historial`)
      setHistorial(rh.data)
    } catch { alert('Error al eliminar') }
  }

  const abrirEditHist = (h) => { setEditandoHistId(h.id); setTextoEditHist(h.periodo) }
  const cancelarEditHist = () => { setEditandoHistId(null); setTextoEditHist('') }

  const guardarEditHist = async (id) => {
    if (!textoEditHist.trim()) return
    try {
      await api.put(`${base}/historial/${id}`, { periodo: textoEditHist.trim() })
      cancelarEditHist()
      const rh = await api.get(`${base}/historial`)
      setHistorial(rh.data)
    } catch { alert('Error al editar') }
  }

  return (
    <div style={s.seccion}>
      <div style={s.seccionHeader}>
        <div style={s.seccionTitulo}>Informe mensual de avance</div>
      </div>

      <div style={s.periodoFila}>
        <label style={s.label}>Período</label>
        <input style={s.inputPeriodo} value={periodo} onChange={e => setPeriodo(e.target.value)}
          placeholder="Ej: Julio 2026" />
        <button onClick={() => descargarPDF()} style={s.btnPdf} disabled={descargando}>
          {descargando ? 'Generando...' : '📄 Descargar PDF'}
        </button>
      </div>
      <div style={s.hint}>Usá el mismo texto de período que usás en los certificados de avance (ej: "Julio 2026"), así el informe toma la ejecución acumulada y la curva correctas.</div>

      {loading ? (
        <div style={s.empty}>Cargando...</div>
      ) : (
        <>
          <div style={s.semanasGrid}>
            {[1, 2, 3, 4].map(n => (
              <div key={n} style={s.semanaCard}>
                <div style={s.semanaHeader}>
                  <span style={s.semanaTitulo}>Semana {n}</span>
                  {guardadoOk === n && <span style={s.guardadoTag}>✓ guardado</span>}
                </div>
                <textarea
                  style={s.textarea}
                  value={semanas[n]?.descripcion || ''}
                  placeholder="Qué se hizo esta semana..."
                  onChange={e => actualizarCampo(n, 'descripcion', e.target.value)}
                />
                <input
                  style={s.inputFoto}
                  value={semanas[n]?.foto_url_1 || ''}
                  placeholder="URL foto 1 (opcional)"
                  onChange={e => actualizarCampo(n, 'foto_url_1', e.target.value)}
                />
                <input
                  style={s.inputFoto}
                  value={semanas[n]?.foto_url_2 || ''}
                  placeholder="URL foto 2 (opcional)"
                  onChange={e => actualizarCampo(n, 'foto_url_2', e.target.value)}
                />
                <button onClick={() => guardarSemana(n)} style={s.btnGuardarSemana} disabled={guardandoSemana === n}>
                  {guardandoSemana === n ? 'Guardando...' : 'Guardar semana'}
                </button>
              </div>
            ))}
          </div>

          <div style={s.sintesisBox}>
            <div style={s.subTitulo}>Síntesis del mes</div>
            <textarea
              style={{ ...s.textarea, height: 70 }}
              value={sintesis}
              placeholder="Resumen general del mes para el cliente..."
              onChange={e => setSintesis(e.target.value)}
            />
            <button onClick={guardarSintesis} style={s.btnGuardarSemana} disabled={guardandoSintesis}>
              {guardandoSintesis ? 'Guardando...' : 'Guardar síntesis'}
            </button>
          </div>

          <div style={s.hintFormula}>
            Las fotos se cargan pegando un link (por ejemplo, subida a Google Drive/WhatsApp Web y "copiar link"). Hasta 2 fotos por semana, según el formato del informe.
          </div>

          {historial.length > 0 && (
            <div style={s.historialBox}>
              <div style={s.subTitulo}>Informes generados</div>
              <div style={s.historialLista}>
                {historial.map(h => (
                  <div key={h.id} style={s.historialFila}>
                    {editandoHistId === h.id ? (
                      <div style={s.historialEditFila}>
                        <input
                          style={s.inputEditHist}
                          value={textoEditHist}
                          autoFocus
                          onChange={e => setTextoEditHist(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') guardarEditHist(h.id); if (e.key === 'Escape') cancelarEditHist() }}
                        />
                        <button onClick={() => guardarEditHist(h.id)} style={s.btnGuardarSemana}>Guardar</button>
                        <button onClick={cancelarEditHist} style={s.btnCancelarHist}>Cancelar</button>
                      </div>
                    ) : (
                      <>
                        <div>
                          <span style={s.historialNumero}>{h.numero}</span>
                          <span style={s.historialDetalle}> · {h.periodo} · {h.usuario_nombre}</span>
                          <div style={s.historialFecha}>{fmtFechaHora(h.created_at)}</div>
                        </div>
                        <div style={s.historialAcciones}>
                          <button onClick={() => descargarPDF(h.periodo)} style={s.btnGuardarSemana} disabled={descargando}>
                            Volver a descargar
                          </button>
                          <button onClick={() => abrirEditHist(h)} style={s.btnMiniHist}>Editar</button>
                          <button onClick={() => eliminarInforme(h.id)} style={s.btnEliminarHist}>Eliminar</button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const s = {
  seccion:        { background: '#fff', borderRadius: 4, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: '16px 20px', marginBottom: 16 },
  seccionHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  seccionTitulo:  { fontSize: 13, fontWeight: 700, color: '#111', textTransform: 'uppercase', letterSpacing: '0.03em' },
  periodoFila:    { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 },
  label:          { fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.03em' },
  inputPeriodo:   { padding: '7px 10px', border: '1px solid #ddd', borderRadius: 3, fontSize: 13, width: 160 },
  btnPdf:         { background: '#D4502A', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: 3, cursor: 'pointer', fontSize: 12, fontWeight: 600, marginLeft: 'auto' },
  hint:           { fontSize: 11, color: '#999', marginBottom: 16 },
  semanasGrid:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 18 },
  semanaCard:     { border: '1px solid #eee', borderRadius: 4, padding: 12 },
  semanaHeader:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  semanaTitulo:   { fontSize: 12, fontWeight: 700, color: '#D4502A' },
  guardadoTag:    { fontSize: 10, color: '#16a34a', fontWeight: 600 },
  textarea:       { width: '100%', height: 56, padding: '6px 8px', border: '1px solid #ddd', borderRadius: 3, fontSize: 12, resize: 'vertical', boxSizing: 'border-box', marginBottom: 6, fontFamily: 'inherit' },
  inputFoto:      { width: '100%', padding: '5px 7px', border: '1px solid #eee', borderRadius: 3, fontSize: 11, marginBottom: 5, boxSizing: 'border-box' },
  btnGuardarSemana: { background: '#fff', color: '#D4502A', border: '1px solid #D4502A', padding: '5px 10px', borderRadius: 3, cursor: 'pointer', fontSize: 11, fontWeight: 600, marginTop: 4 },
  sintesisBox:    { background: '#FBF6EE', borderRadius: 4, padding: 14, marginBottom: 10 },
  subTitulo:      { fontSize: 12, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 8 },
  hintFormula:    { fontSize: 11, color: '#999' },
  historialBox:   { marginTop: 18, paddingTop: 14, borderTop: '1px solid #f2f2f2' },
  historialLista: { display: 'flex', flexDirection: 'column', gap: 6 },
  historialFila:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #eee', borderRadius: 3, padding: '8px 12px' },
  historialNumero:{ fontSize: 12, fontWeight: 700, color: '#D4502A' },
  historialDetalle:{ fontSize: 12, color: '#555' },
  historialFecha: { fontSize: 11, color: '#999', marginTop: 2 },
  historialAcciones: { display: 'flex', gap: 6, flexShrink: 0 },
  historialEditFila: { display: 'flex', gap: 6, alignItems: 'center', width: '100%' },
  inputEditHist:  { flex: 1, padding: '6px 8px', border: '1px solid #D4502A', borderRadius: 3, fontSize: 12 },
  btnMiniHist:    { background: '#fff', color: '#555', border: '1px solid #ddd', padding: '5px 10px', borderRadius: 3, cursor: 'pointer', fontSize: 11, fontWeight: 600 },
  btnEliminarHist: { background: '#fff', color: '#dc2626', border: '1px solid #dc2626', padding: '5px 10px', borderRadius: 3, cursor: 'pointer', fontSize: 11, fontWeight: 600 },
  btnCancelarHist: { background: 'none', color: '#999', border: 'none', cursor: 'pointer', fontSize: 11 },
  empty:          { textAlign: 'center', color: '#aaa', padding: 20, fontSize: 13 },
}
