import { useState, useEffect } from 'react'
import api from '../../utils/api'

const EMPTY_ITEM = { orden: '', designacion: '', unidad: '', cantidad: '', precio_unitario: '', precio_unitario_albanil: '' }

function fmt(n) {
  if (n === null || n === undefined) return '—'
  return '$ ' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtPct(n) {
  if (n === null || n === undefined) return '—'
  return Number(n).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'
}

function fmtCantidad(n) {
  if (n === null || n === undefined) return '—'
  return Number(n).toLocaleString('es-AR', { maximumFractionDigits: 3 })
}

function fmtFecha(iso) {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR')
}

export default function CertificadosAvance({ clienteId, obraId, rol }) {
  const [items, setItems]             = useState([])
  const [certificados, setCertificados] = useState([])
  const [resumen, setResumen]         = useState(null)
  const [curva, setCurva]             = useState(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')

  const [modalItem, setModalItem]     = useState(null)  // 'crear' | item a editar | null
  const [formItem, setFormItem]       = useState(EMPTY_ITEM)
  const [modalCert, setModalCert]     = useState(false)
  const [formCert, setFormCert]       = useState({ periodo: '', fecha_certificado: '' })
  const [pcts, setPcts]               = useState({})     // { item_id: pct_acum_nuevo }
  const [certAbierto, setCertAbierto] = useState(null)    // certificado expandido
  const [guardando, setGuardando]     = useState(false)
  const [errorModal, setErrorModal]   = useState('')

  const esGaston = rol === 'gaston'

  const cargar = async () => {
    setLoading(true)
    try {
      const [ri, rc, rr, rv] = await Promise.all([
        api.get(`/api/clientes/${clienteId}/obras/${obraId}/items`),
        api.get(`/api/clientes/${clienteId}/obras/${obraId}/certificados`),
        api.get(`/api/clientes/${clienteId}/obras/${obraId}/resumen-certificados`),
        api.get(`/api/clientes/${clienteId}/obras/${obraId}/curva`),
      ])
      setItems(ri.data); setCertificados(rc.data); setResumen(rr.data); setCurva(rv.data)
    } catch { setError('Error al cargar certificados de avance') }
    finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [obraId])

  // ── Ítems del cómputo ────────────────────────────────────────────────────
  const abrirCrearItem = () => {
    const siguiente = items.length > 0 ? String(items.length + 1) : '1'
    setFormItem({ ...EMPTY_ITEM, orden: siguiente })
    setErrorModal(''); setModalItem('crear')
  }
  const abrirEditarItem = (i) => {
    setFormItem({ orden: i.orden ?? '', designacion: i.designacion, unidad: i.unidad || '', cantidad: i.cantidad, precio_unitario: i.precio_unitario, precio_unitario_albanil: i.precio_unitario_albanil })
    setErrorModal(''); setModalItem(i)
  }
  const cerrarItem = () => { setModalItem(null); setErrorModal('') }

  const guardarItem = async () => {
    if (!formItem.designacion) { setErrorModal('Ingresá la designación del ítem'); return }
    setGuardando(true); setErrorModal('')
    try {
      const payload = {
        orden: formItem.orden === '' ? null : formItem.orden,
        designacion: formItem.designacion,
        unidad: formItem.unidad || null,
        cantidad: formItem.cantidad === '' ? 0 : Number(formItem.cantidad),
        precio_unitario: formItem.precio_unitario === '' ? 0 : Number(formItem.precio_unitario),
        precio_unitario_albanil: formItem.precio_unitario_albanil === '' ? 0 : Number(formItem.precio_unitario_albanil),
      }
      if (modalItem === 'crear') {
        await api.post(`/api/clientes/${clienteId}/obras/${obraId}/items`, payload)
      } else {
        await api.put(`/api/clientes/${clienteId}/obras/${obraId}/items/${modalItem.id}`, payload)
      }
      cerrarItem(); cargar()
    } catch (e) {
      setErrorModal(e?.response?.data?.detail || 'Error al guardar')
    } finally { setGuardando(false) }
  }

  const eliminarItem = async (id) => {
    if (!window.confirm('¿Eliminar este ítem del cómputo?')) return
    try {
      await api.delete(`/api/clientes/${clienteId}/obras/${obraId}/items/${id}`)
      cargar()
    } catch { alert('Error al eliminar') }
  }

  // ── Certificado nuevo ────────────────────────────────────────────────────
  const ultimoPctPorItem = () => {
    const mapa = {}
    // certificados ya vienen ordenados por número ascendente
    for (const cert of certificados) {
      for (const ci of cert.items) mapa[ci.item_id] = ci.pct_acum_nuevo
    }
    return mapa
  }

  const abrirCrearCert = () => {
    if (items.length === 0) { alert('Primero cargá al menos un ítem del cómputo.'); return }
    const previos = ultimoPctPorItem()
    const inicial = {}
    items.forEach(i => { inicial[i.id] = previos[i.id] ?? 0 })
    setPcts(inicial)
    setFormCert({ periodo: '', fecha_certificado: new Date().toISOString().slice(0, 10) })
    setErrorModal(''); setModalCert(true)
  }
  const cerrarCert = () => { setModalCert(false); setErrorModal('') }

  const guardarCert = async () => {
    if (!formCert.periodo) { setErrorModal('Ingresá el período (ej: Julio 2026)'); return }
    setGuardando(true); setErrorModal('')
    try {
      const payload = {
        periodo: formCert.periodo,
        fecha_certificado: formCert.fecha_certificado || null,
        items: items.map(i => ({ item_id: i.id, pct_acum_nuevo: Number(pcts[i.id] || 0) })),
      }
      await api.post(`/api/clientes/${clienteId}/obras/${obraId}/certificados`, payload)
      cerrarCert(); cargar()
    } catch (e) {
      setErrorModal(e?.response?.data?.detail || 'Error al guardar el certificado')
    } finally { setGuardando(false) }
  }

  const eliminarCert = async (id) => {
    if (!window.confirm('¿Eliminar este certificado? Esto puede afectar el % del mes de certificados posteriores para estos ítems.')) return
    try {
      await api.delete(`/api/clientes/${clienteId}/obras/${obraId}/certificados/${id}`)
      cargar()
    } catch { alert('Error al eliminar') }
  }

  const previos = ultimoPctPorItem()

  if (loading) return <div style={s.empty}>Cargando certificados de avance...</div>

  return (
    <div style={s.seccion}>
      <div style={s.seccionTitulo}>Certificado de avance</div>

      {/* Resumen */}
      {resumen && (
        <>
          <div style={s.cuentaLabel}>Cuenta cliente</div>
          <div style={s.resumenGrid}>
            <div style={s.resumenCard}>
              <div style={s.resumenLabel}>Presupuesto base</div>
              <div style={s.resumenValor}>{fmt(resumen.presupuesto_base)}</div>
            </div>
            <div style={s.resumenCard}>
              <div style={s.resumenLabel}>Ajuste IPC acumulado</div>
              <div style={s.resumenValor}>{esGaston ? fmt(resumen.ajuste_ipc_acumulado) : '—'}</div>
            </div>
            <div style={s.resumenCard}>
              <div style={s.resumenLabel}>Total actualizado</div>
              <div style={s.resumenValor}>{esGaston ? fmt(resumen.total_actualizado) : fmt(resumen.presupuesto_base)}</div>
            </div>
            <div style={s.resumenCard}>
              <div style={s.resumenLabel}>Ejecución acumulada</div>
              <div style={{ ...s.resumenValor, color: '#D4502A' }}>{fmt(resumen.ejecucion_acumulada)}</div>
            </div>
            <div style={s.resumenCard}>
              <div style={s.resumenLabel}>Saldo pendiente</div>
              <div style={s.resumenValor}>{esGaston ? fmt(resumen.saldo_pendiente) : '—'}</div>
            </div>
          </div>

          {esGaston && (
            <>
              <div style={s.cuentaLabel}>Cuenta albañil</div>
              <div style={s.resumenGrid}>
                <div style={s.resumenCard}>
                  <div style={s.resumenLabel}>Presupuesto base</div>
                  <div style={s.resumenValor}>{fmt(resumen.presupuesto_base_albanil)}</div>
                </div>
                <div style={s.resumenCard}>
                  <div style={s.resumenLabel}>Ajuste IPC acumulado</div>
                  <div style={s.resumenValor}>{fmt(resumen.ajuste_ipc_acumulado_albanil)}</div>
                </div>
                <div style={s.resumenCard}>
                  <div style={s.resumenLabel}>Total actualizado</div>
                  <div style={s.resumenValor}>{fmt(resumen.total_actualizado_albanil)}</div>
                </div>
                <div style={s.resumenCard}>
                  <div style={s.resumenLabel}>Ejecución acumulada</div>
                  <div style={{ ...s.resumenValor, color: '#D4502A' }}>{fmt(resumen.ejecucion_acumulada_albanil)}</div>
                </div>
                <div style={s.resumenCard}>
                  <div style={s.resumenLabel}>Saldo pendiente</div>
                  <div style={s.resumenValor}>{fmt(resumen.saldo_pendiente_albanil)}</div>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Curva ejecutado vs pagos */}
      {curva && curva.puntos.length > 0 && (
        <div style={s.curvaBox}>
          <div style={s.cuentaLabel}>Curva — cuenta cliente</div>
          {curva.alerta && (
            <div style={s.alertaCurva}>⚠️ En algún mes el cliente pagó más de lo ejecutado.</div>
          )}
          <CurvaSVG puntos={curva.puntos} campoEjecutado="ejecutado_acum" campoPagos="pagos_acum" mostrarPagos={esGaston} />
          <div style={s.curvaLeyenda}>
            <span><span style={{ ...s.leyendaLinea, background: '#D4502A' }} /> Ejecutado</span>
            {esGaston && <span><span style={{ ...s.leyendaLinea, background: '#999', borderStyle: 'dashed' }} /> Pagos</span>}
          </div>

          {esGaston && (
            <>
              <div style={{ ...s.cuentaLabel, marginTop: 20 }}>Curva — cuenta albañil</div>
              {curva.alerta_albanil && (
                <div style={s.alertaCurva}>⚠️ En algún mes se le pagó al albañil más de lo ejecutado.</div>
              )}
              <CurvaSVG puntos={curva.puntos} campoEjecutado="ejecutado_acum_albanil" campoPagos="pagos_acum_albanil" mostrarPagos={true} />
              <div style={s.curvaLeyenda}>
                <span><span style={{ ...s.leyendaLinea, background: '#D4502A' }} /> Ejecutado</span>
                <span><span style={{ ...s.leyendaLinea, background: '#999', borderStyle: 'dashed' }} /> Pagos</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Ítems del cómputo */}
      <div style={s.subseccion}>
        <div style={s.seccionHeader}>
          <div style={s.subTitulo}>Ítems del cómputo</div>
          {esGaston && <button onClick={abrirCrearItem} style={s.btnSecPrimario}>+ Nuevo ítem</button>}
        </div>
        {items.length === 0 ? (
          <div style={s.empty}>Todavía no hay ítems cargados en el cómputo.</div>
        ) : (
          <div style={s.itemsLista}>
            {items.map(i => (
              <div key={i.id} style={s.itemCard}>
                <div style={s.itemInfo}>
                  <span style={s.itemDesignacion}>{i.designacion}</span>
                  <span style={s.itemDetalle}>{fmtCantidad(i.cantidad)} {i.unidad || ''} × {fmt(i.precio_unitario)} (cliente)</span>
                  {esGaston && (
                    <span style={s.itemDetalle}>{fmtCantidad(i.cantidad)} {i.unidad || ''} × {fmt(i.precio_unitario_albanil)} (albañil)</span>
                  )}
                </div>
                <div style={s.itemDerecha}>
                  <span style={s.itemTotal}>{fmt(i.total)}</span>
                  {esGaston && <span style={s.itemTotalAlbanil}>{fmt(i.total_albanil)} albañil</span>}
                  {esGaston && (
                    <div style={s.itemAcciones}>
                      <button onClick={() => abrirEditarItem(i)} style={s.btnMini}>Editar</button>
                      <button onClick={() => eliminarItem(i.id)} style={{ ...s.btnMini, color: '#dc2626' }}>Eliminar</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Certificados cargados */}
      <div style={s.subseccion}>
        <div style={s.seccionHeader}>
          <div style={s.subTitulo}>Certificados cargados</div>
          <button onClick={abrirCrearCert} style={s.btnSecPrimario}>+ Nuevo certificado</button>
        </div>
        {certificados.length === 0 ? (
          <div style={s.empty}>Todavía no hay certificados cargados.</div>
        ) : (
          <div style={s.certLista}>
            {certificados.map(c => (
              <div key={c.id} style={s.certCard}>
                <div style={s.certHeader} onClick={() => setCertAbierto(certAbierto === c.id ? null : c.id)}>
                  <div>
                    <span style={s.certNumero}>#{c.numero} — {c.periodo}</span>
                    <div style={s.certFecha}>{fmtFecha(c.fecha_certificado)}</div>
                  </div>
                  <div style={s.certDerecha}>
                    <div style={s.certMonto}>{fmt(c.ejecucion_acum)}</div>
                    <div style={s.certMontoLabel}>ejecución acumulada{esGaston ? ' (cliente)' : ''}</div>
                    {esGaston && <div style={s.certMontoAlbanil}>{fmt(c.ejecucion_acum_albanil)} (albañil)</div>}
                  </div>
                </div>
                {certAbierto === c.id && (
                  <div style={s.certDetalle}>
                    {c.items.map(ci => (
                      <div key={ci.id} style={s.certItemFila}>
                        <span style={s.certItemNombre}>{ci.designacion}</span>
                        <span style={s.certItemPct}>{fmtPct(ci.pct_acum_anterior)} → {fmtPct(ci.pct_acum_nuevo)} ({ci.pct_mes >= 0 ? '+' : ''}{fmtPct(ci.pct_mes)})</span>
                        <span style={s.certItemMonto}>{fmt(ci.monto_mes)} este mes (cliente){esGaston ? ` · ${fmt(ci.monto_mes_albanil)} (albañil)` : ''}</span>
                      </div>
                    ))}
                    {esGaston && (
                      <button onClick={() => eliminarCert(c.id)} style={{ ...s.btnMini, color: '#dc2626', marginTop: 8 }}>Eliminar certificado</button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <div style={s.hintFormula}>
          % del mes = % acumulado nuevo − % acumulado anterior. El sistema calcula $ del mes, $ acumulado y saldo automáticamente.
        </div>
      </div>

      {/* Modal: nuevo/editar ítem */}
      {modalItem !== null && (
        <div style={s.overlay} onClick={cerrarItem}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitulo}>{modalItem === 'crear' ? 'Nuevo ítem' : 'Editar ítem'}</h3>
              <button onClick={cerrarItem} style={s.btnCerrar}>✕</button>
            </div>
            <div style={s.modalBody}>
              <div style={s.grid}>
                <div style={s.fullWidth}>
                  <label style={s.label}>Designación <span style={{ color: '#D4502A' }}>*</span></label>
                  <input style={s.input} value={formItem.designacion} autoFocus
                    placeholder="Ej: Mampostería, Techo, Contrapisos..."
                    onChange={e => setFormItem({ ...formItem, designacion: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Unidad</label>
                  <input style={s.input} value={formItem.unidad} placeholder="m2, m3, gl, ml..."
                    onChange={e => setFormItem({ ...formItem, unidad: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Orden</label>
                  <input type="text" style={s.input} value={formItem.orden} placeholder="1, 1.1, 1.1.2..."
                    onChange={e => setFormItem({ ...formItem, orden: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Cantidad</label>
                  <input type="number" style={s.input} value={formItem.cantidad}
                    onChange={e => setFormItem({ ...formItem, cantidad: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Precio unitario — cliente ($)</label>
                  <input type="number" style={s.input} value={formItem.precio_unitario}
                    onChange={e => setFormItem({ ...formItem, precio_unitario: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Precio unitario — albañil ($)</label>
                  <input type="number" style={s.input} value={formItem.precio_unitario_albanil}
                    onChange={e => setFormItem({ ...formItem, precio_unitario_albanil: e.target.value })} />
                </div>
              </div>
              {errorModal && <div style={s.errorMsg}>{errorModal}</div>}
            </div>
            <div style={s.modalFooter}>
              <button onClick={cerrarItem} style={s.btnSecundario}>Cancelar</button>
              <button onClick={guardarItem} style={s.btnPrimario} disabled={guardando}>
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: nuevo certificado */}
      {modalCert && (
        <div style={s.overlay} onClick={cerrarCert}>
          <div style={s.modalCard} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitulo}>Nuevo certificado de avance</h3>
              <button onClick={cerrarCert} style={s.btnCerrar}>✕</button>
            </div>
            <div style={s.modalBody}>
              <div style={s.grid}>
                <div>
                  <label style={s.label}>Período <span style={{ color: '#D4502A' }}>*</span></label>
                  <input style={s.input} value={formCert.periodo} autoFocus placeholder="Ej: Julio 2026"
                    onChange={e => setFormCert({ ...formCert, periodo: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Fecha del certificado</label>
                  <input type="date" style={s.input} value={formCert.fecha_certificado}
                    onChange={e => setFormCert({ ...formCert, fecha_certificado: e.target.value })} />
                </div>
              </div>

              <div style={s.pctLista}>
                {items.map(i => (
                  <div key={i.id} style={s.pctFila}>
                    <div style={s.pctNombre}>
                      {i.designacion}
                      <div style={s.pctAnterior}>Anterior: {fmtPct(previos[i.id] ?? 0)}</div>
                    </div>
                    <input type="number" step="0.1" min="0" max="100" style={s.pctInput}
                      value={pcts[i.id] ?? ''}
                      onChange={e => setPcts({ ...pcts, [i.id]: e.target.value })} />
                    <span style={s.pctSimbolo}>%</span>
                  </div>
                ))}
              </div>
              {errorModal && <div style={s.errorMsg}>{errorModal}</div>}
            </div>
            <div style={s.modalFooter}>
              <button onClick={cerrarCert} style={s.btnSecundario}>Cancelar</button>
              <button onClick={guardarCert} style={s.btnPrimario} disabled={guardando}>
                {guardando ? 'Guardando...' : 'Guardar certificado'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Curva SVG (ejecutado sólido naranja / pagos punteado gris) ───────────────
function CurvaSVG({ puntos, campoEjecutado, campoPagos, mostrarPagos }) {
  const W = 600, H = 220, PAD = 36
  const maxVal = Math.max(
    1,
    ...puntos.map(p => Number(p[campoEjecutado])),
    ...(mostrarPagos ? puntos.map(p => Number(p[campoPagos])) : [0])
  )
  const stepX = puntos.length > 1 ? (W - PAD * 2) / (puntos.length - 1) : 0
  const x = idx => PAD + idx * stepX
  const y = val => H - PAD - (val / maxVal) * (H - PAD * 2)

  const lineaEjecutado = puntos.map((p, i) => `${x(i)},${y(Number(p[campoEjecutado]))}`).join(' ')
  const lineaPagos = puntos.map((p, i) => `${x(i)},${y(Number(p[campoPagos]))}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', maxWidth: 600 }}>
      {/* eje base */}
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="#e5e5e5" strokeWidth="1" />
      <line x1={PAD} y1={PAD / 2} x2={PAD} y2={H - PAD} stroke="#e5e5e5" strokeWidth="1" />

      <polyline points={lineaEjecutado} fill="none" stroke="#D4502A" strokeWidth="2.5" />
      {mostrarPagos && (
        <polyline points={lineaPagos} fill="none" stroke="#999" strokeWidth="2" strokeDasharray="5,4" />
      )}

      {puntos.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(Number(p[campoEjecutado]))} r="3.5" fill="#D4502A" />
          {mostrarPagos && <circle cx={x(i)} cy={y(Number(p[campoPagos]))} r="3" fill="#999" />}
          <text x={x(i)} y={H - PAD + 16} fontSize="9" fill="#999" textAnchor="middle">
            {p.periodo.length > 8 ? p.periodo.slice(0, 3) : p.periodo}
          </text>
        </g>
      ))}
    </svg>
  )
}

const s = {
  seccion:          { background: '#fff', borderRadius: 4, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', padding: '16px 20px', marginBottom: 16 },
  seccionTitulo:    { fontSize: 13, fontWeight: 700, color: '#111', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 14 },
  seccionHeader:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  subseccion:       { marginTop: 20 },
  subTitulo:        { fontSize: 12, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.03em' },
  resumenGrid:      { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 },
  cuentaLabel:      { fontSize: 11, fontWeight: 700, color: '#D4502A', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 8 },
  resumenCard:      { background: '#f9f9f9', borderRadius: 4, padding: '10px 14px' },
  resumenLabel:     { fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 4 },
  resumenValor:     { fontSize: 15, fontWeight: 700, color: '#111' },
  curvaBox:         { marginBottom: 16, padding: '12px 0', borderTop: '1px solid #f2f2f2', borderBottom: '1px solid #f2f2f2' },
  alertaCurva:      { background: '#fff5f5', border: '1px solid #fca5a5', color: '#dc2626', padding: '8px 12px', borderRadius: 3, fontSize: 12, marginBottom: 10 },
  curvaLeyenda:     { display: 'flex', gap: 16, justifyContent: 'center', marginTop: 6, fontSize: 11, color: '#666' },
  leyendaLinea:     { display: 'inline-block', width: 16, height: 2, marginRight: 4, verticalAlign: 'middle' },
  itemsLista:       { display: 'flex', flexDirection: 'column', gap: 6 },
  itemCard:         { display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #eee', borderRadius: 3, padding: '8px 12px', gap: 12 },
  itemInfo:         { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 },
  itemDerecha:      { display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, whiteSpace: 'nowrap' },
  itemTotal:        { fontSize: 13, fontWeight: 700, color: '#111', whiteSpace: 'nowrap' },
  itemTotalAlbanil: { fontSize: 11, color: '#999', whiteSpace: 'nowrap' },
  itemDesignacion:  { fontSize: 13, fontWeight: 600, color: '#111' },
  itemDetalle:      { fontSize: 11, color: '#999', marginTop: 2 },
  itemAcciones:     { display: 'flex', gap: 4 },
  certLista:        { display: 'flex', flexDirection: 'column', gap: 8 },
  certCard:         { border: '1px solid #eee', borderRadius: 4, overflow: 'hidden' },
  certHeader:       { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', cursor: 'pointer', background: '#fafafa' },
  certNumero:       { fontSize: 13, fontWeight: 700, color: '#111' },
  certFecha:        { fontSize: 11, color: '#999', marginTop: 2 },
  certDerecha:      { textAlign: 'right' },
  certMonto:        { fontSize: 14, fontWeight: 700, color: '#D4502A' },
  certMontoLabel:   { fontSize: 10, color: '#999' },
  certMontoAlbanil: { fontSize: 11, color: '#999', marginTop: 2 },
  certDetalle:      { padding: '10px 14px', borderTop: '1px solid #f2f2f2' },
  certItemFila:     { display: 'flex', flexDirection: 'column', padding: '5px 0', borderBottom: '1px solid #f7f7f7', fontSize: 12 },
  certItemNombre:   { fontWeight: 600, color: '#111' },
  certItemPct:      { color: '#666', fontSize: 11, marginTop: 1 },
  certItemMonto:    { color: '#999', fontSize: 11 },
  btnSecPrimario:   { background: '#D4502A', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 3, cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  btnMini:          { background: 'none', border: '1px solid #ddd', color: '#555', padding: '2px 8px', borderRadius: 3, cursor: 'pointer', fontSize: 11 },
  hintFormula:      { fontSize: 11, color: '#999', marginTop: 10 },
  empty:            { textAlign: 'center', color: '#aaa', padding: 20, background: '#fafafa', borderRadius: 4, border: '1px dashed #ddd', fontSize: 13 },
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
  errorMsg:         { marginTop: 12, background: '#fff5f5', border: '1px solid #fca5a5', color: '#dc2626', padding: '8px 12px', borderRadius: 3, fontSize: 13, borderLeft: '3px solid #dc2626' },
  modalFooter:      { padding: '14px 20px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: 10, position: 'sticky', bottom: 0, background: '#fff' },
  btnPrimario:      { background: '#D4502A', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 3, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  btnSecundario:    { background: '#fff', color: '#333', border: '1px solid #ddd', padding: '8px 16px', borderRadius: 3, cursor: 'pointer', fontSize: 13 },
  pctLista:         { marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto' },
  pctFila:          { display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #f2f2f2', paddingBottom: 8 },
  pctNombre:        { flex: 1, fontSize: 13, color: '#111' },
  pctAnterior:      { fontSize: 11, color: '#999' },
  pctInput:         { width: 70, padding: '6px 8px', border: '1px solid #ddd', borderRadius: 3, fontSize: 13, textAlign: 'right' },
  pctSimbolo:       { fontSize: 12, color: '#999' },
}
