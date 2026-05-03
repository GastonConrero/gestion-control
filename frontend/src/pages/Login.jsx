import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError('Email o contraseña incorrectos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Franja naranja superior */}
        <div style={styles.topBar} />

        <div style={styles.body}>
          <div style={styles.logoRow}>
            <div style={styles.logoBox}>GC</div>
            <div>
              <div style={styles.titulo}>Gestión y Control</div>
              <div style={styles.subtitulo}>Ing. Gastón Conrero</div>
            </div>
          </div>

          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={styles.input}
                placeholder="usuario@ejemplo.com"
                required
                autoFocus
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={styles.input}
                placeholder="••••••••"
                required
              />
            </div>

            {error && <div style={styles.error}>{error}</div>}

            <button type="submit" style={styles.btn} disabled={loading}>
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
        </div>

        {/* Pie tricolor */}
        <div style={styles.footer}>
          <div style={{ ...styles.footerCol, background: '#D4502A' }} />
          <div style={{ ...styles.footerCol, background: '#3D4D52' }} />
          <div style={{ ...styles.footerCol, background: '#B8977E' }} />
        </div>
      </div>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    background: '#111111',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Segoe UI', sans-serif",
  },
  card: {
    width: 380,
    background: '#fff',
    borderRadius: 4,
    overflow: 'hidden',
    boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
  },
  topBar: {
    height: 4,
    background: '#D4502A',
  },
  body: {
    padding: '32px 36px 28px',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    marginBottom: 32,
  },
  logoBox: {
    width: 44,
    height: 44,
    background: '#D4502A',
    color: '#fff',
    fontWeight: 700,
    fontSize: 18,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 2,
    flexShrink: 0,
  },
  titulo: {
    fontSize: 17,
    fontWeight: 700,
    color: '#111',
    lineHeight: 1.2,
  },
  subtitulo: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: '#3D4D52',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  input: {
    padding: '10px 12px',
    border: '1px solid #ddd',
    borderRadius: 3,
    fontSize: 14,
    color: '#111',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  error: {
    background: '#fff5f5',
    border: '1px solid #fca5a5',
    color: '#dc2626',
    padding: '8px 12px',
    borderRadius: 3,
    fontSize: 13,
    borderLeft: '3px solid #dc2626',
  },
  btn: {
    background: '#D4502A',
    color: '#fff',
    border: 'none',
    padding: '12px',
    borderRadius: 3,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 4,
    letterSpacing: '0.03em',
  },
  footer: {
    display: 'flex',
    height: 6,
  },
  footerCol: {
    flex: 1,
  },
}
