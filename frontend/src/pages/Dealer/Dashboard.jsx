import { useEffect, useState } from 'react'
import { dealerApi } from '../../api/axiosInstance'
import PieChart from '../../components/charts/PieChart'
import AreaChart from '../../components/charts/AreaChart'
import Table from '../../components/common/Table'
import Loader from '../../components/common/Loader'
import DashboardLayout from '../../components/layout/DashboardLayout'

import './dealer.css'

function DealerDashboard({ user, onLogout, onNavigate, currentPath }) {
  const [loading, setLoading] = useState(true)
  const stats = [
    { label: 'Wholesale Orders', value: 88, trend: '+9%' },
    { label: 'Inbound Loads', value: 13, trend: '+3' },
    { label: 'Payment Pending', value: 7, trend: '-2' },
    { label: 'Fast-moving SKUs', value: 19, trend: '+4' },
    { label: 'Avg Margin', value: '14.2%', trend: '+0.8%' },
  ]

  const [recentOrders, setRecentOrders] = useState([])
  const [orderTrends, setOrderTrends] = useState([])
  const [lowStock, setLowStock] = useState([])
  const [activeView, setActiveView] = useState('overview')

  useEffect(() => {
    let mounted = true
    async function loadDealerData() {
      try {
        const [ordersRes, trendsRes, stockRes] = await Promise.all([
          dealerApi.recentOrders(),
          dealerApi.orderTrends(),
          dealerApi.lowStockAlerts(),
        ])
        if (mounted) {
          setRecentOrders(ordersRes.orders || getMockOrders())
          setOrderTrends(trendsRes.trends || [42, 38, 45, 52, 49, 58, 63])
          setLowStock(stockRes.items || [])
        }
      } catch (error) {
        console.error('Error loading dealer data:', error)
        if (mounted) {
          setRecentOrders(getMockOrders())
          setOrderTrends([42, 38, 45, 52, 49, 58, 63])
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    loadDealerData()
    return () => { mounted = false }
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

  const getMockOrders = () => [
    { orderId: 'DL-3321', retailer: 'Nova Med', amount: '$2,460', status: 'Dispatched', date: '2026-02-15' },
    { orderId: 'DL-3322', retailer: 'CareHub', amount: '$1,810', status: 'Pending', date: '2026-02-14' },
    { orderId: 'DL-3323', retailer: 'Prime Labs', amount: '$4,105', status: 'Delivered', date: '2026-02-13' },
    { orderId: 'DL-3324', retailer: 'HealthFirst', amount: '$3,250', status: 'Dispatched', date: '2026-02-12' },
    { orderId: 'DL-3325', retailer: 'MediCare Plus', amount: '$1,980', status: 'Pending', date: '2026-02-11' },
  ]

  const getStatusBadge = (status) => {
    const styles = {
      Delivered: { bg: '#dcfce7', color: '#166534' },
      Dispatched: { bg: '#dbeafe', color: '#1e40af' },
      Pending: { bg: '#fef3c7', color: '#92400e' },
    }
    const style = styles[status] || styles.Pending
    return (
      <span style={{
        padding: '4px 12px',
        borderRadius: 9999,
        fontSize: 12,
        fontWeight: 600,
        background: style.bg,
        color: style.color,
      }}>
        {status}
      </span>
    )
  }

  const orderRows = recentOrders.map(order => ({
    orderId: <span style={{ fontWeight: 600, color: '#3b82f6' }}>{order.orderId}</span>,
    retailer: order.retailer,
    amount: <span style={{ fontWeight: 600 }}>{order.amount}</span>,
    date: new Date(order.date).toLocaleDateString(),
    status: getStatusBadge(order.status),
  }))

  const navigateTo = (path, event) => {
    if (event?.preventDefault) {
      event.preventDefault()
    }

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
      {/* Navigation Tabs */}
      <div className="dealer-tabs">
        <button
          type="button"
          className={`dealer-tab ${activeView === 'overview' ? 'active' : ''}`}
          onClick={() => handleViewChange('overview')}
        >
          Overview
        </button>
        <button
          type="button"
          className={`dealer-tab ${activeView === 'orders' ? 'active' : ''}`}
          onClick={() => handleViewChange('orders')}
        >
          Orders
        </button>
        <button
          type="button"
          className={`dealer-tab ${activeView === 'arrivals' ? 'active' : ''}`}
          onClick={() => handleViewChange('arrivals')}
        >
          Arrivals
        </button>
        <button
          type="button"
          className={`dealer-tab ${activeView === 'inventory' ? 'active' : ''}`}
          onClick={() => handleViewChange('inventory')}
        >
          Inventory
        </button>
        <button
          type="button"
          className={`dealer-tab ${activeView === 'analytics' ? 'active' : ''}`}
          onClick={() => handleViewChange('analytics')}
        >
          Analytics
        </button>
      </div>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 'bold', margin: 0 }}>Dealer Dashboard</h2>
        <p style={{ color: '#6b7280', margin: '4px 0 0 0' }}>
          Manage wholesale orders and inventory
        </p>
      </div>

      {/* Main Grid */}
      <section style={{ display: 'grid', gap: 24, gridTemplateColumns: '2fr 1fr', marginBottom: 24 }}>
        {/* Recent Orders Table */}
        <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Recent Wholesale Orders</h3>
            <a
              href="/dealer/orders"
              onClick={(event) => navigateTo('/dealer/orders', event)}
              style={{ fontSize: 14, color: '#3b82f6', textDecoration: 'none' }}
            >
              View All →
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

        {/* Order Status Pie Chart */}
        <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <PieChart
            title="Order Status"
            data={[
              { label: 'Delivered', value: 45, color: '#22c55e' },
              { label: 'Dispatched', value: 30, color: '#0ea5e9' },
              { label: 'Pending', value: 13, color: '#f59e0b' },
            ]}
          />
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Delivered', value: 45, color: '#22c55e' },
              { label: 'Dispatched', value: 30, color: '#0ea5e9' },
              { label: 'Pending', value: 13, color: '#f59e0b' },
            ].map((item, index) => (
              <div key={index} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: item.color }}></div>
                  <span>{item.label}</span>
                </div>
                <span style={{ fontWeight: 600 }}>{item.value} orders</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Order Trends and Quick Actions */}
      <section style={{ display: 'grid', gap: 24, gridTemplateColumns: '2fr 1fr', marginBottom: 24 }}>
        {/* Order Trends Chart */}
        <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Order Trends (Last 7 Days)</h3>
          <AreaChart
            title="Daily Orders"
            data={orderTrends}
            height={200}
          />
        </div>

        {/* Quick Actions */}
        <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Quick Actions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <a
              href="/dealer/orders"
              onClick={(event) => navigateTo('/dealer/orders', event)}
              style={{
                padding: '12px 16px',
                background: '#3b82f6',
                color: 'white',
                borderRadius: 8,
                textDecoration: 'none',
                textAlign: 'center',
                fontWeight: 500,
                fontSize: 14,
              }}
            >
              📦 New Wholesale Order
            </a>
            <a
              href="/dealer/arrivals"
              onClick={(event) => navigateTo('/dealer/arrivals', event)}
              style={{
                padding: '12px 16px',
                background: '#10b981',
                color: 'white',
                borderRadius: 8,
                textDecoration: 'none',
                textAlign: 'center',
                fontWeight: 500,
                fontSize: 14,
              }}
            >
              🚚 Track Shipments
            </a>
            <a
              href="/dealer/inventory"
              onClick={(event) => navigateTo('/dealer/inventory', event)}
              style={{
                padding: '12px 16px',
                background: '#f59e0b',
                color: 'white',
                borderRadius: 8,
                textDecoration: 'none',
                textAlign: 'center',
                fontWeight: 500,
                fontSize: 14,
              }}
            >
              📊 Check Inventory
            </a>
            <a
              href="/dealer/analytics"
              onClick={(event) => navigateTo('/dealer/analytics', event)}
              style={{
                padding: '12px 16px',
                background: '#8b5cf6',
                color: 'white',
                borderRadius: 8,
                textDecoration: 'none',
                textAlign: 'center',
                fontWeight: 500,
                fontSize: 14,
              }}
            >
              📈 View Analytics
            </a>
          </div>
        </div>
      </section>

      {/* Low Stock Alerts */}
      {lowStock.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'start', gap: 12 }}>
              <span style={{ fontSize: 24 }}>⚠️</span>
              <div>
                <h4 style={{ margin: '0 0 4px 0', color: '#92400e', fontWeight: 600 }}>
                  Low Stock Alert
                </h4>
                <p style={{ margin: 0, fontSize: 14, color: '#78350f' }}>
                  {lowStock.length} items are running low. Consider restocking soon.
                </p>
                <a
                  href="/dealer/inventory"
                  onClick={(event) => navigateTo('/dealer/inventory', event)}
                  style={{ fontSize: 14, color: '#f59e0b', fontWeight: 500, marginTop: 8, display: 'inline-block' }}
                >
                  View Inventory →
                </a>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Inbound Shipments Preview */}
      <section>
        <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Inbound Shipments</h3>
            <a
              href="/dealer/arrivals"
              onClick={(event) => navigateTo('/dealer/arrivals', event)}
              style={{ fontSize: 14, color: '#3b82f6', textDecoration: 'none' }}
            >
              Track All →
            </a>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div style={{ padding: 16, background: '#dbeafe', borderRadius: 8 }}>
              <p style={{ fontSize: 24, fontWeight: 'bold', color: '#1e40af', margin: 0 }}>5</p>
              <p style={{ fontSize: 14, color: '#1e3a8a', margin: '4px 0 0 0' }}>In Transit</p>
            </div>
            <div style={{ padding: 16, background: '#dcfce7', borderRadius: 8 }}>
              <p style={{ fontSize: 24, fontWeight: 'bold', color: '#166534', margin: 0 }}>3</p>
              <p style={{ fontSize: 14, color: '#14532d', margin: '4px 0 0 0' }}>Arriving Today</p>
            </div>
            <div style={{ padding: 16, background: '#fef3c7', borderRadius: 8 }}>
              <p style={{ fontSize: 24, fontWeight: 'bold', color: '#92400e', margin: 0 }}>2</p>
              <p style={{ fontSize: 14, color: '#78350f', margin: '4px 0 0 0' }}>Delayed</p>
            </div>
          </div>
        </div>
      </section>
    </DashboardLayout>
  )
}

export default DealerDashboard
