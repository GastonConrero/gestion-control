import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Layout from './components/Layout'
import Inicio from './pages/Inicio'
import Clientes from './pages/Clientes'
import Presupuestos from './pages/presupuestos'
import Recibos from './pages/recibos'
import OrdenesPago from './pages/ordenes-pago'
import PortalCliente from './pages/PortalCliente'

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
          <Route path="/portal/:token" element={<PortalCliente />} />
          <Route path="/" element={<RutaProtegida><Layout /></RutaProtegida>}>
            <Route index element={<Inicio />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="proyectos" element={<div style={{padding:20}}><h3>Proyectos</h3></div>} />
            <Route path="presupuestos" element={<Presupuestos />} />
            <Route path="recibos" element={<Recibos />} />
            <Route path="ordenes-pago" element={<OrdenesPago />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
