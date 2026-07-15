import { useState, useEffect } from 'react'
import api from '../../utils/api'
import CronogramaPagos from './CronogramaPagos'
import CertificadosAvance from './CertificadosAvance'
import InformeMensual from './InformeMensual'

const ESTADOS_OBRA = {
  en_curso:  { label: 'En curso',  color: '#D4502A', bg: '#fff4f1' },
  terminada: { label: 'Terminada', color: '#16a34a', bg: '#f0fdf4' },
  pausada:   { label: 'Pausada',   color: '#ca8a04', bg: '#fefce8' },
  cancelada: { label: 'Cancelada', color: '#6b7280', bg: '#f3f4f6' },
}

function fmt(n) {
  if (n === null || n === undefined) return '—'
  return '$ ' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtFecha(iso) {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR')
}

export default function FichaObra({ clienteId, obraId, rol, onVolver }) {
  const [obra, setObra]             = useState(null)
  const [presupuestos, setPresupuestos] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')

  const [modalPresu, setModalPresu] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [presuElegido, setPresuElegido] = useState('')
  const [guardando, setGuardando]   = useState(false)
  const [errorModal, setErrorModal] = useState('')

  const esGaston = rol === 'gaston'

  const cargar = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/api/clientes/${clienteId}/obras/${obraId}`)
      setObra(res.data)
    } catch { setError('Error al cargar la obra') }
    finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [obraId])

  useEffect(() => {
    if (!modalPresu) return
    api.get(`/api/presupuestos/?cliente_id=${clienteId}`).then(r => {
      setPresupuestos(r.data.filter(p => p.estado === 'confirmado'))
    }).catch(() => setPresupuestos([]))
  }, [modalPresu])

  // ── Vincular presupuesto ─────────────────────────────────────────────────
  const confirmarVinculo = async () => {
    if (!presuElegido) { setErrorModal('Seleccioná un presupuesto'); return }
    setGuardando(true); setErrorModal('')
    try {
      await api.post(`/api/clientes/${clienteId}/obras/${obraId}/vincular-presupuesto`, {
        presupuesto_id: Number(presuElegido),
      })
      setModalPresu(false); setPresuElegido(''); cargar()
    } catch (e) {
      setErrorModal(e?.response?.data?.detail || 'Error al vincular')
    } finally { setGuardando(false) }
  }

  // ── Portal del cliente ───────────────────────────────────────────────────
  const copiarLinkPortal = async () => {
    try {
      const r = await api.get(`/api/clientes/${clienteId}/obras/${obraId}/portal-link`)
      const url = `${window.location.origin}/portal/${r.data.token}`
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch { alert('Error al generar el link') }
  }

  const regenerarLinkPortal = async () => {
    if (!window.confirm('¿Generar un link nuevo? El link anterior dejará de funcionar (por si se compartió por error).')) return
    try {
      const r = await api.post(`/api/clientes/${clienteId}/obras/${obraId}/portal-link/regenerar`)
      const url = `${window.location.origin}/portal/${r.data.token}`
      await navigator.clipboard.writeText(url)
      alert('Nuevo link generado y copiado al portapapeles.')
    } catch { alert('Error al regenerar el link') }
  }

  if (loading) return <div style={s.empty}>Cargando...</div>
  if (!obra) return <div style={s.empty}>{error || 'No se encontró la obra'}</div>

  const est = ESTADOS_OBRA[obra.estado] || ESTADOS_OBRA.en_curso
  const saldoPendienteCliente = esGaston ? (Number(obra.total_cliente || 0) - Number(obra.pagado_cliente || 0)) : null
  const saldoPendienteAlbanil = esGaston ? (Number(obra.total_albanil || 0) - Number(obra.pagado_albanil || 0)) : null

  return (
    <div>
      <button onClick={onVolver} style={s.btnVolver}>← Obras</button>

      <div style={s.encabezado}>
        <div>
          <h2 style={s.titulo}>{obra.nombre}</h2>
          <div style={s.subtitulo}>
            {obra.tipo_obra || 'Sin tipo especificado'}
            {obra.superficie ? ` · ${obra.superficie} m²` : ''}
          </div>
        </div>
        <span style={{ ...s.badge, color: est.color, background: est.bg }}>{est.label}</span>
      </div>

      {/* Datos generales */}
      <div style={s.seccion}>
        <div style={s.seccionTitulo}>Datos generales</div>
        <div style={s.datosGrid}>
          <div><span style={s.datoLabel}>Fecha de inicio</span><div style={s.datoValor}>{fmtFecha(obra.fecha_inicio)}</div></div>
          <div><span style={s.datoLabel}>IPC estimado mensual</span><div style={s.datoValor}>{obra.ipc_estimado_mensual}%</div></div>
          <div>
            <span style={s.datoLabel}>Presupuesto vinculado</span>
            <div style={s.datoValor}>
              {obra.presupuesto_numero || '— Sin vincular —'}
              {esGaston && (
                <button onClick={() => { setModalPresu(true); setErrorModal('') }} style={s.linkBtn}>
                  {obra.presupuesto_numero ? 'Cambiar' : 'Vincular presupuesto confirmado'}
                </button>
              )}
            </div>
          </div>
          <div>
            <span style={s.datoLabel}>Portal del cliente</span>
            <div style={s.datoValor}>
              <button onClick={copiarLinkPortal} style={s.linkBtn}>
                {copiado ? '✓ Link copiado' : '🔗 Copiar link para enviar'}
              </button>
              {esGaston && (
                <button onClick={regenerarLinkPortal} style={{ ...s.linkBtn, color: '#999', marginLeft: 10 }}>
                  Generar link nuevo
                </button>
              )}
            </div>
          </div>
        </div>
        {obra.notas && <div style={s.notas}>{obra.notas}</div>}
      </div>

      {!esGaston && (
        <div style={s.avisoRestringido}>
          El cronograma de pagos y los montos son visibles solo para Gastón. Los certificados de avance sí los podés cargar y ver más abajo.
        </div>
      )}

      {esGaston && (
        <>
          {/* Resumen financiero */}
          <div style={s.resumenGrid}>
            <div style={s.resumenCard}>
              <div style={s.resumenLabel}>Total cuenta cliente</div>
              <div style={s.resumenValor}>{fmt(obra.total_cliente)}</div>
            </div>
            <div style={s.resumenCard}>
              <div style={s.resumenLabel}>Pagado (cliente)</div>
              <div style={{ ...s.resumenValor, color: '#16a34a' }}>{fmt(obra.pagado_cliente)}</div>
            </div>
            <div style={s.resumenCard}>
              <div style={s.resumenLabel}>Saldo pendiente (cliente)</div>
              <div style={{ ...s.resumenValor, color: saldoPendienteCliente > 0 ? '#D4502A' : '#111' }}>{fmt(saldoPendienteCliente)}</div>
            </div>
            <div style={s.resumenCard}>
              <div style={s.resumenLabel}>Total cuenta albañil</div>
              <div style={s.resumenValor}>{fmt(obra.total_albanil)}</div>
            </div>
            <div style={s.resumenCard}>
              <div style={s.resumenLabel}>Pagado (albañil)</div>
              <div style={{ ...s.resumenValor, color: '#16a34a' }}>{fmt(obra.pagado_albanil)}</div>
            </div>
            <div style={s.resumenCard}>
              <div style={s.resumenLabel}>Saldo pendiente (albañil)</div>
              <div style={{ ...s.resumenValor, color: saldoPendienteAlbanil > 0 ? '#D4502A' : '#111' }}>{fmt(saldoPendienteAlbanil)}</div>
            </div>
          </div>

          <CronogramaPagos clienteId={clienteId} obraId={obraId} ipcEstimado={obra.ipc_estimado_mensual} onCambio={cargar} />
        </>
      )}

      <CertificadosAvance clienteId={clienteId} obraId={obraId} rol={rol} />

      <InformeMensual clienteId={clienteId} obraId={obraId} />

      {/* Modal: vincular presupuesto */}
      {modalPresu && (
        <div style={s.overlay} onClick={() => setModalPresu(false)}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitulo}>Vincular presupuesto confirmado</h3>
              <button onClick={() => setModalPresu(false)} style={s.btnCerrar}>✕</button>
            </div>
            <div style={s.modalBody}>
              {presupuestos.length === 0 ? (
                <div style={s.hint}>Este cliente no tiene presupuestos confirmados todavía.</div>
              ) : (
                <select style={s.input} value={presuElegido} onChange={e => setPresuElegido(e.target.value)}>
                  <option value="">— Seleccioná un presupuesto —</option>
                  {presupuestos.map(p => (
                    <option key={p.id} value={p.id}>{p.numero} — {fmt(p.honorario_total)}</option>
                  ))}
                </select>
              )}
              {errorModal && <div style={s.errorMsg}>{errorModal}</div>}
            </div>
            <div style={s.modalFooter}>
              <button onClick={() => setModalPresu(false)} style={s.btnSecundario}>Cancelar</button>
              <button onClick={confirmarVinculo} style={s.btnPrimario} disabled={guardando || presupuestos.length === 0}>
                {guardando ? 'Vinculando...' : 'Vincular'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  btnVolver:        { background: 'none', border: 'none', color: '#D4502A', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0, marginBottom: 16 },
  encabezado:       { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  titulo:           { fontSize: 20, fontWeight: 700, color: '#111', margin: 0 },
  subtitulo:        { fontSize: 13, color: '#888', marginTop: 4 },
  badge:            { fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, display: 'inline-block' },
  seccion:          { background: '#fff', borderRadius: 4, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: '16px 20px', marginBottom: 16 },
  seccionTitulo:    { fontSize: 13, fontWeight: 700, color: '#111', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 12 },
  datosGrid:        { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 },
  datoLabel:        { fontSize: 11, color: '#999', textTransform: 'uppercase', letterSpacing: '0.03em' },
  datoValor:        { fontSize: 14, color: '#111', marginTop: 3, fontWeight: 600 },
  notas:            { marginTop: 12, fontSize: 13, color: '#555', background: '#f9f9f9', padding: '8px 12px', borderRadius: 3, borderLeft: '3px solid #ddd' },
  linkBtn:          { display: 'block', background: 'none', border: 'none', color: '#D4502A', fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: '2px 0 0', textDecoration: 'underline' },
  avisoRestringido: { background: '#fff9e6', border: '1px solid #f5deb3', color: '#8a6d00', padding: '10px 14px', borderRadius: 3, fontSize: 13, marginBottom: 16 },
  resumenGrid:      { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 },
  resumenCard:      { background: '#fff', borderRadius: 4, padding: '12px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
  resumenLabel:     { fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 4 },
  resumenValor:     { fontSize: 17, fontWeight: 700, color: '#111' },
  btnPrimario:      { background: '#D4502A', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 3, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  empty:            { textAlign: 'center', color: '#aaa', padding: 30, background: '#fff', borderRadius: 4, border: '1px dashed #ddd', fontSize: 13 },
  overlay:          { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalCard:        { background: '#fff', borderRadius: 4, width: '100%', maxWidth: 560, boxShadow: '0 8px 40px rgba(0,0,0,0.2)', overflow: 'hidden', maxHeight: '90vh', overflowY: 'auto' },
  modalHeader:      { padding: '16px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 1 },
  modalTitulo:      { fontSize: 15, fontWeight: 700, margin: 0, color: '#111' },
  btnCerrar:        { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888' },
  modalBody:        { padding: '20px' },
  label:            { display: 'block', fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' },
  input:            { width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 3, fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  hint:             { fontSize: 11, color: '#999', marginTop: 10 },
  errorMsg:         { marginTop: 12, background: '#fff5f5', border: '1px solid #fca5a5', color: '#dc2626', padding: '8px 12px', borderRadius: 3, fontSize: 13, borderLeft: '3px solid #dc2626' },
  modalFooter:      { padding: '14px 20px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: 10, position: 'sticky', bottom: 0, background: '#fff' },
  btnSecundario:    { background: '#fff', color: '#333', border: '1px solid #ddd', padding: '8px 16px', borderRadius: 3, cursor: 'pointer', fontSize: 13 },
}
