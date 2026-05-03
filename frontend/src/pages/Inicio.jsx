import { useAuth } from '../context/AuthContext'

export default function Inicio() {
  const { usuario } = useAuth()

  const cards = [
    { label: 'Clientes', valor: '—', color: '#D4502A', icon: '👥' },
    { label: 'Proyectos activos', valor: '—', color: '#3D4D52', icon: '📐' },
    { label: 'Presupuestos', valor: '—', color: '#B8977E', icon: '📋' },
    { label: 'Órdenes de pago', valor: '—', color: '#5a6e75', icon: '💸' },
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
              <div style={styles.cardValor}>{c.valor}</div>
              <div style={styles.cardLabel}>{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={styles.placeholder}>
        <p style={{ color: '#aaa', fontSize: 14 }}>El dashboard con datos reales se completará a medida que se carguen clientes y proyectos.</p>
      </div>
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
  placeholder: {
    background: '#fff',
    borderRadius: 4,
    padding: 24,
    border: '1px dashed #ddd',
    textAlign: 'center',
  },
}
