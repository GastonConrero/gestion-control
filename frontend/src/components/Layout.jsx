import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV_ITEMS = [
  { path: '/', label: 'Inicio', icon: '⊞' },
  { path: '/clientes', label: 'Clientes', icon: '👥' },
  { path: '/proyectos', label: 'Proyectos', icon: '📐' },
  { path: '/presupuestos', label: 'Presupuestos', icon: '📋' },
  { path: '/recibos', label: 'Recibos', icon: '🧾' },
  { path: '/ordenes-pago', label: 'Órdenes de Pago', icon: '💸' },
  { path: '/banco-precios', label: 'Banco de Precios', icon: '💲' },
  { path: '/materiales', label: 'Materiales', icon: '📦' },
  { path: '/analisis-inversion', label: 'Análisis de Inversión', icon: '📊' },
]

export default function Layout() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div style={styles.root}>
      {/* SIDEBAR */}
      <aside style={{ ...styles.sidebar, width: collapsed ? 60 : 220 }}>
        {/* Logo */}
        <div style={styles.logoArea}>
          <div style={styles.logoBox}>GC</div>
          {!collapsed && (
            <div style={styles.logoText}>
              <div style={styles.logoTitle}>Gestión y Control</div>
              <div style={styles.logoSub}>Ing. Gastón Conrero</div>
            </div>
          )}
        </div>

        {/* Franja tricolor */}
        <div style={styles.tricolor}>
          <div style={{ flex: 1, background: '#D4502A' }} />
          <div style={{ flex: 1, background: '#3D4D52' }} />
          <div style={{ flex: 1, background: '#B8977E' }} />
        </div>

        {/* Nav */}
        <nav style={styles.nav}>
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              style={({ isActive }) => ({
                ...styles.navItem,
                background: isActive ? 'rgba(212,80,42,0.15)' : 'transparent',
                borderLeft: isActive ? '3px solid #D4502A' : '3px solid transparent',
                color: isActive ? '#D4502A' : '#ccc',
              })}
            >
              <span style={styles.navIcon}>{item.icon}</span>
              {!collapsed && <span style={styles.navLabel}>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Footer sidebar */}
        <div style={styles.sidebarFooter}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={styles.collapseBtn}
            title={collapsed ? 'Expandir' : 'Contraer'}
          >
            {collapsed ? '→' : '←'}
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <div style={styles.main}>
        {/* HEADER */}
        <header style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={styles.breadcrumb}>Sistema de Gestión</div>
          </div>
          <div style={styles.headerRight}>
            <div style={styles.userInfo}>
              <div style={styles.userAvatar}>
                {usuario?.nombre?.charAt(0) || 'U'}
              </div>
              {usuario?.nombre}
            </div>
            <button onClick={handleLogout} style={styles.logoutBtn}>
              Salir
            </button>
          </div>
        </header>

        {/* CONTENT */}
        <main style={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

const styles = {
  root: {
    display: 'flex',
    minHeight: '100vh',
    background: '#f4f4f4',
    fontFamily: "'Segoe UI', sans-serif",
  },
  sidebar: {
    background: '#1a1a1a',
    display: 'flex',
    flexDirection: 'column',
    transition: 'width 0.2s ease',
    flexShrink: 0,
    overflow: 'hidden',
  },
  logoArea: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '20px 14px 16px',
  },
  logoBox: {
    width: 34,
    height: 34,
    background: '#D4502A',
    color: '#fff',
    fontWeight: 700,
    fontSize: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 2,
    flexShrink: 0,
  },
  logoText: {
    overflow: 'hidden',
  },
  logoTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  logoSub: {
    color: '#888',
    fontSize: 10,
    whiteSpace: 'nowrap',
  },
  tricolor: {
    display: 'flex',
    height: 3,
    marginBottom: 8,
  },
  nav: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '8px 0',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 500,
    transition: 'all 0.15s',
    whiteSpace: 'nowrap',
  },
  navIcon: {
    fontSize: 16,
    flexShrink: 0,
    width: 20,
    textAlign: 'center',
  },
  navLabel: {
    overflow: 'hidden',
  },
  sidebarFooter: {
    padding: '12px 14px',
    borderTop: '1px solid #2a2a2a',
  },
  collapseBtn: {
    background: 'none',
    border: '1px solid #333',
    color: '#888',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: 3,
    fontSize: 12,
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  header: {
    background: '#fff',
    borderBottom: '1px solid #e5e5e5',
    padding: '0 24px',
    height: 52,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  headerLeft: {},
  breadcrumb: {
    fontSize: 13,
    color: '#888',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: '#333',
  },
  userAvatar: {
    width: 28,
    height: 28,
    background: '#D4502A',
    color: '#fff',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: 12,
  },
  logoutBtn: {
    background: 'none',
    border: '1px solid #ddd',
    color: '#666',
    padding: '4px 12px',
    borderRadius: 3,
    cursor: 'pointer',
    fontSize: 12,
  },
  content: {
    flex: 1,
    padding: 24,
    overflow: 'auto',
  },
}
