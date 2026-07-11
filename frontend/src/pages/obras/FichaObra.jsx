import { useState, useEffect } from 'react'
import api from '../../utils/api'

const ESTADOS_OBRA = {
  en_curso:  { label: 'En curso',  color: '#D4502A', bg: '#fff4f1' },
  terminada: { label: 'Terminada', color: '#16a34a', bg: '#f0fdf4' },
  pausada:   { label: 'Pausada',   color: '#ca8a04', bg: '#fefce8' },
  cancelada: { label: 'Cancelada', color: '#6b7280', bg: '#f3f4f6' },
}

const EMPTY_CUOTA = { numero: '', descripcion: '', fecha_prevista: '', monto_cliente: '', monto_albanil: '', notas: '' }
const EMPTY_PAGO = { monto_pagado_cliente: '', monto_pagado_albanil: '', fecha_pago: '' }
const EMPTY_IPC = { ipc_pct: '', fuente: 'estimado' }

function fmt(n) {
  if (n === null || n === undefined) return '—'
  return '$ ' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2 })
}

function fmtFecha(iso) {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR')
}

export default function FichaObra({ clienteId, obraId, rol, onVolver }) {
  const [obra, setObra]             = useState(null)
  const [cronograma, setCronograma] = useState([])
  const [presupuestos, setPresupuestos] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')

  const [modalCuota, setModalCuota] = useState(null)   // 'crear' | cuota a editar | null
  const [formCuota, setFormCuota]   = useState(EMPTY_CUOTA)
  const [modalPago, setModalPago]   = useState(null)    // cuota a pagar
  const [formPago, setFormPago]     = useState(EMPTY_PAGO)
  const [modalIPC, setModalIPC]     = useState(null)    // cuota a ajustar
  const [formIPC, setFormIPC]       = useState(EMPTY_IPC)
  const [modalPresu, setModalPresu] = useState(false)
  const [presuElegido, setPresuElegido] = useState('')
  const [guardando, setGuardando]   = useState(false)
  const [errorModal, setErrorModal] = useState('')

  const esGaston = rol === 'gaston'

  const cargar = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/api/clientes/${clienteId}/obras/${obraId}`)
      setObra(res.data)
      if (esGaston) {
        const cr = await api.get(`/api/clientes/${clienteId}/obras/${obraId}/cronograma`)
        setCronograma(cr.data)
      }
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

  // ── Cuotas: crear / editar ──────────────────────────────────────────────
  const abrirCrearCuota = () => {
    const siguienteNumero = cronograma.length > 0 ? Math.max(...cronograma.map(c => c.numero)) + 1 : 1
    setFormCuota({ ...EMPTY_CUOTA, numero: siguienteNumero })
    setErrorModal(''); setModalCuota('crear')
  }
  const cerrarCuota = () => { setModalCuota(null); setErrorModal('') }

  const guardarCuota = async () => {
    if (!formCuota.numero) { setErrorModal('Ingresá el número de cuota'); return }
    setGuardando(true); setErrorModal('')
    try {
      const payload = {
        numero: Number(formCuota.numero),
        descripcion: formCuota.descripcion || null,
        fecha_prevista: formCuota.fecha_prevista || null,
        monto_cliente: formCuota.monto_cliente === '' ? 0 : Number(formCuota.monto_cliente),
        monto_albanil: formCuota.monto_albanil === '' ? 0 : Number(formCuota.monto_albanil),
        notas: formCuota.notas || null,
      }
      await api.post(`/api/clientes/${clienteId}/obras/${obraId}/cronograma`, payload)
      cerrarCuota(); cargar()
    } catch (e) {
      setErrorModal(e?.response?.data?.detail || 'Error al guardar')
    } finally { setGuardando(false) }
  }

  const eliminarCuota = async (id) => {
    if (!window.confirm('¿Eliminar esta cuota del cronograma?')) return
    try {
      await api.delete(`/api/clientes/${clienteId}/obras/${obraId}/cronograma/${id}`)
      cargar()
    } catch { alert('Error al eliminar') }
  }

  // ── Pagar cuota ──────────────────────────────────────────────────────────
  const abrirPago = (c) => {
    setFormPago({
      monto_pagado_cliente: c.saldo_cliente ?? '',
      monto_pagado_albanil: c.saldo_albanil ?? '',
      fecha_pago: new Date().toISOString().slice(0, 10),
    })
    setErrorModal(''); setModalPago(c)
  }
  const cerrarPago = () => { setModalPago(null); setErrorModal('') }

  const confirmarPago = async () => {
    setGuardando(true); setErrorModal('')
    try {
      const payload = {
        monto_pagado_cliente: formPago.monto_pagado_cliente === '' ? null : Number(formPago.monto_pagado_cliente),
        monto_pagado_albanil: formPago.monto_pagado_albanil === '' ? null : Number(formPago.monto_pagado_albanil),
        fecha_pago: formPago.fecha_pago || null,
      }
      await api.post(`/api/clientes/${clienteId}/obras/${obraId}/cronograma/${modalPago.id}/pagar`, payload)
      cerrarPago(); cargar()
    } catch (e) {
      setErrorModal(e?.response?.data?.detail || 'Error al registrar el pago')
    } finally { setGuardando(false) }
  }

  // ── Ajustar IPC ──────────────────────────────────────────────────────────
  const abrirIPC = (c) => {
    setFormIPC({ ipc_pct: obra?.ipc_estimado_mensual ?? '', fuente: 'estimado' })
    setErrorModal(''); setModalIPC(c)
  }
  const cerrarIPC = () => { setModalIPC(null); setErrorModal('') }

  const confirmarIPC = async () => {
    if (!formIPC.ipc_pct) { setErrorModal('Ingresá el porcentaje de IPC'); return }
    setGuardando(true); setErrorModal('')
    try {
      await api.post(`/api/clientes/${clienteId}/obras/${obraId}/cronograma/${modalIPC.id}/ajustar-ipc`, {
        ipc_pct: Number(formIPC.ipc_pct), fuente: formIPC.fuente,
      })
      cerrarIPC(); cargar()
    } catch (e) {
      setErrorModal(e?.response?.data?.detail || 'Error al aplicar el ajuste')
    } finally { setGuardando(false) }
  }

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
        </div>
        {obra.notas && <div style={s.notas}>{obra.notas}</div>}
      </div>

      {!esGaston && (
        <div style={s.avisoRestringido}>
          El cronograma de pagos y los montos son visibles solo para Gastón.
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

          {/* Cronograma */}
          <div style={s.seccion}>
            <div style={s.seccionHeader}>
              <div style={s.seccionTitulo}>Cronograma de pagos</div>
              <button onClick={abrirCrearCuota} style={s.btnPrimario}>+ Nueva cuota</button>
            </div>

            {cronograma.length === 0 ? (
              <div style={s.empty}>Todavía no hay cuotas cargadas.</div>
            ) : (
              <div style={s.cuotasLista}>
                {cronograma.map(c => (
                  <div key={c.id} style={{ ...s.cuotaCard, ...(c.estado === 'pagada' ? s.cuotaCardPagada : {}) }}>
                    <div style={s.cuotaHeader}>
                      <div>
                        <span style={s.cuotaNumero}>Cuota {c.numero}</span>
                        {c.descripcion && <span style={s.cuotaDesc}> · {c.descripcion}</span>}
                        <div style={s.cuotaFecha}>Prevista: {fmtFecha(c.fecha_prevista)}</div>
                      </div>
                      <span style={{ ...s.estadoBadge, ...(c.estado === 'pagada' ? s.estadoPagada : s.estadoPendiente) }}>
                        {c.estado === 'pagada' ? 'Pagada' : 'Pendiente'}
                      </span>
                    </div>

                    <div style={s.cuentasGrid}>
                      <div style={s.cuentaBox}>
                        <div style={s.cuentaTitulo}>Cuenta cliente</div>
                        <div style={s.cuentaFila}><span>Base</span><span>{fmt(c.monto_cliente)}</span></div>
                        {c.ajuste_ipc_cliente > 0 && (
                          <div style={{ ...s.cuentaFila, color: '#D4502A' }}><span>Ajuste IPC</span><span>+{fmt(c.ajuste_ipc_cliente)}</span></div>
                        )}
                        <div style={s.cuentaFilaSaldo}><span>Saldo</span><span>{fmt(c.saldo_cliente)}</span></div>
                        {c.estado === 'pagada' && (
                          <div style={{ ...s.cuentaFila, color: '#16a34a' }}><span>Pagado</span><span>{fmt(c.monto_pagado_cliente)}</span></div>
                        )}
                      </div>
                      <div style={s.cuentaBox}>
                        <div style={s.cuentaTitulo}>Cuenta albañil</div>
                        <div style={s.cuentaFila}><span>Base</span><span>{fmt(c.monto_albanil)}</span></div>
                        {c.ajuste_ipc_albanil > 0 && (
                          <div style={{ ...s.cuentaFila, color: '#D4502A' }}><span>Ajuste IPC</span><span>+{fmt(c.ajuste_ipc_albanil)}</span></div>
                        )}
                        <div style={s.cuentaFilaSaldo}><span>Saldo</span><span>{fmt(c.saldo_albanil)}</span></div>
                        {c.estado === 'pagada' && (
                          <div style={{ ...s.cuentaFila, color: '#16a34a' }}><span>Pagado</span><span>{fmt(c.monto_pagado_albanil)}</span></div>
                        )}
                      </div>
                    </div>

                    <div style={s.cuotaAcciones}>
                      {c.estado !== 'pagada' && (
                        <>
                          <button onClick={() => abrirIPC(c)} style={s.btnMini}>Ajustar IPC</button>
                          <button onClick={() => abrirPago(c)} style={{ ...s.btnMini, color: '#16a34a', borderColor: '#16a34a' }}>Pagar</button>
                        </>
                      )}
                      <button onClick={() => eliminarCuota(c.id)} style={{ ...s.btnMini, color: '#dc2626' }}>Eliminar</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={s.hintFormula}>
              Ajuste IPC compuesto: <code>saldo × (1 + ipc%) − saldo</code>, acumulado sobre ajustes previos. Nunca se suma de forma algebraica.
            </div>
          </div>
        </>
      )}

      {/* Modal: nueva cuota */}
      {modalCuota !== null && (
        <div style={s.overlay} onClick={cerrarCuota}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitulo}>Nueva cuota del cronograma</h3>
              <button onClick={cerrarCuota} style={s.btnCerrar}>✕</button>
            </div>
            <div style={s.modalBody}>
              <div style={s.grid}>
                <div>
                  <label style={s.label}>Número <span style={{ color: '#D4502A' }}>*</span></label>
                  <input type="number" style={s.input} value={formCuota.numero} autoFocus
                    onChange={e => setFormCuota({ ...formCuota, numero: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Fecha prevista</label>
                  <input type="date" style={s.input} value={formCuota.fecha_prevista}
                    onChange={e => setFormCuota({ ...formCuota, fecha_prevista: e.target.value })} />
                </div>
                <div style={s.fullWidth}>
                  <label style={s.label}>Descripción</label>
                  <input style={s.input} value={formCuota.descripcion} placeholder="Ej: Anticipo, Cuota 2..."
                    onChange={e => setFormCuota({ ...formCuota, descripcion: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Monto cuenta cliente ($)</label>
                  <input type="number" style={s.input} value={formCuota.monto_cliente}
                    onChange={e => setFormCuota({ ...formCuota, monto_cliente: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Monto cuenta albañil ($)</label>
                  <input type="number" style={s.input} value={formCuota.monto_albanil}
                    onChange={e => setFormCuota({ ...formCuota, monto_albanil: e.target.value })} />
                </div>
                <div style={s.fullWidth}>
                  <label style={s.label}>Notas</label>
                  <textarea style={{ ...s.input, height: 50, resize: 'vertical' }} value={formCuota.notas}
                    onChange={e => setFormCuota({ ...formCuota, notas: e.target.value })} />
                </div>
              </div>
              {errorModal && <div style={s.errorMsg}>{errorModal}</div>}
            </div>
            <div style={s.modalFooter}>
              <button onClick={cerrarCuota} style={s.btnSecundario}>Cancelar</button>
              <button onClick={guardarCuota} style={s.btnPrimario} disabled={guardando}>
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: pagar cuota */}
      {modalPago !== null && (
        <div style={s.overlay} onClick={cerrarPago}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitulo}>Registrar pago — Cuota {modalPago.numero}</h3>
              <button onClick={cerrarPago} style={s.btnCerrar}>✕</button>
            </div>
            <div style={s.modalBody}>
              <div style={s.grid}>
                <div>
                  <label style={s.label}>Monto pagado — cliente ($)</label>
                  <input type="number" style={s.input} value={formPago.monto_pagado_cliente} autoFocus
                    onChange={e => setFormPago({ ...formPago, monto_pagado_cliente: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Monto pagado — albañil ($)</label>
                  <input type="number" style={s.input} value={formPago.monto_pagado_albanil}
                    onChange={e => setFormPago({ ...formPago, monto_pagado_albanil: e.target.value })} />
                </div>
                <div style={s.fullWidth}>
                  <label style={s.label}>Fecha de pago</label>
                  <input type="date" style={s.input} value={formPago.fecha_pago}
                    onChange={e => setFormPago({ ...formPago, fecha_pago: e.target.value })} />
                </div>
              </div>
              <div style={s.hint}>Por defecto se toma el saldo actual (monto + ajustes IPC). Podés editarlo si el pago real fue distinto.</div>
              {errorModal && <div style={s.errorMsg}>{errorModal}</div>}
            </div>
            <div style={s.modalFooter}>
              <button onClick={cerrarPago} style={s.btnSecundario}>Cancelar</button>
              <button onClick={confirmarPago} style={{ ...s.btnPrimario, background: '#16a34a' }} disabled={guardando}>
                {guardando ? 'Guardando...' : 'Confirmar pago'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: ajustar IPC */}
      {modalIPC !== null && (
        <div style={s.overlay} onClick={cerrarIPC}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitulo}>Ajustar IPC — Cuota {modalIPC.numero}</h3>
              <button onClick={cerrarIPC} style={s.btnCerrar}>✕</button>
            </div>
            <div style={s.modalBody}>
              <div style={s.grid}>
                <div>
                  <label style={s.label}>IPC del mes (%) <span style={{ color: '#D4502A' }}>*</span></label>
                  <input type="number" step="0.1" style={s.input} value={formIPC.ipc_pct} autoFocus
                    onChange={e => setFormIPC({ ...formIPC, ipc_pct: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Fuente</label>
                  <select style={s.input} value={formIPC.fuente} onChange={e => setFormIPC({ ...formIPC, fuente: e.target.value })}>
                    <option value="estimado">Estimado</option>
                    <option value="indec">Real INDEC</option>
                  </select>
                </div>
              </div>
              <div style={s.hint}>
                Se aplica sobre el saldo actual de ambas cuentas (cliente y albañil), de forma compuesta y acumulativa. No se puede deshacer, pero queda en el historial de auditoría.
              </div>
              {errorModal && <div style={s.errorMsg}>{errorModal}</div>}
            </div>
            <div style={s.modalFooter}>
              <button onClick={cerrarIPC} style={s.btnSecundario}>Cancelar</button>
              <button onClick={confirmarIPC} style={s.btnPrimario} disabled={guardando}>
                {guardando ? 'Aplicando...' : 'Aplicar ajuste'}
              </button>
            </div>
          </div>
        </div>
      )}

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
  seccionHeader:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
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
  cuotasLista:      { display: 'flex', flexDirection: 'column', gap: 10 },
  cuotaCard:        { border: '1px solid #eee', borderRadius: 4, padding: '12px 14px' },
  cuotaCardPagada:  { opacity: 0.6, background: '#fafafa' },
  cuotaHeader:      { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  cuotaNumero:      { fontSize: 13, fontWeight: 700, color: '#111' },
  cuotaDesc:        { fontSize: 13, color: '#666' },
  cuotaFecha:       { fontSize: 11, color: '#999', marginTop: 2 },
  cuentasGrid:      { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 },
  cuentaBox:        { background: '#f9f9f9', borderRadius: 3, padding: '8px 10px' },
  cuentaTitulo:     { fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 4 },
  cuentaFila:       { display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#555', padding: '1px 0' },
  cuentaFilaSaldo:  { display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, color: '#111', padding: '3px 0 0', marginTop: 3, borderTop: '1px solid #e5e5e5' },
  cuotaAcciones:    { display: 'flex', gap: 6, flexWrap: 'wrap' },
  estadoBadge:      { fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 },
  estadoPendiente:  { color: '#ca8a04', background: '#fefce8' },
  estadoPagada:     { color: '#16a34a', background: '#f0fdf4' },
  btnMini:          { background: 'none', border: '1px solid #ddd', color: '#555', padding: '2px 8px', borderRadius: 3, cursor: 'pointer', fontSize: 11 },
  hintFormula:      { fontSize: 11, color: '#999', marginTop: 10 },
  empty:            { textAlign: 'center', color: '#aaa', padding: 30, background: '#fff', borderRadius: 4, border: '1px dashed #ddd', fontSize: 13 },
  overlay:          { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalCard:        { background: '#fff', borderRadius: 4, width: '100%', maxWidth: 560, boxShadow: '0 8px 40px rgba(0,0,0,0.2)', overflow: 'hidden', maxHeight: '90vh', overflowY: 'auto' },
  modalHeader:      { padding: '16px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 1 },
  modalTitulo:      { fontSize: 15, fontWeight: 700, margin: 0, color: '#111' },
  btnCerrar:        { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888' },
  modalBody:        { padding: '20px' },
  grid:             { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' },
  fullWidth:        { gridColumn: '1 / -1' },
  label:            { display: 'block', fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' },
  input:            { width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 3, fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  hint:             { fontSize: 11, color: '#999', marginTop: 10 },
  errorMsg:         { marginTop: 12, background: '#fff5f5', border: '1px solid #fca5a5', color: '#dc2626', padding: '8px 12px', borderRadius: 3, fontSize: 13, borderLeft: '3px solid #dc2626' },
  modalFooter:      { padding: '14px 20px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: 10, position: 'sticky', bottom: 0, background: '#fff' },
  btnSecundario:    { background: '#fff', color: '#333', border: '1px solid #ddd', padding: '8px 16px', borderRadius: 3, cursor: 'pointer', fontSize: 13 },
}
