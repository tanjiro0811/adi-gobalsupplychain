import AreaChart from '../../components/charts/AreaChart'
import LineChart from '../../components/charts/LineChart'
import StatusDonut from '../../components/charts/StatusDonut'

function Analytics({ shipments = {}, analyticsData = {} }) {
  const vehicles = Object.values(shipments)

  const fallbackTrends = [
    { label: 'Mon', value: 45 },
    { label: 'Tue', value: 52 },
    { label: 'Wed', value: 48 },
    { label: 'Thu', value: 61 },
    { label: 'Fri', value: 55 },
    { label: 'Sat', value: 42 },
    { label: 'Sun', value: 38 },
  ]

  const inTransit = vehicles.filter((v) => String(v.status).toLowerCase().includes('in transit')).length
  const delayed = vehicles.filter((v) => String(v.status).toLowerCase().includes('delay')).length
  const completed = Math.max(vehicles.length - inTransit - delayed, 0)

  const statusData =
    analyticsData.statusData?.length
      ? analyticsData.statusData
      : [
          { label: 'In Transit', value: inTransit, color: '#0ea5e9' },
          { label: 'Delayed', value: delayed, color: '#f97316' },
          { label: 'Completed', value: completed, color: '#22c55e' },
        ]

  const forecast = analyticsData.forecast || {
    today: vehicles.length,
    projected: Math.round(vehicles.length * 1.15),
    trend: '+15%',
    series: [
      { label: 'Today', value: Math.max(vehicles.length, 1) },
      { label: 'D+1', value: Math.max(Math.round(vehicles.length * 1.05), 1) },
      { label: 'D+2', value: Math.max(Math.round(vehicles.length * 1.1), 1) },
      { label: 'D+3', value: Math.max(Math.round(vehicles.length * 1.15), 1) },
    ],
  }

  return (
    <section className="analytics-container">
      <div className="analytics-grid">
        <div className="card">
          <h4 className="card-title">Delivery Trends</h4>
          <AreaChart data={analyticsData.deliveryTrends?.length ? analyticsData.deliveryTrends : fallbackTrends} color="#0ea5e9" />
        </div>

        <div className="card">
          <h4 className="card-title">Fleet Status Distribution</h4>
          <StatusDonut data={statusData} />
        </div>

        <div className="card forecast-card">
          <h4 className="card-title">Delivery Forecast</h4>
          <div className="forecast-chart-wrap">
            <LineChart data={forecast.series || []} color="#22a5c5" />
          </div>
          <div className="forecast-content">
            <div className="forecast-stat">
              <span className="forecast-label">Today</span>
              <span className="forecast-value">{forecast.today ?? 0}</span>
            </div>
            <div className="forecast-stat">
              <span className="forecast-label">Projected</span>
              <span className="forecast-value">{forecast.projected ?? 0}</span>
            </div>
            <div className="forecast-stat">
              <span className="forecast-label">Trend</span>
              <span className="forecast-value trend-positive">{forecast.trend ?? '+0%'}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Analytics
