import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Layout from './components/Layout'
import Inicio from './pages/Inicio'

function RutaProtegida({ children }) {
  const { usuario } = useAuth()
  return usuario ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RutaProtegida><Layout /></RutaProtegida>}>
            <Route index element={<Inicio />} />
            <Route path="clientes" element={<div style={{padding:20}}><h3>Clientes</h3></div>} />
            <Route path="proyectos" element={<div style={{padding:20}}><h3>Proyectos</h3></div>} />
            <Route path="presupuestos" element={<div style={{padding:20}}><h3>Presupuestos</h3></div>} />
            <Route path="recibos" element={<div style={{padding:20}}><h3>Recibos</h3></div>} />
            <Route path="ordenes-pago" element={<div style={{padding:20}}><h3>Órdenes de Pago</h3></div>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
