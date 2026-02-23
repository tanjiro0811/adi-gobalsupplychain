import { useEffect, useState } from 'react'
import { inventoryApi } from '../../api/axiosInstance'
import BarChart from '../../components/charts/BarChart'
import LineChart from '../../components/charts/LineChart'
import Loader from '../../components/common/Loader'
import Table from '../../components/common/Table'

function Sales({ salesData = [] }) {
  const [period, setPeriod] = useState('week')
  const [loading, setLoading] = useState(true)
  const [chartData, setChartData] = useState(salesData)
  const [topProducts, setTopProducts] = useState([])
  const [recentTransactions, setRecentTransactions] = useState([])
  const [salesStats, setSalesStats] = useState({
    today: '$0',
    week: '$0',
    month: '$0',
    avgTransaction: '$0.00',
  })

  useEffect(() => {
    let mounted = true

    async function loadSalesAnalytics() {
      setLoading(true)
      try {
        const payload = await inventoryApi.salesAnalytics(period)
        if (!mounted) {
          return
        }

        setChartData(payload?.trend ?? [])
        setTopProducts(payload?.topProducts ?? [])
        setRecentTransactions(payload?.recentTransactions ?? [])
        setSalesStats(
          payload?.salesStats ?? {
            today: '$0',
            week: '$0',
            month: '$0',
            avgTransaction: '$0.00',
          },
        )
      } catch (error) {
        console.error('Failed to load retail sales analytics:', error)
        if (mounted) {
          setChartData(salesData)
          setTopProducts([])
          setRecentTransactions([])
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadSalesAnalytics()
    return () => {
      mounted = false
    }
  }, [period, salesData])

  if (loading) {
    return <Loader label="Loading sales analytics..." />
  }

  return (
    <div className="sales-container">
      <div className="sales-stats-grid">
        <div className="stat-card">
          <span className="stat-label">Today's Sales</span>
          <span className="stat-value">{salesStats.today}</span>
          <span className="stat-trend positive">Live</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">This Week</span>
          <span className="stat-value">{salesStats.week}</span>
          <span className="stat-trend positive">Live</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">This Month</span>
          <span className="stat-value">{salesStats.month}</span>
          <span className="stat-trend positive">Live</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Avg Transaction</span>
          <span className="stat-value">{salesStats.avgTransaction}</span>
          <span className="stat-trend neutral">Live</span>
        </div>
      </div>

      <div className="sales-charts-grid">
        <div className="card">
          <div className="chart-header">
            <h4 className="card-title">Sales Trend</h4>
            <div className="period-selector">
              <button
                className={`period-btn ${period === 'week' ? 'active' : ''}`}
                onClick={() => setPeriod('week')}
              >
                Week
              </button>
              <button
                className={`period-btn ${period === 'month' ? 'active' : ''}`}
                onClick={() => setPeriod('month')}
              >
                Month
              </button>
            </div>
          </div>
          <LineChart data={chartData} color="#0ea5e9" />
        </div>

        <div className="card">
          <h4 className="card-title">Product Performance</h4>
          <BarChart
            data={topProducts.slice(0, 5).map((product) => ({
              label: String(product.product || '').split(' ')[0] || 'Item',
              value: Number(product.units || 0),
            }))}
            color="#22c55e"
          />
        </div>
      </div>

      <div className="card">
        <h4 className="card-title">Top Selling Products</h4>
        <Table
          columns={[
            { key: 'product', label: 'Product' },
            { key: 'units', label: 'Units Sold' },
            { key: 'revenue', label: 'Revenue' },
            {
              key: 'growth',
              label: 'Growth',
              render: (value) => (
                <span
                  className={`growth-badge ${
                    value.startsWith('+') ? 'positive' : value.startsWith('-') ? 'negative' : 'neutral'
                  }`}
                >
                  {value}
                </span>
              ),
            },
          ]}
          rows={topProducts}
          emptyMessage="No sales data"
        />
      </div>

      <div className="card">
        <h4 className="card-title">Recent Transactions</h4>
        <Table
          columns={[
            { key: 'id', label: 'Transaction ID' },
            { key: 'time', label: 'Time' },
            { key: 'items', label: 'Items' },
            { key: 'amount', label: 'Amount' },
            { key: 'payment', label: 'Payment Method' },
            {
              key: 'status',
              label: 'Status',
              render: (value) => <span className="status-badge status-completed">{value}</span>,
            },
          ]}
          rows={recentTransactions}
          emptyMessage="No transactions"
        />
      </div>
    </div>
  )
}

export default Sales
