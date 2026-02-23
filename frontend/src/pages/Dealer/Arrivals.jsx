import { useEffect, useState } from 'react'
import { dealerApi } from '../../api/axiosInstance'
import StatusDonut from '../../components/charts/StatusDonut'
import Table from '../../components/common/Table'
import Loader from '../../components/common/Loader'
import DashboardLayout from '../../components/layout/DashboardLayout'
import './dealer.css'

function Arrivals({ user, onLogout, onNavigate, currentPath }) {
  const [shipments, setShipments] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedShipment, setSelectedShipment] = useState(null)

  const stats = [
    { label: 'In Transit', value: 8, trend: 'Active shipments' },
    { label: 'Arriving Today', value: 3, trend: 'Expected' },
    { label: 'Delayed', value: 2, trend: 'Needs attention' },
    { label: 'Received (Month)', value: 47, trend: '+6 vs last month' },
  ]

  useEffect(() => {
    let mounted = true
    async function loadShipments() {
      try {
        const response = await dealerApi.arrivals()
        if (mounted) {
          setShipments(response.shipments || getMockShipments())
        }
      } catch (error) {
        console.error('Error loading shipments:', error)
        if (mounted) {
          setShipments(getMockShipments())
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    loadShipments()

    // Auto-refresh every 30 seconds
    const interval = setInterval(loadShipments, 30000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  const getMockShipments = () => [
    {
      id: 1,
      shipmentId: 'SHP-2024-001',
      orderId: 'DL-3321',
      manufacturer: 'ABC Pharma',
      carrier: 'FastTrack Logistics',
      origin: 'Mumbai, MH',
      destination: 'Bengaluru, KA',
      status: 'In Transit',
      estimatedArrival: '2026-02-17',
      currentLocation: 'Pune, MH',
      progress: 65,
      blockchainVerified: true,
      items: 50
    },
    {
      id: 2,
      shipmentId: 'SHP-2024-002',
      orderId: 'DL-3322',
      manufacturer: 'XYZ Medical',
      carrier: 'Swift Transport',
      origin: 'Delhi, DL',
      destination: 'Bengaluru, KA',
      status: 'Arriving Today',
      estimatedArrival: '2026-02-16',
      currentLocation: 'Bengaluru, KA',
      progress: 95,
      blockchainVerified: true,
      items: 30
    },
    {
      id: 3,
      shipmentId: 'SHP-2024-003',
      orderId: 'DL-3323',
      manufacturer: 'MediTech Inc',
      carrier: 'Express Cargo',
      origin: 'Hyderabad, TG',
      destination: 'Bengaluru, KA',
      status: 'Delayed',
      estimatedArrival: '2026-02-18',
      currentLocation: 'Hyderabad, TG',
      progress: 20,
      blockchainVerified: false,
      items: 75
    },
    {
      id: 4,
      shipmentId: 'SHP-2024-004',
      orderId: 'DL-3324',
      manufacturer: 'Global Health',
      carrier: 'Prime Movers',
      origin: 'Chennai, TN',
      destination: 'Bengaluru, KA',
      status: 'In Transit',
      estimatedArrival: '2026-02-17',
      currentLocation: 'Hosur, TN',
      progress: 80,
      blockchainVerified: true,
      items: 60
    },
  ]

  const filteredShipments = shipments.filter(shipment => {
    const matchesStatus = filterStatus === 'all' || shipment.status === filterStatus
    const matchesSearch = !searchTerm ||
      shipment.shipmentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shipment.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shipment.manufacturer.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesStatus && matchesSearch
  })

  const getStatusBadge = (status) => {
    const styles = {
      'In Transit': { bg: '#dbeafe', color: '#1e40af', icon: '🚚' },
      'Arriving Today': { bg: '#dcfce7', color: '#166534', icon: '📍' },
      'Delayed': { bg: '#fee2e2', color: '#991b1b', icon: '⚠️' },
      'Received': { bg: '#f3f4f6', color: '#4b5563', icon: '✅' }
    }
    const style = styles[status] || styles['In Transit']
    return (
      <span style={{
        padding: '4px 12px',
        borderRadius: 9999,
        fontSize: 12,
        fontWeight: 600,
        background: style.bg,
        color: style.color,
      }}>
        {style.icon} {status}
      </span>
    )
  }

  const shipmentStatusData = [
    { label: 'In Transit', value: shipments.filter(s => s.status === 'In Transit').length, color: '#3b82f6' },
    { label: 'Arriving Today', value: shipments.filter(s => s.status === 'Arriving Today').length, color: '#22c55e' },
    { label: 'Delayed', value: shipments.filter(s => s.status === 'Delayed').length, color: '#ef4444' },
  ]

  const shipmentRows = filteredShipments.map(shipment => ({
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
    route: `${shipment.origin} → ${shipment.destination}`,
    currentLocation: shipment.currentLocation,
    eta: new Date(shipment.estimatedArrival).toLocaleDateString(),
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
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 'bold', margin: 0 }}>Inbound Shipments</h2>
        <p style={{ color: '#6b7280', margin: '4px 0 0 0' }}>
          Track and manage incoming deliveries
        </p>
      </div>

      {/* Status Overview and Chart */}
      <section style={{ display: 'grid', gap: 24, gridTemplateColumns: '2fr 1fr', marginBottom: 24 }}>
        {/* Filters */}
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

        {/* Shipment Status Donut */}
        <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <StatusDonut
            data={shipmentStatusData}
            height={200}
          />
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {shipmentStatusData.map((item, index) => (
              <div key={index} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: item.color }}></div>
                  <span>{item.label}</span>
                </div>
                <span style={{ fontWeight: 600 }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Shipments Table */}
      <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <Table
          columns={[
            { key: 'shipmentId', label: 'Shipment ID' },
            { key: 'orderId', label: 'Order ID' },
            { key: 'manufacturer', label: 'Manufacturer' },
            { key: 'route', label: 'Route' },
            { key: 'currentLocation', label: 'Current Location' },
            { key: 'eta', label: 'ETA' },
            { key: 'status', label: 'Status' },
          ]}
          rows={shipmentRows}
          emptyMessage="No shipments found"
        />
      </div>

      {/* Shipment Details Modal */}
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
                ×
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Basic Info */}
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

              {/* Status and Progress */}
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
                  ></div>
                </div>
                <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0 0', textAlign: 'right' }}>
                  {selectedShipment.progress}% Complete
                </p>
              </div>

              {/* Route Information */}
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#374151', margin: '0 0 12px 0' }}>
                  Route Information
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: '#f9fafb', borderRadius: 8 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 4px 0' }}>Origin</p>
                    <p style={{ fontWeight: 600, margin: 0 }}>📍 {selectedShipment.origin}</p>
                  </div>
                  <div style={{ fontSize: 24, color: '#3b82f6' }}>→</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 4px 0' }}>Current Location</p>
                    <p style={{ fontWeight: 600, margin: 0 }}>🚚 {selectedShipment.currentLocation}</p>
                  </div>
                  <div style={{ fontSize: 24, color: '#3b82f6' }}>→</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 4px 0' }}>Destination</p>
                    <p style={{ fontWeight: 600, margin: 0 }}>🏁 {selectedShipment.destination}</p>
                  </div>
                </div>
              </div>

              {/* Details Grid */}
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
                  <p style={{ fontWeight: 600, margin: 0 }}>
                    {new Date(selectedShipment.estimatedArrival).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Blockchain Status */}
              <div>
                <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 4px 0' }}>Blockchain Verification</p>
                <span style={{
                  padding: '4px 12px',
                  borderRadius: 9999,
                  fontSize: 12,
                  fontWeight: 600,
                  background: selectedShipment.blockchainVerified ? '#dcfce7' : '#fee2e2',
                  color: selectedShipment.blockchainVerified ? '#166534' : '#991b1b',
                }}>
                  {selectedShipment.blockchainVerified ? '✓ Verified on Blockchain' : '✗ Not Verified'}
                </span>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 12, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
                {selectedShipment.status === 'Arriving Today' && (
                  <button
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      background: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: 8,
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Mark as Received
                  </button>
                )}
                <button
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Contact Carrier
                </button>
                <button
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    background: '#f3f4f6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: 8,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  View Order Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}

export default Arrivals
