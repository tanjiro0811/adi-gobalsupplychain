import { useEffect, useMemo, useState } from 'react'
import { dealerApi } from '../../api/axiosInstance'
import PieChart from '../../components/charts/PieChart'
import AreaChart from '../../components/charts/AreaChart'
import Table from '../../components/common/Table'
import Loader from '../../components/common/Loader'
import DashboardLayout from '../../components/layout/DashboardLayout'

import './dealer.css'

function parseCurrency(value) {
  const parsed = Number(String(value || '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function formatCurrency(value) {
  return `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function mapOrderStatus(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized.includes('deliver')) return 'Delivered'
  if (normalized.includes('dispatch') || normalized.includes('transit')) return 'Dispatched'
  return 'Pending'
}

function mapShipmentStatus(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized.includes('delay')) return 'Delayed'
  if (normalized.includes('arriv')) return 'Arriving Today'
  if (normalized.includes('receiv') || normalized.includes('deliver')) return 'Received'
  return 'In Transit'
}

function normalizeOrders(items = []) {
  return items.map((order, index) => ({
    orderId: order.orderId || `DL-${3300 + index + 1}`,
    retailer: order.retailer || 'Retail Partner',
    amount: formatCurrency(parseCurrency(order.amount)),
    amountValue: parseCurrency(order.amount),
    status: mapOrderStatus(order.status),
    date: order.date || new Date().toISOString().slice(0, 10),
  }))
}

function normalizeShipments(items = []) {
  return items.map((shipment, index) => ({
    shipmentId: shipment.shipmentId || `SHP-${index + 1}`,
    status: mapShipmentStatus(shipment.status),
  }))
}

function DealerDashboard({ user, onLogout, onNavigate, currentPath }) {
  const [loading, setLoading] = useState(true)
  const [recentOrders, setRecentOrders] = useState([])
  const [orderTrends, setOrderTrends] = useState([])
  const [lowStock, setLowStock] = useState([])
  const [inboundShipments, setInboundShipments] = useState([])
  const [reorderItems, setReorderItems] = useState([])
  const [activeView, setActiveView] = useState('overview')

  useEffect(() => {
    let mounted = true

    async function loadDealerData() {
      try {
        const [ordersRes, trendsRes, stockRes, arrivalsRes, reorderRes] = await Promise.all([
          dealerApi.recentOrders(),
          dealerApi.orderTrends(),
          dealerApi.lowStockAlerts(),
          dealerApi.arrivals(),
          dealerApi.reorderRecommendations(30),
        ])

        if (mounted) {
          setRecentOrders(normalizeOrders(ordersRes?.orders || []))
          setOrderTrends(Array.isArray(trendsRes?.trends) ? trendsRes.trends : [])
          setLowStock(Array.isArray(stockRes?.items) ? stockRes.items : [])
          setInboundShipments(normalizeShipments(arrivalsRes?.shipments || []))
          setReorderItems(Array.isArray(reorderRes?.items) ? reorderRes.items : [])
        }
      } catch (error) {
        console.error('Error loading dealer data:', error)
        if (mounted) {
          setRecentOrders([])
          setOrderTrends([])
          setLowStock([])
          setInboundShipments([])
          setReorderItems([])
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadDealerData()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const pathViewMap = {
      '/dealer': 'overview',
      '/dealer/dashboard': 'overview',
      '/dealer/orders': 'orders',
      '/dealer/arrivals': 'arrivals',
      '/dealer/inventory': 'inventory',
      '/dealer/analytics': 'analytics',
    }
    setActiveView(pathViewMap[currentPath] ?? 'overview')
  }, [currentPath])

  const orderStatusData = useMemo(() => [
    { label: 'Delivered', value: recentOrders.filter((o) => o.status === 'Delivered').length, color: '#22c55e' },
    { label: 'Dispatched', value: recentOrders.filter((o) => o.status === 'Dispatched').length, color: '#0ea5e9' },
    { label: 'Pending', value: recentOrders.filter((o) => o.status === 'Pending').length, color: '#f59e0b' },
  ], [recentOrders])

  const shipmentSummary = useMemo(() => ({
    inTransit: inboundShipments.filter((s) => s.status === 'In Transit').length,
    arrivingToday: inboundShipments.filter((s) => s.status === 'Arriving Today').length,
    delayed: inboundShipments.filter((s) => s.status === 'Delayed').length,
  }), [inboundShipments])

  const stats = useMemo(() => {
    const totalAmount = recentOrders.reduce((sum, order) => sum + order.amountValue, 0)
    const avgOrderValue = recentOrders.length ? totalAmount / recentOrders.length : 0

    return [
      { label: 'Wholesale Orders', value: recentOrders.length, trend: 'Live' },
      { label: 'Inbound Loads', value: inboundShipments.length, trend: 'Live' },
      { label: 'Payment Pending', value: orderStatusData[2].value, trend: 'Live' },
      { label: 'Low Stock Alerts', value: lowStock.length, trend: 'Live' },
      { label: 'AI Reorder Urgent', value: reorderItems.filter((item) => item.priority === 'high').length, trend: 'Runs out <5d' },
      { label: 'Avg Order Value', value: formatCurrency(avgOrderValue), trend: 'Live' },
    ]
  }, [recentOrders, inboundShipments, orderStatusData, lowStock, reorderItems])

  const getStatusBadge = (status) => {
    const styles = {
      Delivered: { bg: '#dcfce7', color: '#166534' },
      Dispatched: { bg: '#dbeafe', color: '#1e40af' },
      Pending: { bg: '#fef3c7', color: '#92400e' },
    }

    const style = styles[status] || styles.Pending
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

  const orderRows = recentOrders.map((order) => ({
    orderId: <span style={{ fontWeight: 600, color: '#3b82f6' }}>{order.orderId}</span>,
    retailer: order.retailer,
    amount: <span style={{ fontWeight: 600 }}>{order.amount}</span>,
    date: new Date(order.date).toLocaleDateString(),
    status: getStatusBadge(order.status),
  }))

  const navigateTo = (path, event) => {
    if (event?.preventDefault) event.preventDefault()

    if (onNavigate) {
      onNavigate(path)
      return
    }

    if (typeof window !== 'undefined') {
      window.location.href = path
    }
  }

  const viewPathMap = {
    overview: '/dealer/dashboard',
    orders: '/dealer/orders',
    arrivals: '/dealer/arrivals',
    inventory: '/dealer/inventory',
    analytics: '/dealer/analytics',
  }

  const handleViewChange = (view) => {
    setActiveView(view)
    navigateTo(viewPathMap[view] ?? '/dealer/dashboard')
  }

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
        notifications={1}
      >
        <Loader label="Loading dealer dashboard..." />
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
      notifications={1}
    >
      <div className="dealer-tabs">
        <button type="button" className={`dealer-tab ${activeView === 'overview' ? 'active' : ''}`} onClick={() => handleViewChange('overview')}>
          Overview
        </button>
        <button type="button" className={`dealer-tab ${activeView === 'orders' ? 'active' : ''}`} onClick={() => handleViewChange('orders')}>
          Orders
        </button>
        <button type="button" className={`dealer-tab ${activeView === 'arrivals' ? 'active' : ''}`} onClick={() => handleViewChange('arrivals')}>
          Arrivals
        </button>
        <button type="button" className={`dealer-tab ${activeView === 'inventory' ? 'active' : ''}`} onClick={() => handleViewChange('inventory')}>
          Inventory
        </button>
        <button type="button" className={`dealer-tab ${activeView === 'analytics' ? 'active' : ''}`} onClick={() => handleViewChange('analytics')}>
          Analytics
        </button>
      </div>

      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 'bold', margin: 0 }}>Dealer Dashboard</h2>
        <p style={{ color: '#6b7280', margin: '4px 0 0 0' }}>Manage wholesale orders and inventory</p>
      </div>

      <section style={{ display: 'grid', gap: 24, gridTemplateColumns: '2fr 1fr', marginBottom: 24 }}>
        <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Recent Wholesale Orders</h3>
            <a href="/dealer/orders" onClick={(event) => navigateTo('/dealer/orders', event)} style={{ fontSize: 14, color: '#3b82f6', textDecoration: 'none' }}>
              View All -&gt;
            </a>
          </div>
          <Table
            columns={[
              { key: 'orderId', label: 'Order ID' },
              { key: 'retailer', label: 'Retailer' },
              { key: 'amount', label: 'Amount' },
              { key: 'date', label: 'Date' },
              { key: 'status', label: 'Status' },
            ]}
            rows={orderRows}
            emptyMessage="No wholesale orders"
          />
        </div>

        <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <PieChart title="Order Status" data={orderStatusData} />
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {orderStatusData.map((item) => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: item.color }} />
                  <span>{item.label}</span>
                </div>
                <span style={{ fontWeight: 600 }}>{item.value} orders</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gap: 24, gridTemplateColumns: '2fr 1fr', marginBottom: 24 }}>
        <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Order Trends (Last 7 Days)</h3>
          <AreaChart title="Daily Orders" data={orderTrends} height={200} />
        </div>

        <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Quick Actions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <a href="/dealer/orders" onClick={(event) => navigateTo('/dealer/orders', event)} style={{ padding: '12px 16px', background: '#3b82f6', color: 'white', borderRadius: 8, textDecoration: 'none', textAlign: 'center', fontWeight: 500, fontSize: 14 }}>
              New Wholesale Order
            </a>
            <a href="/dealer/arrivals" onClick={(event) => navigateTo('/dealer/arrivals', event)} style={{ padding: '12px 16px', background: '#10b981', color: 'white', borderRadius: 8, textDecoration: 'none', textAlign: 'center', fontWeight: 500, fontSize: 14 }}>
              Track Shipments
            </a>
            <a href="/dealer/inventory" onClick={(event) => navigateTo('/dealer/inventory', event)} style={{ padding: '12px 16px', background: '#f59e0b', color: 'white', borderRadius: 8, textDecoration: 'none', textAlign: 'center', fontWeight: 500, fontSize: 14 }}>
              Check Inventory
            </a>
            <a href="/dealer/analytics" onClick={(event) => navigateTo('/dealer/analytics', event)} style={{ padding: '12px 16px', background: '#8b5cf6', color: 'white', borderRadius: 8, textDecoration: 'none', textAlign: 'center', fontWeight: 500, fontSize: 14 }}>
              View Analytics
            </a>
          </div>
        </div>
      </section>

      {lowStock.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'start', gap: 12 }}>
              <div>
                <h4 style={{ margin: '0 0 4px 0', color: '#92400e', fontWeight: 600 }}>Low Stock Alert</h4>
                <p style={{ margin: 0, fontSize: 14, color: '#78350f' }}>
                  {lowStock.length} items are running low. Consider restocking soon.
                </p>
                <a href="/dealer/inventory" onClick={(event) => navigateTo('/dealer/inventory', event)} style={{ fontSize: 14, color: '#f59e0b', fontWeight: 500, marginTop: 8, display: 'inline-block' }}>
                  View Inventory -&gt;
                </a>
              </div>
            </div>
          </div>
        </section>
      )}

      {reorderItems.some((item) => item.priority === 'high') && (
        <section style={{ marginBottom: 24 }}>
          <div style={{ background: '#fee2e2', border: '1px solid #ef4444', borderRadius: 12, padding: 16 }}>
            <h4 style={{ margin: '0 0 4px 0', color: '#991b1b', fontWeight: 700 }}>AI Reorder Signal</h4>
            <p style={{ margin: 0, color: '#7f1d1d', fontSize: 14 }}>
              {reorderItems.find((item) => item.priority === 'high')?.recommendation || 'Stock depletion predicted. Reorder now.'}
            </p>
          </div>
        </section>
      )}

      <section>
        <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Inbound Shipments</h3>
            <a href="/dealer/arrivals" onClick={(event) => navigateTo('/dealer/arrivals', event)} style={{ fontSize: 14, color: '#3b82f6', textDecoration: 'none' }}>
              Track All -&gt;
            </a>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div style={{ padding: 16, background: '#dbeafe', borderRadius: 8 }}>
              <p style={{ fontSize: 24, fontWeight: 'bold', color: '#1e40af', margin: 0 }}>{shipmentSummary.inTransit}</p>
              <p style={{ fontSize: 14, color: '#1e3a8a', margin: '4px 0 0 0' }}>In Transit</p>
            </div>
            <div style={{ padding: 16, background: '#dcfce7', borderRadius: 8 }}>
              <p style={{ fontSize: 24, fontWeight: 'bold', color: '#166534', margin: 0 }}>{shipmentSummary.arrivingToday}</p>
              <p style={{ fontSize: 14, color: '#14532d', margin: '4px 0 0 0' }}>Arriving Today</p>
            </div>
            <div style={{ padding: 16, background: '#fef3c7', borderRadius: 8 }}>
              <p style={{ fontSize: 24, fontWeight: 'bold', color: '#92400e', margin: 0 }}>{shipmentSummary.delayed}</p>
              <p style={{ fontSize: 14, color: '#78350f', margin: '4px 0 0 0' }}>Delayed</p>
            </div>
          </div>
        </div>
      </section>
    </DashboardLayout>
  )
}

export default DealerDashboard
