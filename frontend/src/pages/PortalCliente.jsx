import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import api from '../utils/api'

const ESTADO_COLOR = {
  'Sin iniciar': { color: '#999', bg: '#f2f2f2' },
  'En progreso': { color: '#D4502A', bg: '#fff4f1' },
  'Terminado':   { color: '#16a34a', bg: '#f0fdf4' },
}

function fmtFecha(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
}

export default function PortalCliente() {
  const { token } = useParams()
  const [datos, setDatos] = useState(null)
  const [avance, setAvance] = useState([])
  const [seguimiento, setSeguimiento] = useState([])
  const [tab, setTab] = useState('avance')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const cargar = async () => {
      try {
        const [rd, ra, rs] = await Promise.all([
          api.get(`/api/portal/${token}`),
          api.get(`/api/portal/${token}/avance`),
          api.get(`/api/portal/${token}/seguimiento`),
        ])
        setDatos(rd.data)
        setAvance(ra.data)
        setSeguimiento(rs.data)
      } catch {
        setError(true)
      } finally { setLoading(false) }
    }
    cargar()
  }, [token])

  if (loading) {
    return <div style={s.centrado}><div style={s.cargando}>Cargando...</div></div>
  }

  if (error || !datos) {
    return (
      <div style={s.centrado}>
        <div style={s.errorBox}>
          <div style={s.errorTitulo}>Link no disponible</div>
          <div style={s.errorTexto}>Este link no es válido o fue actualizado. Pedile a NODO el link más reciente.</div>
        </div>
      </div>
    )
  }

  return (
    <div style={s.pagina}>
      <div style={s.franja} />
      <div style={s.header}>
        <div style={s.logoBox}>N</div>
        <div>
          <div style={s.headerTitulo}>NODO Ingeniería y Arquitectura</div>
          <div style={s.headerSub}>Seguimiento de obra</div>
        </div>
      </div>

      <div style={s.contenido}>
        <div style={s.obraCard}>
          <div style={s.obraNombre}>{datos.obra_nombre}</div>
          {datos.tipo_obra && <div style={s.obraTipo}>{datos.tipo_obra}</div>}
          <div style={s.obraCliente}>{datos.cliente_nombre}</div>

          <div style={s.avanceGlobalBox}>
            <div style={s.avanceGlobalLabel}>AVANCE GENERAL</div>
            <div style={s.avanceGlobalPct}>{datos.avance_global}%</div>
            <div style={s.barraFondo}>
              <div style={{ ...s.barraRelleno, width: `${Math.min(datos.avance_global, 100)}%` }} />
            </div>
            {datos.ultimo_periodo && <div style={s.avanceGlobalPeriodo}>Último período: {datos.ultimo_periodo}</div>}
          </div>
        </div>

        <div style={s.tabsBar}>
          <button
            onClick={() => setTab('avance')}
            style={{ ...s.tabBtn, ...(tab === 'avance' ? s.tabBtnActivo : {}) }}
          >
            Avance por ítem
          </button>
          <button
            onClick={() => setTab('seguimiento')}
            style={{ ...s.tabBtn, ...(tab === 'seguimiento' ? s.tabBtnActivo : {}) }}
          >
            Seguimiento semanal
          </button>
        </div>

        {tab === 'avance' && (
          <div style={s.lista}>
            {avance.length === 0 ? (
              <div style={s.vacio}>Todavía no hay avance cargado.</div>
            ) : (
              avance.map((it, i) => {
                const est = ESTADO_COLOR[it.estado] || ESTADO_COLOR['Sin iniciar']
                return (
                  <div key={i} style={s.itemCard}>
                    <div style={s.itemHeader}>
                      <span style={s.itemNombre}>{it.designacion}</span>
                      <span style={{ ...s.itemBadge, color: est.color, background: est.bg }}>{it.estado}</span>
                    </div>
                    <div style={s.barraFondo}>
                      <div style={{ ...s.barraRelleno, width: `${Math.min(it.pct, 100)}%` }} />
                    </div>
                    <div style={s.itemPct}>{it.pct}%</div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {tab === 'seguimiento' && (
          <div style={s.lista}>
            {seguimiento.length === 0 ? (
              <div style={s.vacio}>Todavía no hay seguimiento cargado.</div>
            ) : (
              seguimiento.map((sg, i) => (
                <div key={i} style={s.seguimientoCard}>
                  <div style={s.seguimientoHeader}>
                    <span style={s.seguimientoPeriodo}>{sg.periodo} · Semana {sg.semana_numero}</span>
                  </div>
                  {sg.descripcion && <div style={s.seguimientoTexto}>{sg.descripcion}</div>}
                  {(sg.foto_url_1 || sg.foto_url_2) && (
                    <div style={s.fotosGrid}>
                      {sg.foto_url_1 && <img src={sg.foto_url_1} alt="" style={s.foto} />}
                      {sg.foto_url_2 && <img src={sg.foto_url_2} alt="" style={s.foto} />}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div style={s.footer}>NODO Ingeniería y Arquitectura · Pozo del Molle, Córdoba</div>
    </div>
  )
}

const s = {
  pagina:       { minHeight: '100vh', background: '#f5f5f5', fontFamily: 'system-ui, -apple-system, sans-serif' },
  franja:       { height: 4, background: '#D4502A' },
  centrado:     { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', padding: 20 },
  cargando:     { color: '#999', fontSize: 14 },
  errorBox:     { background: '#fff', borderRadius: 8, padding: 24, textAlign: 'center', maxWidth: 320, boxShadow: '0 1px 6px rgba(0,0,0,0.08)' },
  errorTitulo:  { fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 8 },
  errorTexto:   { fontSize: 13, color: '#888' },
  header:       { display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', background: '#fff', borderBottom: '1px solid #eee' },
  logoBox:      { width: 36, height: 36, borderRadius: 8, background: '#D4502A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, flexShrink: 0 },
  headerTitulo: { fontSize: 14, fontWeight: 700, color: '#111' },
  headerSub:    { fontSize: 11, color: '#999' },
  contenido:    { padding: '16px', maxWidth: 480, margin: '0 auto' },
  obraCard:     { background: '#fff', borderRadius: 8, padding: 16, marginBottom: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  obraNombre:   { fontSize: 17, fontWeight: 700, color: '#111' },
  obraTipo:     { fontSize: 13, color: '#888', marginTop: 2 },
  obraCliente:  { fontSize: 12, color: '#999', marginTop: 4 },
  avanceGlobalBox: { marginTop: 16, paddingTop: 14, borderTop: '1px solid #f2f2f2' },
  avanceGlobalLabel: { fontSize: 10, fontWeight: 700, color: '#999', letterSpacing: '0.05em' },
  avanceGlobalPct: { fontSize: 32, fontWeight: 700, color: '#D4502A', marginTop: 2, marginBottom: 8 },
  avanceGlobalPeriodo: { fontSize: 11, color: '#999', marginTop: 8 },
  barraFondo:   { height: 8, background: '#f0f0f0', borderRadius: 20, overflow: 'hidden' },
  barraRelleno: { height: '100%', background: '#D4502A', borderRadius: 20, transition: 'width 0.3s' },
  tabsBar:      { display: 'flex', gap: 4, marginBottom: 14, background: '#e9e9e9', borderRadius: 8, padding: 3 },
  tabBtn:       { flex: 1, background: 'none', border: 'none', padding: '9px 6px', borderRadius: 6, fontSize: 12.5, fontWeight: 600, color: '#777', cursor: 'pointer' },
  tabBtnActivo: { background: '#fff', color: '#D4502A', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  lista:        { display: 'flex', flexDirection: 'column', gap: 10 },
  vacio:        { textAlign: 'center', color: '#aaa', fontSize: 13, padding: '30px 0' },
  itemCard:     { background: '#fff', borderRadius: 8, padding: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  itemHeader:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  itemNombre:   { fontSize: 13.5, fontWeight: 600, color: '#111' },
  itemBadge:    { fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 },
  itemPct:      { fontSize: 11, color: '#999', marginTop: 5, textAlign: 'right' },
  seguimientoCard: { background: '#fff', borderRadius: 8, padding: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  seguimientoHeader: { marginBottom: 6 },
  seguimientoPeriodo: { fontSize: 11, fontWeight: 700, color: '#D4502A', textTransform: 'uppercase', letterSpacing: '0.03em' },
  seguimientoTexto: { fontSize: 13, color: '#333', lineHeight: 1.5 },
  fotosGrid:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 },
  foto:         { width: '100%', height: 110, objectFit: 'cover', borderRadius: 6, background: '#f0f0f0' },
  footer:       { textAlign: 'center', fontSize: 11, color: '#bbb', padding: '20px 0' },
}
