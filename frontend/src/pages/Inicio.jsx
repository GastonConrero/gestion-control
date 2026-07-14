import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../utils/api'
import PlanificacionSemanal from './PlanificacionSemanal'

function fmtMoneda(n) {
  if (n === null || n === undefined) return '—'
  return '$ ' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtFechaHora(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) + ' · ' +
         d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

const TIPO_LABEL = {
  recibo: 'Recibo',
  orden_pago: 'Orden de pago',
  presupuesto: 'Presupuesto',
}

export default function Inicio() {
  const { usuario } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/dashboard/resumen')
      .then(res => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  const cards = [
    { label: 'Clientes', valor: data?.clientes, color: '#D4502A', icon: '👥' },
    { label: 'Proyectos activos', valor: data?.proyectos_activos, color: '#3D4D52', icon: '📐' },
    { label: 'Presupuestos pendientes', valor: data?.presupuestos_pendientes, color: '#B8977E', icon: '📋' },
    { label: 'Órdenes de pago pendientes', valor: data?.ordenes_pendientes, color: '#5a6e75', icon: '💸' },
  ]

  return (
    <div>
      <div style={styles.welcomeBar}>
        <h2 style={styles.titulo}>Bienvenido, {usuario?.nombre}</h2>
        <p style={styles.fecha}>{new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      <div style={styles.cards}>
        {cards.map(c => (
          <div key={c.label} style={styles.card}>
            <div style={{ ...styles.cardAccent, background: c.color }} />
            <div style={styles.cardBody}>
              <div style={styles.cardIcon}>{c.icon}</div>
              <div style={styles.cardValor}>{loading ? '—' : (c.valor ?? '—')}</div>
              <div style={styles.cardLabel}>{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      <PlanificacionSemanal />

      {!loading && data?.financiero && (
        <div style={styles.finGrid}>
          <div style={styles.finCard}>
            <div style={styles.finLabel}>Recibido este mes</div>
            <div style={{ ...styles.finValor, color: '#16a34a' }}>{fmtMoneda(data.financiero.recibido_mes)}</div>
          </div>
          <div style={styles.finCard}>
            <div style={styles.finLabel}>Pagado este mes</div>
            <div style={{ ...styles.finValor, color: '#dc2626' }}>{fmtMoneda(data.financiero.pagado_mes)}</div>
          </div>
          <div style={styles.finCard}>
            <div style={styles.finLabel}>Saldo del mes</div>
            <div style={{ ...styles.finValor, color: data.financiero.saldo_mes >= 0 ? '#111' : '#dc2626' }}>
              {fmtMoneda(data.financiero.saldo_mes)}
            </div>
          </div>
        </div>
      )}

      {!loading && data?.actividad?.length > 0 && (
        <div style={styles.actividadBox}>
          <h3 style={styles.actividadTitulo}>Actividad reciente</h3>
          <div style={styles.actividadLista}>
            {data.actividad.map((a, i) => (
              <div key={i} style={styles.actividadItem}>
                <div style={styles.actividadIcono}>{a.icono}</div>
                <div style={styles.actividadCentro}>
                  <div style={styles.actividadTitulo2}>{a.titulo}</div>
                  <div style={styles.actividadDetalle}>{a.detalle} · {TIPO_LABEL[a.tipo]}</div>
                </div>
                <div style={styles.actividadDerecha}>
                  {a.monto != null && <div style={styles.actividadMonto}>{fmtMoneda(a.monto)}</div>}
                  <div style={styles.actividadFecha}>{fmtFechaHora(a.fecha)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && !data?.financiero && !data?.actividad?.length && (
        <div style={styles.placeholder}>
          <p style={{ color: '#aaa', fontSize: 14 }}>Todavía no hay actividad registrada.</p>
        </div>
      )}
    </div>
  )
}

const styles = {
  welcomeBar: {
    marginBottom: 24,
  },
  titulo: {
    fontSize: 22,
    fontWeight: 700,
    color: '#111',
    margin: 0,
  },
  fecha: {
    fontSize: 13,
    color: '#888',
    margin: '4px 0 0',
    textTransform: 'capitalize',
  },
  cards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 16,
    marginBottom: 24,
  },
  card: {
    background: '#fff',
    borderRadius: 4,
    overflow: 'hidden',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  },
  cardAccent: {
    height: 4,
  },
  cardBody: {
    padding: '16px 20px',
  },
  cardIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  cardValor: {
    fontSize: 28,
    fontWeight: 700,
    color: '#111',
    lineHeight: 1,
  },
  cardLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  finGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: 16,
    marginBottom: 24,
  },
  finCard: {
    background: '#fff',
    borderRadius: 4,
    padding: '16px 20px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  },
  finLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  finValor: {
    fontSize: 22,
    fontWeight: 700,
  },
  actividadBox: {
    background: '#fff',
    borderRadius: 4,
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    padding: '18px 20px',
  },
  actividadTitulo: {
    fontSize: 14,
    fontWeight: 700,
    color: '#111',
    margin: '0 0 14px',
  },
  actividadLista: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  actividadItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 0',
    borderBottom: '1px solid #f2f2f2',
  },
  actividadIcono: {
    fontSize: 18,
    width: 28,
    textAlign: 'center',
    flexShrink: 0,
  },
  actividadCentro: {
    flex: 1,
    minWidth: 0,
  },
  actividadTitulo2: {
    fontSize: 13,
    fontWeight: 700,
    color: '#111',
  },
  actividadDetalle: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  actividadDerecha: {
    textAlign: 'right',
    flexShrink: 0,
  },
  actividadMonto: {
    fontSize: 13,
    fontWeight: 700,
    color: '#111',
  },
  actividadFecha: {
    fontSize: 11,
    color: '#aaa',
    marginTop: 2,
  },
  placeholder: {
    background: '#fff',
    borderRadius: 4,
    padding: 24,
    border: '1px dashed #ddd',
    textAlign: 'center',
  },
}
