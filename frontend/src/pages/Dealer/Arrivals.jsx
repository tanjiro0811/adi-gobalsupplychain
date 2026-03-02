import { useEffect, useMemo, useState } from 'react'
import { dealerApi } from '../../api/axiosInstance'
import { connectGpsSocket, disconnectGpsSocket } from '../../api/socket'
import StatusDonut from '../../components/charts/StatusDonut'
import Table from '../../components/common/Table'
import Loader from '../../components/common/Loader'
import DashboardLayout from '../../components/layout/DashboardLayout'
import './dealer.css'

const DEALER_LOCATION = {
  lat: 12.9716,
  lng: 77.5946,
}

function toNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const radius = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return radius * c
}

function progressByStatus(status) {
  if (status === 'Arriving Today') return 95
  if (status === 'Delayed') return 35
  if (status === 'Received') return 100
  return 70
}

function mapShipmentStatus(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized.includes('delay')) return 'Delayed'
  if (normalized.includes('arriv')) return 'Arriving Today'
  if (normalized.includes('receiv') || normalized.includes('deliver')) return 'Received'
  return 'In Transit'
}

function normalizeShipments(items = []) {
  return items.map((shipment, index) => {
    const status = mapShipmentStatus(shipment.status)
    const fallbackProgress = progressByStatus(status)

    const parsedProgress = Number(shipment.progress)
    const progress = Number.isFinite(parsedProgress)
      ? Math.max(0, Math.min(100, parsedProgress))
      : fallbackProgress

    return {
      id: shipment.id || index + 1,
      shipmentId: shipment.shipmentId || `SHP-${index + 1}`,
      orderId: shipment.orderId || `DL-${3300 + index + 1}`,
      manufacturer: shipment.manufacturer || 'Global Supply Manufacturer',
      carrier: shipment.carrier || 'Prime Logistics',
      origin: shipment.origin || 'Origin unavailable',
      destination: shipment.destination || 'Destination unavailable',
      status,
      estimatedArrival: shipment.estimatedArrival || shipment.eta || new Date().toISOString().slice(0, 10),
      currentLocation: shipment.currentLocation || `${shipment.lat ?? '--'}, ${shipment.lng ?? '--'}`,
      progress,
      blockchainVerified: shipment.blockchainVerified ?? shipment.verified ?? true,
      items: Number(shipment.items || shipment.quantity || 0),
      distanceKm: Number.isFinite(Number(shipment.distanceKm)) ? Number(shipment.distanceKm) : null,
      etaHours: Number.isFinite(Number(shipment.etaHours)) ? Number(shipment.etaHours) : null,
      dealerMessage: shipment.dealerMessage || 'Waiting for live GPS signal',
    }
  })
}

function mergeGpsIntoShipments(existing = [], gpsSnapshot = {}) {
  const mergedById = new Map(existing.map((shipment) => [shipment.shipmentId, shipment]))

  Object.entries(gpsSnapshot || {}).forEach(([shipmentId, gps]) => {
    const current = mergedById.get(shipmentId) || {
      id: existing.length + mergedById.size + 1,
      shipmentId,
      orderId: '--',
      manufacturer: 'Global Supply Manufacturer',
      carrier: 'Prime Logistics',
      origin: 'Unknown',
      destination: 'Unknown',
      status: 'In Transit',
      estimatedArrival: new Date().toISOString().slice(0, 10),
      currentLocation: 'Location unavailable',
      progress: 70,
      blockchainVerified: true,
      items: 0,
      distanceKm: null,
      etaHours: null,
      dealerMessage: 'Waiting for live GPS signal',
    }

    const lat = toNumber(gps?.lat)
    const lng = toNumber(gps?.lng)
    const hasGps = lat !== null && lng !== null
    const distanceKm = hasGps
      ? Number(haversineKm(lat, lng, DEALER_LOCATION.lat, DEALER_LOCATION.lng).toFixed(1))
      : current.distanceKm
    const etaHours = distanceKm !== null ? Number((distanceKm / 45).toFixed(1)) : current.etaHours
    const status = mapShipmentStatus(gps?.status || current.status)

    mergedById.set(shipmentId, {
      ...current,
      shipmentId,
      status,
      origin: gps?.origin || current.origin,
      destination: gps?.destination || current.destination,
      estimatedArrival: gps?.eta || current.estimatedArrival,
      currentLocation: hasGps ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : current.currentLocation,
      progress: progressByStatus(status),
      distanceKm,
      etaHours,
      dealerMessage:
        distanceKm !== null && etaHours !== null
          ? `Your shipment is ${distanceKm} km away, ETA ${etaHours} hours`
          : current.dealerMessage,
      lat: hasGps ? lat : current.lat,
      lng: hasGps ? lng : current.lng,
      vehicleNumber: gps?.vehicleNumber || current.vehicleNumber,
    })
  })

  return Array.from(mergedById.values())
}

function formatDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '--' : date.toLocaleDateString()
}

function Arrivals({ user, onLogout, onNavigate, currentPath }) {
  const [shipments, setShipments] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedShipment, setSelectedShipment] = useState(null)
  const [isSocketConnected, setIsSocketConnected] = useState(false)
  const [lastSocketUpdate, setLastSocketUpdate] = useState('')

  useEffect(() => {
    let mounted = true

    async function loadShipments() {
      try {
        const response = await dealerApi.arrivals()
        if (mounted) {
          setShipments(normalizeShipments(response?.shipments || []))
        }
      } catch (error) {
        console.error('Error loading shipments:', error)
        if (mounted) setShipments([])
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadShipments()
    const interval = setInterval(loadShipments, 30000)
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
      onMessage: (payload) => {
        if (!mounted || !payload || typeof payload !== 'object') {
          return
        }
        const gpsSnapshot = payload.shipments || {}
        setLastSocketUpdate(payload.generatedAt || new Date().toISOString())
        setShipments((current) => mergeGpsIntoShipments(current, gpsSnapshot))
      },
    })

    return () => {
      mounted = false
      clearInterval(interval)
      setIsSocketConnected(false)
      disconnectGpsSocket()
    }
  }, [])

  useEffect(() => {
    if (!selectedShipment) return
    const updated = shipments.find((item) => item.shipmentId === selectedShipment.shipmentId)
    if (updated && updated !== selectedShipment) {
      setSelectedShipment(updated)
    }
  }, [shipments, selectedShipment])

  const shipmentStatusData = useMemo(() => [
    { label: 'In Transit', value: shipments.filter((s) => s.status === 'In Transit').length, color: '#3b82f6' },
    { label: 'Arriving Today', value: shipments.filter((s) => s.status === 'Arriving Today').length, color: '#22c55e' },
    { label: 'Delayed', value: shipments.filter((s) => s.status === 'Delayed').length, color: '#ef4444' },
  ], [shipments])

  const stats = useMemo(() => {
    const received = shipments.filter((s) => s.status === 'Received').length
    return [
      { label: 'In Transit', value: shipmentStatusData[0].value, trend: isSocketConnected ? 'WebSocket live' : 'Polling' },
      { label: 'Arriving Today', value: shipmentStatusData[1].value, trend: 'Live ETA' },
      { label: 'Delayed', value: shipmentStatusData[2].value, trend: 'Needs attention' },
      { label: 'Received', value: received, trend: 'Completed' },
    ]
  }, [isSocketConnected, shipmentStatusData, shipments])

  const filteredShipments = useMemo(() => {
    return shipments.filter((shipment) => {
      const matchesStatus = filterStatus === 'all' || shipment.status === filterStatus
      const target = `${shipment.shipmentId} ${shipment.orderId} ${shipment.manufacturer}`.toLowerCase()
      const matchesSearch = !searchTerm || target.includes(searchTerm.toLowerCase())
      return matchesStatus && matchesSearch
    })
  }, [shipments, filterStatus, searchTerm])

  const getStatusBadge = (status) => {
    const styles = {
      'In Transit': { bg: '#dbeafe', color: '#1e40af' },
      'Arriving Today': { bg: '#dcfce7', color: '#166534' },
      Delayed: { bg: '#fee2e2', color: '#991b1b' },
      Received: { bg: '#f3f4f6', color: '#4b5563' },
    }

    const style = styles[status] || styles['In Transit']
    return (
      <span
        style={{
          padding: '4px 12px',
          borderRadius: 9999,
          fontSize: 12,
          fontWeight: 600,
          background: style.bg,
          color: style.color,
        }}
      >
        {status}
      </span>
    )
  }

  const shipmentRows = filteredShipments.map((shipment) => ({
    shipmentId: (
      <span
        style={{ fontWeight: 600, color: '#3b82f6', cursor: 'pointer' }}
        onClick={() => setSelectedShipment(shipment)}
      >
        {shipment.shipmentId}
      </span>
    ),
    orderId: shipment.orderId,
    manufacturer: shipment.manufacturer,
    route: `${shipment.origin} -> ${shipment.destination}`,
    currentLocation: shipment.currentLocation,
    dealerEta:
      shipment.distanceKm !== null && shipment.etaHours !== null
        ? `${shipment.distanceKm} km | ETA ${shipment.etaHours}h`
        : 'GPS pending',
    eta: formatDate(shipment.estimatedArrival),
    status: getStatusBadge(shipment.status),
  }))

  if (loading) {
    return (
      <DashboardLayout
        role="Dealer"
        themeClass="dealer-theme"
        userName={user?.name}
        onLogout={onLogout}
        onNavigate={onNavigate}
        currentPath={currentPath}
        stats={stats}
      >
        <Loader label="Loading shipments..." />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout
      role="Dealer"
      themeClass="dealer-theme"
      userName={user?.name}
      onLogout={onLogout}
      onNavigate={onNavigate}
      currentPath={currentPath}
      stats={stats}
    >
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 'bold', margin: 0 }}>Inbound Shipments</h2>
        <p style={{ color: '#6b7280', margin: '4px 0 0 0' }}>
          Track and manage incoming deliveries. GPS stream: {isSocketConnected ? 'Connected' : 'Reconnecting'} | Last ping:{' '}
          {lastSocketUpdate ? new Date(lastSocketUpdate).toLocaleTimeString() : '--'}
        </p>
      </div>

      <section style={{ display: 'grid', gap: 24, gridTemplateColumns: '2fr 1fr', marginBottom: 24 }}>
        <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
                Search Shipments
              </label>
              <input
                type="text"
                placeholder="Search by Shipment ID, Order ID, or Manufacturer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  fontSize: 14,
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
                Filter Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  fontSize: 14,
                }}
              >
                <option value="all">All Status</option>
                <option value="In Transit">In Transit</option>
                <option value="Arriving Today">Arriving Today</option>
                <option value="Delayed">Delayed</option>
                <option value="Received">Received</option>
              </select>
            </div>
          </div>
          <p style={{ fontSize: 14, color: '#6b7280', margin: '16px 0 0 0' }}>
            Showing {filteredShipments.length} of {shipments.length} shipments
          </p>
        </div>

        <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <StatusDonut data={shipmentStatusData} height={200} />
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {shipmentStatusData.map((item) => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: item.color }} />
                  <span>{item.label}</span>
                </div>
                <span style={{ fontWeight: 600 }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <Table
          columns={[
            { key: 'shipmentId', label: 'Shipment ID' },
            { key: 'orderId', label: 'Order ID' },
            { key: 'manufacturer', label: 'Manufacturer' },
            { key: 'route', label: 'Route' },
            { key: 'currentLocation', label: 'Current Location' },
            { key: 'dealerEta', label: 'Dealer ETA' },
            { key: 'eta', label: 'ETA' },
            { key: 'status', label: 'Status' },
          ]}
          rows={shipmentRows}
          emptyMessage="No shipments found"
        />
      </div>

      {selectedShipment && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
          onClick={() => setSelectedShipment(null)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: 12,
              padding: 24,
              maxWidth: 700,
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 20, fontWeight: 'bold', margin: 0 }}>Shipment Tracking</h3>
              <button
                onClick={() => setSelectedShipment(null)}
                style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer' }}
              >
                x
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 4px 0' }}>Shipment ID</p>
                  <p style={{ fontWeight: 600, fontSize: 16, margin: 0 }}>{selectedShipment.shipmentId}</p>
                </div>
                <div>
                  <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 4px 0' }}>Order ID</p>
                  <p style={{ fontWeight: 600, fontSize: 16, margin: 0 }}>{selectedShipment.orderId}</p>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 14, color: '#6b7280' }}>Status</span>
                  {getStatusBadge(selectedShipment.status)}
                </div>
                <div style={{ width: '100%', height: 8, background: '#e5e7eb', borderRadius: 9999, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${selectedShipment.progress}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                      borderRadius: 9999,
                      transition: 'width 0.5s ease',
                    }}
                  />
                </div>
                <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0 0', textAlign: 'right' }}>
                  {selectedShipment.progress}% Complete
                </p>
              </div>

              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#374151', margin: '0 0 12px 0' }}>
                  Route Information
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: '#f9fafb', borderRadius: 8 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 4px 0' }}>Origin</p>
                    <p style={{ fontWeight: 600, margin: 0 }}>{selectedShipment.origin}</p>
                  </div>
                  <div style={{ fontSize: 24, color: '#3b82f6' }}>-&gt;</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 4px 0' }}>Current Location</p>
                    <p style={{ fontWeight: 600, margin: 0 }}>{selectedShipment.currentLocation}</p>
                  </div>
                  <div style={{ fontSize: 24, color: '#3b82f6' }}>-&gt;</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 4px 0' }}>Destination</p>
                    <p style={{ fontWeight: 600, margin: 0 }}>{selectedShipment.destination}</p>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 4px 0' }}>Manufacturer</p>
                  <p style={{ fontWeight: 600, margin: 0 }}>{selectedShipment.manufacturer}</p>
                </div>
                <div>
                  <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 4px 0' }}>Carrier</p>
                  <p style={{ fontWeight: 600, margin: 0 }}>{selectedShipment.carrier}</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 4px 0' }}>Items</p>
                  <p style={{ fontWeight: 600, margin: 0 }}>{selectedShipment.items} units</p>
                </div>
                <div>
                  <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 4px 0' }}>Estimated Arrival</p>
                  <p style={{ fontWeight: 600, margin: 0 }}>{formatDate(selectedShipment.estimatedArrival)}</p>
                </div>
              </div>

              <div>
                <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 4px 0' }}>Blockchain Verification</p>
                <span
                  style={{
                    padding: '4px 12px',
                    borderRadius: 9999,
                    fontSize: 12,
                    fontWeight: 600,
                    background: selectedShipment.blockchainVerified ? '#dcfce7' : '#fee2e2',
                    color: selectedShipment.blockchainVerified ? '#166534' : '#991b1b',
                  }}
                >
                  {selectedShipment.blockchainVerified ? 'Verified on Blockchain' : 'Not Verified'}
                </span>
              </div>

              <div
                style={{
                  padding: 12,
                  background: '#eff6ff',
                  borderRadius: 8,
                  border: '1px solid #bfdbfe',
                }}
              >
                <p style={{ margin: 0, color: '#1e3a8a', fontWeight: 600 }}>Dealer Live ETA</p>
                <p style={{ margin: '4px 0 0 0', color: '#1e40af', fontSize: 14 }}>
                  {selectedShipment.dealerMessage}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}

export default Arrivals

