import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'

function RutaProtegida({ children }) {
  const { usuario } = useAuth()
  return usuario ? children : <Navigate to="/login" replace />
}

function Dashboard() {
  const { usuario, logout } = useAuth()
  return (
    <div style={{ padding: 40, fontFamily: 'Segoe UI, sans-serif' }}>
      <h2>Bienvenido, {usuario?.nombre}</h2>
      <p style={{ color: '#888' }}>Rol: {usuario?.rol}</p>
      <button onClick={logout} style={{ marginTop: 20, padding: '8px 16px', cursor: 'pointer' }}>
        Cerrar sesión
      </button>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RutaProtegida><Dashboard /></RutaProtegida>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
