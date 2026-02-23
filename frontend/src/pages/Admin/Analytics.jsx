import { useEffect, useState } from 'react'
import { adminApi } from '../../api/axiosInstance'
import AreaChart from '../../components/charts/AreaChart'
import ForecastChart from '../../components/charts/ForecastChart'
import PieChart from '../../components/charts/PieChart'
import StatusDonut from '../../components/charts/StatusDonut'
import Loader from '../../components/common/Loader'
import DashboardLayout from '../../components/layout/DashboardLayout'
import './../Admin/admin.css'

const DEFAULT_API_METRICS = {
  auth: 12847,
  blockchain: 8523,
  gps: 15234,
  analytics: 6789,
}

const DEFAULT_USER_DISTRIBUTION = [
  { label: 'Manufacturers', value: 245, color: '#3b82f6' },
  { label: 'Transporters', value: 128, color: '#10b981' },
  { label: 'Dealers', value: 342, color: '#8b5cf6' },
  { label: 'Retail Shops', value: 586, color: '#f59e0b' },
]

const DEFAULT_SYSTEM_STATUS = [
  { label: 'Active', value: 892, color: '#10b981' },
  { label: 'Pending', value: 45, color: '#f59e0b' },
  { label: 'Issues', value: 12, color: '#ef4444' },
  { label: 'Maintenance', value: 8, color: '#6b7280' },
]

function generateMockRevenue() {
  const days = 30
  return Array.from({ length: days }, () => 50000 + Math.random() * 100000)
}

function generateMockForecast() {
  const days = 60
  return Array.from({ length: days }, () => 80000 + Math.random() * 120000)
}

function Analytics({ user, onLogout, onNavigate, currentPath }) {
  const [timeRange, setTimeRange] = useState('30d')
  const [loading, setLoading] = useState(true)
  const [analyticsData, setAnalyticsData] = useState({
    revenue: [],
    forecast: [],
    userDistribution: [],
    systemStatus: [],
    apiMetrics: DEFAULT_API_METRICS,
  })

  useEffect(() => {
    let mounted = true

    async function fetchAnalyticsData() {
      setLoading(true)
      try {
        const response = await adminApi.analytics(timeRange)
        if (!mounted) {
          return
        }

        setAnalyticsData((prev) => ({
          revenue: response.revenue || generateMockRevenue(),
          forecast: response.forecast || generateMockForecast(),
          userDistribution: response.userDistribution || DEFAULT_USER_DISTRIBUTION,
          systemStatus: response.systemStatus || DEFAULT_SYSTEM_STATUS,
          apiMetrics: response.apiMetrics || prev.apiMetrics || DEFAULT_API_METRICS,
        }))
      } catch (error) {
        console.error('Error fetching analytics:', error)
        if (!mounted) {
          return
        }

        setAnalyticsData((prev) => ({
          revenue: generateMockRevenue(),
          forecast: generateMockForecast(),
          userDistribution: DEFAULT_USER_DISTRIBUTION,
          systemStatus: DEFAULT_SYSTEM_STATUS,
          apiMetrics: prev.apiMetrics || DEFAULT_API_METRICS,
        }))
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    fetchAnalyticsData()
    return () => {
      mounted = false
    }
  }, [timeRange])

  const stats = [
    { label: 'Total Revenue', value: 'INR 12.5L', trend: '+15%' },
    { label: 'Active Users', value: '1,301', trend: '+8%' },
    { label: 'Shipments', value: '2,847', trend: '+12%' },
    { label: 'Verifications', value: '4,523', trend: '+5%' },
  ]

  if (loading) {
    return (
      <DashboardLayout
        role="Admin"
        themeClass="admin-theme"
        userName={user?.name}
        onLogout={onLogout}
        onNavigate={onNavigate}
        currentPath={currentPath}
        stats={stats}
      >
        <Loader label="Loading analytics data..." />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout
      role="Admin"
      themeClass="admin-theme"
      userName={user?.name}
      onLogout={onLogout}
      onNavigate={onNavigate}
      currentPath={currentPath}
      stats={stats}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 'bold', margin: 0 }}>Analytics Dashboard</h2>
          <p style={{ color: '#6b7280', margin: '4px 0 0 0' }}>Platform performance and insights</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['7d', '30d', '90d', '1y'].map((range) => (
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
                transition: 'all 0.2s',
              }}
            >
              {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : range === '90d' ? '90 Days' : '1 Year'}
            </button>
          ))}
        </div>
      </div>

      <section style={{ marginBottom: 24 }}>
        <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Platform Revenue Trend</h3>
          </div>
          <AreaChart title="Daily Revenue (INR)" data={analyticsData.revenue} height={300} />
        </div>
      </section>

      <section style={{ display: 'grid', gap: 24, gridTemplateColumns: '1fr 1fr', marginBottom: 24 }}>
        <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Growth Forecast (AI)</h3>
          <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>
            Predicted platform growth for next 60 days
          </p>
          <ForecastChart title="Revenue Prediction" data={analyticsData.forecast} height={280} />
        </div>

        <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>User Distribution</h3>
          <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>
            Breakdown by stakeholder type
          </p>
          <PieChart data={analyticsData.userDistribution} height={280} />
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {analyticsData.userDistribution.map((item) => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: item.color }}></div>
                  <span style={{ fontSize: 14 }}>{item.label}</span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gap: 24, gridTemplateColumns: '1fr 1fr' }}>
        <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>System Health Status</h3>
          <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>
            Real-time platform operations
          </p>
          <StatusDonut data={analyticsData.systemStatus} />
        </div>

        <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>API Usage Metrics</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span style={{ color: '#6b7280' }}>Authentication API</span>
              <span style={{ fontWeight: 600 }}>{analyticsData.apiMetrics.auth.toLocaleString()} calls</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span style={{ color: '#6b7280' }}>Blockchain API</span>
              <span style={{ fontWeight: 600 }}>{analyticsData.apiMetrics.blockchain.toLocaleString()} calls</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span style={{ color: '#6b7280' }}>GPS Tracking API</span>
              <span style={{ fontWeight: 600 }}>{analyticsData.apiMetrics.gps.toLocaleString()} calls</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span style={{ color: '#6b7280' }}>Analytics API</span>
              <span style={{ fontWeight: 600 }}>{analyticsData.apiMetrics.analytics.toLocaleString()} calls</span>
            </div>
          </div>
        </div>
      </section>
    </DashboardLayout>
  )
}

export default Analytics
