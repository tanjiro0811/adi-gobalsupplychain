import { useEffect, useState } from 'react'
import { dealerApi } from '../../api/axiosInstance'
import AreaChart from '../../components/charts/AreaChart'
import PieChart from '../../components/charts/PieChart'
import StatusDonut from '../../components/charts/StatusDonut'
import Loader from '../../components/common/Loader'
import DashboardLayout from '../../components/layout/DashboardLayout'
import './dealer.css'

function generateMockRevenueForRange(range) {
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90
  return Array.from({ length: days }, () => 1200 + Math.random() * 800)
}

function Analytics({ user, onLogout, onNavigate, currentPath }) {
  const [timeRange, setTimeRange] = useState('30d')
  const [loading, setLoading] = useState(true)
  const [analyticsData, setAnalyticsData] = useState({
    revenue: [],
    topProducts: [],
    orderStatus: [],
    categoryMix: []
  })

  const stats = [
    { label: 'Revenue (Month)', value: '$48.2K', trend: '+18%' },
    { label: 'Orders', value: 156, trend: '+12' },
    { label: 'Avg Order Value', value: '$2,840', trend: '+5%' },
    { label: 'Profit Margin', value: '14.2%', trend: '+0.8%' },
  ]

  useEffect(() => {
    let mounted = true
    async function fetchAnalytics() {
      setLoading(true)
      try {
        const response = await dealerApi.analytics(timeRange)
        if (mounted) {
          setAnalyticsData({
            revenue: response.revenue || generateMockRevenueForRange(timeRange),
            topProducts: response.topProducts || [
              { label: 'Medicines', value: 42, color: '#3b82f6' },
              { label: 'Surgical Supplies', value: 28, color: '#10b981' },
              { label: 'Lab Equipment', value: 18, color: '#f59e0b' },
              { label: 'Medical Devices', value: 12, color: '#8b5cf6' }
            ],
            orderStatus: response.orderStatus || [
              { label: 'Delivered', value: 45, color: '#22c55e' },
              { label: 'Dispatched', value: 30, color: '#0ea5e9' },
              { label: 'Pending', value: 13, color: '#f59e0b' }
            ],
            categoryMix: response.categoryMix || [
              { label: 'Medicines', value: 42, color: '#3b82f6' },
              { label: 'Surgical', value: 28, color: '#10b981' },
              { label: 'Equipment', value: 18, color: '#f59e0b' },
              { label: 'Devices', value: 12, color: '#8b5cf6' }
            ]
          })
        }
      } catch (error) {
        console.error('Error fetching analytics:', error)
        if (mounted) {
          setAnalyticsData({
            revenue: generateMockRevenueForRange(timeRange),
            topProducts: [
              { label: 'Medicines', value: 42, color: '#3b82f6' },
              { label: 'Surgical Supplies', value: 28, color: '#10b981' },
              { label: 'Lab Equipment', value: 18, color: '#f59e0b' },
              { label: 'Medical Devices', value: 12, color: '#8b5cf6' }
            ],
            orderStatus: [
              { label: 'Delivered', value: 45, color: '#22c55e' },
              { label: 'Dispatched', value: 30, color: '#0ea5e9' },
              { label: 'Pending', value: 13, color: '#f59e0b' }
            ],
            categoryMix: [
              { label: 'Medicines', value: 42, color: '#3b82f6' },
              { label: 'Surgical', value: 28, color: '#10b981' },
              { label: 'Equipment', value: 18, color: '#f59e0b' },
              { label: 'Devices', value: 12, color: '#8b5cf6' }
            ]
          })
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetchAnalytics()
    return () => { mounted = false }
  }, [timeRange])

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
        <Loader label="Loading analytics..." />
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
      {/* Header with Time Range Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 'bold', margin: 0 }}>Sales Analytics</h2>
          <p style={{ color: '#6b7280', margin: '4px 0 0 0' }}>Track your wholesale business performance</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['7d', '30d', '90d'].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                fontWeight: 500,
                cursor: 'pointer',
                background: timeRange === range ? '#3b82f6' : '#f3f4f6',
                color: timeRange === range ? 'white' : '#374151',
                transition: 'all 0.2s'
              }}
            >
              {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Revenue Trend Chart */}
      <section style={{ marginBottom: 24 }}>
        <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Revenue Trend</h3>
            <div style={{ display: 'flex', gap: 16 }}>
              <button style={{ fontSize: 14, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}>
                Download CSV
              </button>
              <button style={{ fontSize: 14, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}>
                Share
              </button>
            </div>
          </div>
          <AreaChart 
            title={`Daily Revenue (Last ${timeRange === '7d' ? '7' : timeRange === '30d' ? '30' : '90'} Days)`}
            data={analyticsData.revenue}
            height={300}
          />
        </div>
      </section>

      {/* Charts Grid */}
      <section style={{ display: 'grid', gap: 24, gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: 24 }}>
        {/* Top Products Pie Chart */}
        <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Top Product Categories</h3>
          <PieChart 
            data={analyticsData.topProducts}
            height={280}
          />
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {analyticsData.topProducts.map((item, index) => (
              <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: item.color }}></div>
                  <span style={{ fontSize: 14 }}>{item.label}</span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{item.value}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Order Status Donut */}
        <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Order Status Distribution</h3>
          <StatusDonut 
            data={analyticsData.orderStatus}
            height={280}
          />
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {analyticsData.orderStatus.map((status, index) => (
              <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: status.color }}></div>
                  <span>{status.label}</span>
                </div>
                <span style={{ fontWeight: 600 }}>{status.value} orders</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Performance Metrics */}
      <section style={{ marginBottom: 24 }}>
        <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Performance Metrics</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <div style={{ padding: 16, background: '#eff6ff', borderRadius: 8 }}>
              <p style={{ fontSize: 12, color: '#1e40af', margin: '0 0 4px 0', fontWeight: 500 }}>
                Order Fulfillment Rate
              </p>
              <p style={{ fontSize: 24, fontWeight: 'bold', color: '#3b82f6', margin: 0 }}>94.2%</p>
              <p style={{ fontSize: 12, color: '#1e3a8a', margin: '4px 0 0 0' }}>↑ 2.1% vs last month</p>
            </div>
            <div style={{ padding: 16, background: '#f0fdf4', borderRadius: 8 }}>
              <p style={{ fontSize: 12, color: '#166534', margin: '0 0 4px 0', fontWeight: 500 }}>
                Customer Retention
              </p>
              <p style={{ fontSize: 24, fontWeight: 'bold', color: '#22c55e', margin: 0 }}>87%</p>
              <p style={{ fontSize: 12, color: '#14532d', margin: '4px 0 0 0' }}>↑ 3.5% vs last month</p>
            </div>
            <div style={{ padding: 16, background: '#fefce8', borderRadius: 8 }}>
              <p style={{ fontSize: 12, color: '#854d0e', margin: '0 0 4px 0', fontWeight: 500 }}>
                Average Delivery Time
              </p>
              <p style={{ fontSize: 24, fontWeight: 'bold', color: '#f59e0b', margin: 0 }}>2.4 days</p>
              <p style={{ fontSize: 12, color: '#78350f', margin: '4px 0 0 0' }}>↓ 0.3 days improvement</p>
            </div>
            <div style={{ padding: 16, background: '#faf5ff', borderRadius: 8 }}>
              <p style={{ fontSize: 12, color: '#6b21a8', margin: '0 0 4px 0', fontWeight: 500 }}>
                Repeat Order Rate
              </p>
              <p style={{ fontSize: 24, fontWeight: 'bold', color: '#8b5cf6', margin: 0 }}>68%</p>
              <p style={{ fontSize: 12, color: '#4c1d95', margin: '4px 0 0 0' }}>↑ 5.2% vs last month</p>
            </div>
          </div>
        </div>
      </section>

      {/* Top Retailers */}
      <section style={{ marginBottom: 24 }}>
        <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Top Retailers (This Month)</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { name: 'Nova Med', orders: 24, revenue: '$12,450', growth: '+18%' },
              { name: 'CareHub', orders: 19, revenue: '$9,820', growth: '+12%' },
              { name: 'Prime Labs', orders: 16, revenue: '$8,560', growth: '+24%' },
              { name: 'HealthFirst', orders: 14, revenue: '$7,340', growth: '+9%' },
              { name: 'MediCare Plus', orders: 12, revenue: '$6,180', growth: '+15%' }
            ].map((retailer, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 12,
                  background: '#f9fafb',
                  borderRadius: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: `hsl(${index * 60}, 70%, 60%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    color: 'white'
                  }}>
                    {index + 1}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{retailer.name}</p>
                    <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{retailer.orders} orders</p>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 16, color: '#10b981' }}>{retailer.revenue}</p>
                  <p style={{ margin: 0, fontSize: 12, color: '#22c55e' }}>{retailer.growth}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Business Insights */}
      <section>
        <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Business Insights</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div style={{ padding: 16, border: '1px solid #e5e7eb', borderRadius: 8 }}>
              <span style={{ fontSize: 24 }}>📈</span>
              <h4 style={{ margin: '8px 0 4px 0', fontSize: 14, fontWeight: 600 }}>Best Performing Month</h4>
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
                January 2026 with $52.8K revenue
              </p>
            </div>
            <div style={{ padding: 16, border: '1px solid #e5e7eb', borderRadius: 8 }}>
              <span style={{ fontSize: 24 }}>🎯</span>
              <h4 style={{ margin: '8px 0 4px 0', fontSize: 14, fontWeight: 600 }}>Peak Ordering Day</h4>
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
                Wednesdays average 28 orders
              </p>
            </div>
            <div style={{ padding: 16, border: '1px solid #e5e7eb', borderRadius: 8 }}>
              <span style={{ fontSize: 24 }}>💰</span>
              <h4 style={{ margin: '8px 0 4px 0', fontSize: 14, fontWeight: 600 }}>Highest Margin Category</h4>
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
                Medical Devices at 18.5%
              </p>
            </div>
          </div>
        </div>
      </section>
    </DashboardLayout>
  )
}

export default Analytics
