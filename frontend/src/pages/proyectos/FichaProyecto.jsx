import { useState, useEffect } from 'react'
import api from '../../utils/api'

const ESTADOS = {
  en_curso:  { label: 'En curso',  color: '#D4502A', bg: '#fff4f1' },
  terminado: { label: 'Terminado', color: '#16a34a', bg: '#f0fdf4' },
  pausado:   { label: 'Pausado',   color: '#ca8a04', bg: '#fefce8' },
  cancelado: { label: 'Cancelado', color: '#6b7280', bg: '#f3f4f6' },
}

const PLANTILLAS = [
  { value: 'solo_gaston',       label: 'Solo Gastón',              pct: [100, 0, 0] },
  { value: 'gaston_valentina',  label: 'Gastón + Valentina 50/50', pct: [50, 50, 0] },
  { value: 'gaston_valentin',   label: 'Gastón + Valentín 50/50',  pct: [50, 0, 50] },
  { value: 'los_tres',          label: 'Los tres',                 pct: [33.33, 33.33, 33.34] },
  { value: 'custom',            label: 'Personalizado',            pct: null },
]

const EMPTY_HON = {
  honorario_cobrado: '', gastos: '', plantilla: 'solo_gaston',
  pct_gaston: 100, pct_valentina: 0, pct_valentin: 0,
  liquidado: false, notas_liquidacion: '',
}

function fmt(n) {
  if (n === null || n === undefined || n === '') return '—'
  return '$ ' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-AR')
}

export default function FichaProyecto({ clienteId, proyectoId, rol, onVolver }) {
  const [proyecto, setProyecto]         = useState(null)
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState('')
  const [hon, setHon]                   = useState(null)
  const [editHon, setEditHon]           = useState(false)
  const [formHon, setFormHon]           = useState(EMPTY_HON)
  const [guardandoHon, setGuardandoHon] = useState(false)
  const [errorHon, setErrorHon]         = useState('')

  const esGaston = rol === 'gaston'

  const cargar = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/api/clientes/${clienteId}/proyectos/${proyectoId}`)
      setProyecto(res.data)
      if (esGaston && res.data.honorarios && res.data.honorarios.length > 0) {
        setHon(res.data.honorarios[0])
      }
    } catch { setError('Error al cargar el proyecto') }
    finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [proyectoId])

  const abrirEditorHon = () => {
    if (hon) {
      setFormHon({
        honorario_cobrado: hon.honorario_cobrado ?? '',
        gastos:            hon.gastos ?? '',
        plantilla:         hon.plantilla || 'solo_gaston',
        pct_gaston:        Number(hon.pct_gaston),
        pct_valentina:     Number(hon.pct_valentina),
        pct_valentin:      Number(hon.pct_valentin),
        liquidado:         hon.liquidado || false,
        notas_liquidacion: hon.notas_liquidacion || '',
      })
    } else {
      setFormHon(EMPTY_HON)
    }
    setErrorHon(''); setEditHon(true)
  }

  const cambiarPlantilla = (val) => {
    const p = PLANTILLAS.find(x => x.value === val)
    if (p && p.pct) {
      setFormHon(f => ({ ...f, plantilla: val, pct_gaston: p.pct[0], pct_valentina: p.pct[1], pct_valentin: p.pct[2] }))
    } else {
      setFormHon(f => ({ ...f, plantilla: val }))
    }
  }

  const cobrado  = Number(formHon.honorario_cobrado) || 0
  const gastos   = Number(formHon.gastos) || 0
  const neto     = cobrado - gastos
  const mGaston    = neto * formHon.pct_gaston    / 100
  const mValentina = neto * formHon.pct_valentina / 100
  const mValentin  = neto * formHon.pct_valentin  / 100

  const guardarHon = async () => {
    setGuardandoHon(true); setErrorHon('')
    try {
      const payload = {
        ...formHon,
        honorario_cobrado: formHon.honorario_cobrado === '' ? null : Number(formHon.honorario_cobrado),
        gastos:            formHon.gastos === '' ? 0 : Number(formHon.gastos),
        pct_gaston:        Number(formHon.pct_gaston),
        pct_valentina:     Number(formHon.pct_valentina),
        pct_valentin:      Number(formHon.pct_valentin),
      }
      if (hon) {
        await api.put(`/api/clientes/${clienteId}/proyectos/${proyectoId}/honorarios/${hon.id}`, payload)
      } else {
        await api.post(`/api/clientes/${clienteId}/proyectos/${proyectoId}/honorarios`, payload)
      }
      setEditHon(false); cargar()
    } catch { setErrorHon('Error al guardar') }
    finally { setGuardandoHon(false) }
  }

  if (loading) return <div style={s.empty}>Cargando...</div>
  if (error)   return <div style={s.empty}>{error}</div>
  if (!proyecto) return null

  const est = ESTADOS[proyecto.estado] || ESTADOS.en_curso

  return (
    <div>
      <div style={s.breadcrumb}>
        <button onClick={onVolver} style={s.btnVolver}>← Proyectos</button>
      </div>

      <div style={s.proyectoHeader}>
        <div>
          <h2 style={s.proyectoNombre}>{proyecto.nombre}</h2>
          {proyecto.tipo && <div style={s.proyectoTipo}>{proyecto.tipo}</div>}
        </div>
        <span style={{ ...s.badge, color: est.color, background: est.bg }}>{est.label}</span>
      </div>

      <div style={s.seccion}>
        <div style={s.seccionTitulo}>Datos generales</div>
        <div style={s.datosGrid}>
          <Dato label="Inicio"  valor={fmtFecha(proyecto.fecha_inicio)} />
          <Dato label="Entrega" valor={fmtFecha(proyecto.fecha_fin)} />
          {esGaston && <Dato label="Honorario acordado" valor={fmt(proyecto.honorario_total)} />}
          {proyecto.descripcion && <div style={{ gridColumn: '1 / -1' }}><Dato label="Descripción" valor={proyecto.descripcion} /></div>}
          {proyecto.notas && <div style={{ gridColumn: '1 / -1' }}><Dato label="Notas internas" valor={proyecto.notas} /></div>}
        </div>
      </div>

      {esGaston && (
        <div style={s.seccion}>
          <div style={{ ...s.seccionTitulo, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Distribución de honorarios</span>
            <button onClick={abrirEditorHon} style={s.btnSecundario}>{hon ? 'Editar' : 'Configurar'}</button>
          </div>

          {!hon ? (
            <div style={s.honVacio}>
              No hay distribución configurada.
              <button onClick={abrirEditorHon} style={{ ...s.btnPrimario, marginLeft: 12 }}>Configurar ahora</button>
            </div>
          ) : (
            <div>
              <div style={s.honResumen}>
                <HonCard label="Cobrado"           valor={fmt(hon.honorario_cobrado)} />
                <HonCard label="Gastos"            valor={fmt(hon.gastos)} muted />
                <HonCard label="Neto a distribuir" valor={fmt(hon.neto)} destacado />
              </div>
              <div style={s.honDistGrid}>
                <DistFila nombre="Gastón"    pct={hon.pct_gaston}    monto={hon.monto_gaston} />
                {Number(hon.pct_valentina) > 0 && <DistFila nombre="Valentina" pct={hon.pct_valentina} monto={hon.monto_valentina} />}
                {Number(hon.pct_valentin)  > 0 && <DistFila nombre="Valentín"  pct={hon.pct_valentin}  monto={hon.monto_valentin} />}
              </div>
              <div style={s.honLiq}>
                <span style={{ ...s.badge, color: hon.liquidado ? '#16a34a' : '#ca8a04', background: hon.liquidado ? '#f0fdf4' : '#fefce8' }}>
                  {hon.liquidado ? 'Liquidado' : 'Pendiente de liquidar'}
                </span>
                {hon.notas_liquidacion && <span style={s.honNotasLiq}>{hon.notas_liquidacion}</span>}
              </div>
            </div>
          )}

          {editHon && (
            <div style={s.overlay} onClick={() => setEditHon(false)}>
              <div style={s.modalCard} onClick={e => e.stopPropagation()}>
                <div style={s.modalHeader}>
                  <h3 style={s.modalTitulo}>Distribución de honorarios</h3>
                  <button onClick={() => setEditHon(false)} style={s.btnCerrar}>✕</button>
                </div>
                <div style={s.modalBody}>
                  <div style={s.grid}>
                    <div>
                      <label style={s.label}>Honorario cobrado ($)</label>
                      <input type="number" style={s.input} value={formHon.honorario_cobrado} onChange={e => setFormHon(f => ({ ...f, honorario_cobrado: e.target.value }))} />
                    </div>
                    <div>
                      <label style={s.label}>Gastos / subcontrataciones ($)</label>
                      <input type="number" style={s.input} value={formHon.gastos} onChange={e => setFormHon(f => ({ ...f, gastos: e.target.value }))} />
                    </div>
                    <div style={s.fullWidth}>
                      <div style={s.netoPreview}>
                        <span style={s.netoLabel}>Neto a distribuir:</span>
                        <span style={s.netoValor}>$ {neto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                    <div style={s.fullWidth}>
                      <label style={s.label}>Plantilla</label>
                      <div style={s.plantillasGrid}>
                        {PLANTILLAS.map(p => (
                          <button key={p.value} onClick={() => cambiarPlantilla(p.value)}
                            style={{ ...s.btnPlantilla, ...(formHon.plantilla === p.value ? s.btnPlantillaActiva : {}) }}>
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label style={s.label}>% Gastón</label>
                      <input type="number" style={s.input} value={formHon.pct_gaston} min="0" max="100"
                        onChange={e => setFormHon(f => ({ ...f, pct_gaston: Number(e.target.value), plantilla: 'custom' }))} />
                    </div>
                    <div>
                      <label style={s.label}>% Valentina</label>
                      <input type="number" style={s.input} value={formHon.pct_valentina} min="0" max="100"
                        onChange={e => setFormHon(f => ({ ...f, pct_valentina: Number(e.target.value), plantilla: 'custom' }))} />
                    </div>
                    <div>
                      <label style={s.label}>% Valentín</label>
                      <input type="number" style={s.input} value={formHon.pct_valentin} min="0" max="100"
                        onChange={e => setFormHon(f => ({ ...f, pct_valentin: Number(e.target.value), plantilla: 'custom' }))} />
                    </div>
                    <div style={s.fullWidth}>
                      <div style={s.distPreview}>
                        {formHon.pct_gaston    > 0 && <DistPreviewFila nombre="Gastón"    pct={formHon.pct_gaston}    monto={mGaston} />}
                        {formHon.pct_valentina > 0 && <DistPreviewFila nombre="Valentina" pct={formHon.pct_valentina} monto={mValentina} />}
                        {formHon.pct_valentin  > 0 && <DistPreviewFila nombre="Valentín"  pct={formHon.pct_valentin}  monto={mValentin} />}
                      </div>
                    </div>
                    <div style={s.fullWidth}>
                      <label style={{ ...s.label, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                        <input type="checkbox" checked={formHon.liquidado} onChange={e => setFormHon(f => ({ ...f, liquidado: e.target.checked }))} />
                        Marcar como liquidado
                      </label>
                    </div>
                    <div style={s.fullWidth}>
                      <label style={s.label}>Notas de liquidación</label>
                      <textarea style={{ ...s.input, height: 56, resize: 'vertical' }} value={formHon.notas_liquidacion}
                        onChange={e => setFormHon(f => ({ ...f, notas_liquidacion: e.target.value }))} />
                    </div>
                  </div>
                  {errorHon && <div style={s.errorMsg}>{errorHon}</div>}
                </div>
                <div style={s.modalFooter}>
                  <button onClick={() => setEditHon(false)} style={s.btnSecundario}>Cancelar</button>
                  <button onClick={guardarHon} style={s.btnPrimario} disabled={guardandoHon}>
                    {guardandoHon ? 'Guardando...' : 'Guardar distribución'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Dato({ label, valor }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#222' }}>{valor}</div>
    </div>
  )
}

function HonCard({ label, valor, muted, destacado }) {
  return (
    <div style={{ background: destacado ? '#fff4f1' : '#fafafa', border: `1px solid ${destacado ? '#fca5a5' : '#eee'}`, borderRadius: 4, padding: '10px 14px' }}>
      <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: muted ? '#888' : destacado ? '#D4502A' : '#111' }}>{valor}</div>
    </div>
  )
}

function DistFila({ nombre, pct, monto }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
      <span style={{ fontSize: 13, color: '#333' }}>{nombre}</span>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#888' }}>{Number(pct).toFixed(1)}%</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#111', minWidth: 120, textAlign: 'right' }}>
          {monto !== null && monto !== undefined ? '$ ' + Number(monto).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
        </span>
      </div>
    </div>
  )
}

function DistPreviewFila({ nombre, pct, monto }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
      <span style={{ fontSize: 13, color: '#444' }}>{nombre} ({Number(pct).toFixed(1)}%)</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#D4502A' }}>$ {monto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
    </div>
  )
}

const s = {
  breadcrumb:       { marginBottom: 16 },
  btnVolver:        { background: 'none', border: 'none', color: '#D4502A', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0 },
  proyectoHeader:   { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  proyectoNombre:   { fontSize: 20, fontWeight: 700, color: '#111', margin: 0 },
  proyectoTipo:     { fontSize: 13, color: '#888', marginTop: 4 },
  badge:            { fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, display: 'inline-block' },
  seccion:          { background: '#fff', border: '1px solid #eee', borderRadius: 4, padding: '16px 18px', marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
  seccionTitulo:    { fontSize: 13, fontWeight: 700, color: '#3D4D52', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14, paddingBottom: 8, borderBottom: '2px solid #D4502A', display: 'block' },
  datosGrid:        { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px 20px' },
  honVacio:         { fontSize: 13, color: '#888', display: 'flex', alignItems: 'center' },
  honResumen:       { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 },
  honDistGrid:      { marginBottom: 12 },
  honLiq:           { display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 },
  honNotasLiq:      { fontSize: 12, color: '#888' },
  empty:            { textAlign: 'center', color: '#aaa', padding: 40 },
  overlay:          { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modalCard:        { background: '#fff', borderRadius: 4, width: '100%', maxWidth: 580, boxShadow: '0 8px 40px rgba(0,0,0,0.2)', overflow: 'hidden', maxHeight: '90vh', overflowY: 'auto' },
  modalHeader:      { padding: '16px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 1 },
  modalTitulo:      { fontSize: 16, fontWeight: 700, margin: 0, color: '#111' },
  btnCerrar:        { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888' },
  modalBody:        { padding: '20px' },
  modalFooter:      { padding: '14px 20px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: 10, position: 'sticky', bottom: 0, background: '#fff' },
  grid:             { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' },
  fullWidth:        { gridColumn: '1 / -1' },
  label:            { display: 'block', fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' },
  input:            { width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 3, fontSize: 13, outline: 'none', boxSizing: 'border-box' },
  errorMsg:         { marginTop: 12, background: '#fff5f5', border: '1px solid #fca5a5', color: '#dc2626', padding: '8px 12px', borderRadius: 3, fontSize: 13, borderLeft: '3px solid #dc2626' },
  btnPrimario:      { background: '#D4502A', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 3, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  btnSecundario:    { background: '#fff', color: '#333', border: '1px solid #ddd', padding: '8px 16px', borderRadius: 3, cursor: 'pointer', fontSize: 13 },
  netoPreview:      { background: '#f8f8f8', border: '1px solid #eee', borderRadius: 3, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  netoLabel:        { fontSize: 12, color: '#888', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' },
  netoValor:        { fontSize: 16, fontWeight: 700, color: '#D4502A' },
  plantillasGrid:   { display: 'flex', flexWrap: 'wrap', gap: 6 },
  btnPlantilla:     { background: '#f5f5f5', border: '1px solid #ddd', color: '#555', padding: '5px 12px', borderRadius: 3, cursor: 'pointer', fontSize: 12 },
  btnPlantillaActiva: { background: '#D4502A', color: '#fff', border: '1px solid #D4502A' },
  distPreview:      { background: '#f8f8f8', border: '1px solid #eee', borderRadius: 3, padding: '8px 12px' },
}
