import { useEffect, useMemo, useState } from 'react'
import { trackingApi } from '../../api/axiosInstance'
import { connectGpsSocket, disconnectGpsSocket } from '../../api/socket'
import PieChart from '../../components/charts/PieChart'
import Loader from '../../components/common/Loader'
import Table from '../../components/common/Table'
import DashboardLayout from '../../components/layout/DashboardLayout'
import FleetMap from '../../components/maps/FleetMap'
import GPSMap from './GPSMap'
import Analytics from './Analytics'
import Shipments from './Shipment'
import FleetManager from './FleetManager'
import './transporter.css'

function mapShipmentsToRows(shipments = {}) {
  return Object.entries(shipments).map(([shipmentId, item]) => ({
    vehicle: shipmentId,
    route: `${item.lat?.toFixed?.(2) ?? item.lat}, ${item.lng?.toFixed?.(2) ?? item.lng}`,
    eta: '--',
    status: String(item.status ?? 'unknown').replace('_', ' '),
  }))
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
  const [analyticsPayload, setAnalyticsPayload] = useState({
    deliveryTrends: [],
    statusData: [],
    forecast: { today: 0, projected: 0, trend: '+0%', series: [] },
  })
  const [activeView, setActiveView] = useState(initialView)

  useEffect(() => {
    let mounted = true

    async function loadGps() {
      try {
        const [payload, analyticsRes] = await Promise.all([
          trackingApi.liveGps(),
          trackingApi.analytics('7d'),
        ])
        if (mounted) {
          setShipments(payload?.shipments ?? {})
          setAnalyticsPayload(
            analyticsRes ?? {
              deliveryTrends: [],
              statusData: [],
              forecast: { today: 0, projected: 0, trend: '+0%', series: [] },
            },
          )
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    loadGps()

    connectGpsSocket({
      onMessage: (event) => {
        if (event?.type === 'gps:update' && mounted) {
          setShipments(event.shipments ?? {})
        }
      },
    })

    return () => {
      mounted = false
      disconnectGpsSocket()
    }
  }, [])

  useEffect(() => {
    setActiveView(initialView)
  }, [initialView])

  const rows = useMemo(() => mapShipmentsToRows(shipments), [shipments])
  const inTransitCount = rows.filter((row) =>
    row.status.toLowerCase().includes('in transit'),
  ).length
  const delayedCount = rows.filter((row) =>
    row.status.toLowerCase().includes('delay'),
  ).length
  const stats = [
    { label: 'Vehicles Active', value: rows.length, trend: 'Live backend feed' },
    { label: 'On-Time Deliveries', value: `${Math.max(0, rows.length - delayedCount)}`, trend: 'Live count' },
    { label: 'Delayed Routes', value: delayedCount, trend: 'Live count' },
    { label: 'Fleet In Transit', value: inTransitCount, trend: 'Live count' },
    { label: 'Live GPS Pings', value: rows.length * 30, trend: 'Approx stream' },
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
      notifications={5}
    >
      {activeView === 'overview' && (
        <>
          <FleetMap shipments={shipments} />
          <section
            style={{ display: 'grid', gap: 12, gridTemplateColumns: '2fr 1fr', marginTop: 12 }}
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
              data={[
                { label: 'In Transit', value: inTransitCount, color: '#0ea5e9' },
                { label: 'Delayed', value: delayedCount, color: '#f97316' },
                {
                  label: 'Other',
                  value: Math.max(rows.length - inTransitCount - delayedCount, 0),
                  color: '#64748b',
                },
              ]}
            />
          </section>
        </>
      )}
      {activeView === 'map' && <GPSMap shipments={shipments} />}
      {activeView === 'analytics' && (
        <Analytics shipments={shipments} analyticsData={analyticsPayload} />
      )}
      {activeView === 'fleet' && <FleetManager shipments={shipments} />}
      {activeView === 'shipments' && <Shipments shipments={shipments} />}
    </DashboardLayout>
  )
}

export default TransporterDashboard
