import { useCallback, useEffect, useMemo, useState } from 'react'
import { trackingApi } from '../../api/axiosInstance'
import { connectGpsSocket, disconnectGpsSocket } from '../../api/socket'
import PieChart from '../../components/charts/PieChart'
import Loader from '../../components/common/Loader'
import Table from '../../components/common/Table'
import DashboardLayout from '../../components/layout/DashboardLayout'
import GPSMap from './GPSMap'
import Analytics from './Analytics'
import Shipments from './Shipment'
import FleetManager from './FleetManager'
import {
  buildTransportAlerts,
  computeTransportMetrics,
  normalizeAnalyticsPayload,
  toShipmentRows,
} from './shipmentUtils'
import './transporter.css'

function mapShipmentsToRows(rows = []) {
  return rows.map((item) => ({
    vehicle: item.vehicleNumber || item.id,
    route: item.hasGps ? `${item.lat.toFixed(2)}, ${item.lng.toFixed(2)}` : 'Signal unavailable',
    eta: item.eta,
    status: item.status,
  }))
}

function formatAlertTimestamp(value) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return 'Live'
  }
  return parsed.toLocaleString()
}

function TransporterDashboard({
  user,
  onLogout,
  onNavigate,
  currentPath,
  initialView = 'overview',
}) {
  const [shipments, setShipments] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [analyticsPayload, setAnalyticsPayload] = useState({})
  const [alerts, setAlerts] = useState([])
  const [isSocketConnected, setIsSocketConnected] = useState(false)
  const [activeView, setActiveView] = useState(initialView)
  const [pingingShipmentId, setPingingShipmentId] = useState('')
  const [pingMessage, setPingMessage] = useState('')

  const applyTransportPayload = useCallback(
    ({ shipments: nextShipments = {}, analytics = {}, alerts: nextAlerts = [] }) => {
      setShipments(nextShipments)
      setAnalyticsPayload(normalizeAnalyticsPayload(analytics, nextShipments, '7d'))
      if (Array.isArray(nextAlerts) && nextAlerts.length) {
        setAlerts(nextAlerts)
      } else {
        setAlerts(buildTransportAlerts(nextShipments))
      }
    },
    [],
  )

  useEffect(() => {
    let mounted = true

    async function loadGps() {
      try {
        const [payload, analyticsRes] = await Promise.all([
          trackingApi.liveGps(),
          trackingApi.analytics('7d'),
        ])
        if (mounted) {
          const nextShipments = payload?.shipments ?? {}
          applyTransportPayload({
            shipments: nextShipments,
            analytics: analyticsRes ?? {},
            alerts: buildTransportAlerts(nextShipments),
          })
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    loadGps()

    connectGpsSocket({
      onOpen: () => {
        if (mounted) {
          setIsSocketConnected(true)
        }
      },
      onClose: () => {
        if (mounted) {
          setIsSocketConnected(false)
        }
      },
      onMessage: (event) => {
        if (!mounted || !event || typeof event !== 'object') {
          return
        }
        if (event.type === 'gps:update' || event.shipments) {
          applyTransportPayload({
            shipments: event.shipments ?? {},
            analytics: event.analytics ?? {},
            alerts: Array.isArray(event.alerts) ? event.alerts : [],
          })
        }
      },
    })

    return () => {
      mounted = false
      setIsSocketConnected(false)
      disconnectGpsSocket()
    }
  }, [applyTransportPayload])

  useEffect(() => {
    setActiveView(initialView)
  }, [initialView])

  const shipmentRows = useMemo(() => toShipmentRows(shipments), [shipments])
  const rows = useMemo(() => mapShipmentsToRows(shipmentRows), [shipmentRows])
  const metrics = useMemo(() => computeTransportMetrics(shipments), [shipments])
  const normalizedAnalytics = useMemo(
    () => normalizeAnalyticsPayload(analyticsPayload, shipments, '7d'),
    [analyticsPayload, shipments],
  )
  const alertFeed = useMemo(() => (alerts.length ? alerts : buildTransportAlerts(shipments)), [alerts, shipments])
  const controllableShipments = useMemo(
    () => shipmentRows.filter((item) => item.isInTransit && item.hasGps).slice(0, 4),
    [shipmentRows],
  )

  const sendGpsPing = useCallback(
    async (shipment) => {
      if (!shipment?.id || !Number.isFinite(shipment.lat) || !Number.isFinite(shipment.lng)) {
        return
      }

      setPingingShipmentId(shipment.id)
      setPingMessage('')
      try {
        const nextLat = Number(Number(shipment.lat).toFixed(5))
        const nextLng = Number(Number(shipment.lng).toFixed(5))

        await trackingApi.updateShipmentLocation(shipment.id, {
          lat: nextLat,
          lng: nextLng,
          status: 'in_transit',
        })
        setPingMessage(`GPS ping sent for ${shipment.id}.`)
      } catch (error) {
        setPingMessage(error?.message || 'Failed to send GPS ping.')
      } finally {
        setPingingShipmentId('')
      }
    },
    [],
  )

  const stats = [
      { label: 'Vehicles Active', value: metrics.activeVehicles, trend: isSocketConnected ? 'Live' : 'Snapshot' },
    { label: 'On-Time Deliveries', value: metrics.onTimeDeliveries, trend: `${100 - metrics.delayRate}% healthy` },
    { label: 'Delayed Routes', value: metrics.delayed, trend: 'Live alert source' },
    { label: 'Fleet In Transit', value: metrics.inTransit, trend: 'Live shipment state' },
    { label: 'Live GPS Pings', value: metrics.liveGpsPings, trend: 'Approx stream rate' },
    { label: 'GPS Offline', value: metrics.gpsOffline, trend: 'Needs follow-up' },
  ]

  return (
    <DashboardLayout
      role="Transporter"
      themeClass="transporter-theme"
      userName={user?.name}
      onLogout={onLogout}
      onNavigate={onNavigate}
      currentPath={currentPath}
      stats={stats}
      notifications={alertFeed.length}
    >
      {activeView === 'overview' && (
        <>
          <section
            style={{ display: 'grid', gap: 12, gridTemplateColumns: '2fr 1fr' }}
          >
            {isLoading ? (
              <Loader label="Loading live GPS data..." />
            ) : (
              <Table
                columns={[
                  { key: 'vehicle', label: 'Vehicle' },
                  { key: 'route', label: 'Route' },
                  { key: 'eta', label: 'ETA (hrs)' },
                  { key: 'status', label: 'Status' },
                ]}
                rows={rows}
                emptyMessage="No fleet data"
              />
            )}
            <PieChart
              title="Fleet Status"
              data={normalizedAnalytics.statusData}
            />
          </section>
          <section className="card" style={{ marginTop: 12 }}>
            <div className="shipments-header">
              <h4 className="card-title">Live Alerts</h4>
              <div className="shipments-controls">
                <span className={`tracking-chip ${isSocketConnected ? 'live' : 'offline'}`}>
                  {isSocketConnected ? 'Live updates' : 'Updates offline'}
                </span>
              </div>
            </div>
            {!alertFeed.length && (
              <p className="muted" style={{ margin: 0 }}>
                No active transporter alerts. All shipments look healthy.
              </p>
            )}
            {!!alertFeed.length && (
              <div className="tracking-feedback-list">
                {alertFeed.map((alert) => (
                  <article key={alert.id} className="tracking-feedback-item">
                    <div className="tracking-feedback-head">
                      <strong>{alert.title}</strong>
                      <span className={`assignment-chip ${alert.severity === 'critical' ? 'pending' : 'assigned'}`}>
                        {String(alert.severity || 'info').toUpperCase()}
                      </span>
                    </div>
                    <p className="tracking-feedback-note">{alert.message}</p>
                    <p className="tracking-feedback-note">
                      Shipment: {alert.shipmentId || '--'} | {formatAlertTimestamp(alert.timestamp)}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>
          <section className="card" style={{ marginTop: 12 }}>
            <div className="shipments-header">
              <h4 className="card-title">Live GPS Ping Control</h4>
              <div className="shipments-controls">
                <span className={`tracking-chip ${isSocketConnected ? 'live' : 'offline'}`}>
                  Dealer ETA sync active
                </span>
              </div>
            </div>
            {!controllableShipments.length && (
              <p className="muted" style={{ margin: 0 }}>
                No in-transit GPS-enabled shipments available for ping.
              </p>
            )}
            {!!controllableShipments.length && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {controllableShipments.map((shipment) => (
                  <button
                    key={shipment.id}
                    type="button"
                    onClick={() => sendGpsPing(shipment)}
                    disabled={pingingShipmentId === shipment.id}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: 'none',
                      cursor: pingingShipmentId === shipment.id ? 'not-allowed' : 'pointer',
                      background: '#0ea5e9',
                      color: '#ffffff',
                      opacity: pingingShipmentId === shipment.id ? 0.7 : 1,
                    }}
                  >
                    {pingingShipmentId === shipment.id ? 'Sending...' : `Ping ${shipment.id}`}
                  </button>
                ))}
              </div>
            )}
            {!!pingMessage && (
              <p className="tracking-feedback-note" style={{ marginTop: 10 }}>
                {pingMessage}
              </p>
            )}
          </section>
        </>
      )}
      {activeView === 'map' && <GPSMap shipments={shipments} />}
      {activeView === 'analytics' && (
        <Analytics shipments={shipments} analyticsData={normalizedAnalytics} />
      )}
      {activeView === 'fleet' && <FleetManager shipments={shipments} />}
      {activeView === 'shipments' && <Shipments shipments={shipments} />}
    </DashboardLayout>
  )
}

export default TransporterDashboard
