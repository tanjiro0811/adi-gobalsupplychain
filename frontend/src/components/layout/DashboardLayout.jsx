import { useEffect, useMemo, useState } from 'react'
import Sidebar from './Sidebar'
import UserMenu from '../navigation/UserMenu'
import StatCard from '../ui/StatCard'
import DashboardReportSection from './DashboardReportSection'

const ROLE_COLORS = {
  Admin:        '#00fff7', // electric cyan
  Manufacturer: '#ffe600', // neon yellow
  Transporter:  '#7fff00', // acid green
  Dealer:       '#ff6b35', // hot orange
  RetailShop:   '#a78bfa', // deep violet
}

const DEFAULT_SPARK = [16, 20, 18, 24, 22, 28, 30]

const PATH_BY_ROLE_LINK = {
  Admin: {
    Dashboard: '/admin/dashboard',
    Analytics: '/admin/analytics',
    'Blockchain Monitor': '/admin/blockchain',
    Reports: '/admin/reports',
  },
  Manufacturer: {
    Dashboard: '/manufacturer/dashboard',
    Production: '/manufacturer/production',
    'AI Forecast': '/manufacturer/analytics',
    'Ledger Feed': '/manufacturer/blockchain',
    Inventory: '/manufacturer/inventory',
  },
  Transporter: {
    Dashboard: '/transporter/dashboard',
    'Live Map': '/transporter/map',
    'AI Routes': '/transporter/analytics',
    'Fleet Alerts': '/transporter/fleet',
    Shipments: '/transporter/shipments',
  },
  Dealer: {
    Dashboard: '/dealer/dashboard',
    Analytics: '/dealer/analytics',
    Orders: '/dealer/orders',
    Inventory: '/dealer/inventory',
    Arrivals: '/dealer/arrivals',
  },
  RetailShop: {
    Dashboard: '/retail/dashboard',
    Scanner: '/retail/scanner',
    Verification: '/retail/inventory',
    Sales: '/retail/sales',
    POS: '/retail/pos',
  },
}

function getLinkForPath(role, path) {
  const linkMap = PATH_BY_ROLE_LINK[role]
  if (!linkMap || !path) {
    return 'Dashboard'
  }

  const normalizedPath = String(path).toLowerCase()
  const match = Object.entries(linkMap).find(([, value]) => value === normalizedPath)
  return match?.[0] ?? 'Dashboard'
}

function DashboardLayout({
  role,
  userName,
  onLogout,
  onNavigate,
  currentPath = '',
  themeClass = '',
  stats = [],
  notifications = 0,
  children,
}) {
  const [activeLink, setActiveLink] = useState(() => getLinkForPath(role, currentPath))

  const enrichedStats = useMemo(
    () =>
      stats.map((item, index) => ({
        ...item,
        sparkline: item.sparkline ?? DEFAULT_SPARK.map((value) => value + index * 2),
        color: item.color ?? ROLE_COLORS[role] ?? '#0f766e',
      })),
    [role, stats],
  )

  useEffect(() => {
    setActiveLink(getLinkForPath(role, currentPath))
  }, [role, currentPath])

  const handleNavigate = (link) => {
    setActiveLink(link)
    const path = PATH_BY_ROLE_LINK[role]?.[link]
    if (path && onNavigate) {
      onNavigate(path)
    }
  }

  const roleClass = role ? `role-${String(role).toLowerCase()}` : ''
  const shellClassName = ['dashboard-shell', roleClass, themeClass].filter(Boolean).join(' ')
  const showRoleReport = activeLink === 'Dashboard'

  return (
    <div className={shellClassName}>
      <Sidebar role={role} activeLink={activeLink} onNavigate={handleNavigate} />
      <section className="dashboard-main">
        <header className="topbar">
          <div>
            <h3>{role} Role accessed</h3>
            <p className="muted">Active view: {activeLink}</p>
          </div>
          <UserMenu userName={userName} notifications={notifications} onLogout={onLogout} />
        </header>

        <main className="dashboard-content">
          {!!enrichedStats.length && (
            <section className="command-grid">
              {enrichedStats.map((item, index) => (
                <StatCard
                  key={item.label}
                  label={item.label}
                  value={item.value}
                  trend={item.trend}
                  sparkline={item.sparkline}
                  color={item.color}
                  icon={item.icon}
                  index={index}
                />
              ))}
            </section>
          )}
          {showRoleReport && <DashboardReportSection role={role} stats={enrichedStats} />}
          {children}
        </main>
      </section>
    </div>
  )
}

export default DashboardLayout
