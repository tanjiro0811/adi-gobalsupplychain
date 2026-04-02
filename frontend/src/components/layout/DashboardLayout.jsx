import { useEffect, useMemo, useState } from 'react'
import { connectNotificationSocket, disconnectNotificationSocket } from '../../api/socket'
import Sidebar from './Sidebar'
import UserMenu from '../navigation/UserMenu'
import StatCard from '../ui/StatCard'
import DashboardReportSection from './DashboardReportSection'
import { PATH_BY_ROLE_LINK, SOCKET_USER_BY_ROLE } from './navConfig'

const ROLE_COLORS = {
  Admin:        '#00fff7', // electric cyan
  Manufacturer: '#ffe600', // neon yellow
  Transporter:  '#7fff00', // acid green
  Dealer:       '#ff6b35', // hot orange
  RetailShop:   '#a78bfa', // deep violet
}

const DEFAULT_SPARK = [16, 20, 18, 24, 22, 28, 30]

function formatNotificationTimestamp(value) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return 'Live'
  }
  return parsed.toLocaleString()
}

function normalizeNotification(value) {
  if (!value || typeof value !== 'object') {
    return null
  }
  const id = String(value.id ?? '').trim()
  const title = String(value.title ?? '').trim()
  const message = String(value.message ?? '').trim()
  if (!id && !title && !message) {
    return null
  }
  const fallbackId = `local-${Date.now()}-${String(title || message || 'alert').slice(0, 24)}`
  return {
    id: id || fallbackId,
    title: title || 'Alert',
    message: message || '',
    severity: String(value.severity ?? 'info').toLowerCase(),
    timestamp: String(value.timestamp ?? ''),
    metadata: value.metadata ?? {},
    user_id: String(value.user_id ?? ''),
  }
}

function formatMetadataValue(value) {
  if (value == null || value === '') {
    return '—'
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function AlertsDrawer({ open, items = [], onClose }) {
  const [selectedItemId, setSelectedItemId] = useState('')

  if (!open) return null

  const selectedItem =
    items.find((item) => item.id === selectedItemId) ??
    items[0] ??
    null
  const detailEntries = Object.entries(selectedItem?.metadata || {}).filter(([, value]) => value !== undefined)

  return (
    <div className="alerts-drawer-overlay" role="dialog" aria-modal="true" aria-label="Alerts">
      <div className="alerts-drawer">
        <div className="alerts-drawer-header">
          <div>
            <div className="alerts-drawer-title">Alerts</div>
            <div className="muted" style={{ fontSize: 12 }}>
              {items.length ? `${items.length} recent message(s)` : 'No alerts yet.'}
            </div>
          </div>
          <button type="button" className="subtle-btn" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="alerts-drawer-body">
          {!items.length && (
            <div className="card" style={{ margin: 0 }}>
              <p className="muted" style={{ margin: 0 }}>
                No alert messages to show.
              </p>
            </div>
          )}

          {!!items.length && (
            <div className="alerts-box card" style={{ margin: 0 }}>
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="alerts-box-item"
                  onClick={() => setSelectedItemId(item.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: selectedItem?.id === item.id ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                    border: selectedItem?.id === item.id ? '1px solid rgba(59, 130, 246, 0.28)' : '1px solid transparent',
                    borderRadius: 12,
                    cursor: 'pointer',
                  }}
                >
                  <div className="alerts-box-head">
                    <strong className="alerts-box-title">{item.title}</strong>
                    <span className={`alerts-chip alerts-chip--${item.severity || 'info'}`}>
                      {String(item.severity || 'info').toUpperCase()}
                    </span>
                  </div>
                  {!!item.message && <div className="alerts-box-message">{item.message}</div>}
                  <div className="alerts-box-meta muted">{formatNotificationTimestamp(item.timestamp)}</div>
                </button>
              ))}
            </div>
          )}

          {!!selectedItem && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="alerts-box-head">
                <strong className="alerts-box-title">What happened</strong>
                <span className={`alerts-chip alerts-chip--${selectedItem.severity || 'info'}`}>
                  {String(selectedItem.severity || 'info').toUpperCase()}
                </span>
              </div>
              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>{selectedItem.title}</div>
                <div className="alerts-box-message">
                  {selectedItem.message || 'No extra message details were provided for this alert.'}
                </div>
                <div className="alerts-box-meta muted" style={{ marginTop: 8 }}>
                  {formatNotificationTimestamp(selectedItem.timestamp)}
                </div>
              </div>

              {!!detailEntries.length && (
                <div style={{ marginTop: 14 }}>
                  <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Alert details</div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {detailEntries.map(([key, value]) => (
                      <div
                        key={key}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(110px, 140px) 1fr',
                          gap: 10,
                          padding: '8px 10px',
                          borderRadius: 10,
                          background: 'rgba(148, 163, 184, 0.08)',
                        }}
                      >
                        <strong style={{ textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</strong>
                        <span>{formatMetadataValue(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <button
        type="button"
        className="alerts-drawer-scrim"
        aria-label="Close alerts"
        onClick={onClose}
      />
    </div>
  )
}



function getLinkForPath(role, path) {
  const linkMap = PATH_BY_ROLE_LINK[role]
  if (!linkMap || !path) {
    return 'Dashboard'
  }

  const normalizedPath = String(path).toLowerCase()
  const match = Object.entries(linkMap).find(([, value]) => String(value).toLowerCase() === normalizedPath)
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
  const [notificationItems, setNotificationItems] = useState([])
  const [alertsOpen, setAlertsOpen] = useState(false)
  const socketUserId = SOCKET_USER_BY_ROLE[role]
  const notificationCount = socketUserId ? notificationItems.length : Number(notifications || 0)

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

  useEffect(() => {
    setAlertsOpen(false)
    setNotificationItems([])
  }, [socketUserId])

  useEffect(() => {
    if (!socketUserId) {
      return undefined
    }

    connectNotificationSocket(socketUserId, {
      onMessage: (payload) => {
        if (!payload || typeof payload !== 'object') return
        if (payload.type === 'notification:init' && Array.isArray(payload.items)) {
          const normalized = payload.items.map(normalizeNotification).filter(Boolean)
          setNotificationItems(normalized)
          return
        }
        if (payload.type === 'notification') {
          const next = normalizeNotification(payload)
          if (next) {
            setNotificationItems((items) => {
              const deduped = items.filter((item) => item.id !== next.id)
              return [next, ...deduped].slice(0, 50)
            })
          }
        }
      },
    })

    return () => {
      disconnectNotificationSocket()
    }
  }, [socketUserId])

  const handleNavigate = (link) => {
    const path = PATH_BY_ROLE_LINK[role]?.[link]
    if (path && onNavigate) {
      setActiveLink(link)
      onNavigate(path)
      return
    }
    setActiveLink(link)
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
          <UserMenu
            userName={userName}
            notifications={notificationCount}
            onLogout={onLogout}
            onOpenAlerts={() => setAlertsOpen(true)}
          />
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
      <AlertsDrawer open={alertsOpen} items={notificationItems} onClose={() => setAlertsOpen(false)} />
    </div>
  )
}

export default DashboardLayout
