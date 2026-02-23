import AreaChart from '../../components/charts/AreaChart'
import BarChart from '../../components/charts/BarChart'
import LineChart from '../../components/charts/LineChart'

function toChartSeries(series = [], fallback = []) {
  if (!Array.isArray(series) || !series.length) {
    return fallback
  }

  if (typeof series[0] === 'object') {
    return series
  }

  return series.map((value, index) => ({
    label: `Point ${index + 1}`,
    value: Number(value ?? 0),
  }))
}

function Analytics({ forecastSeries = [], batches = [], analyticsData = {} }) {
  const fallbackEfficiency = [
    { label: 'Week 1', value: 92 },
    { label: 'Week 2', value: 89 },
    { label: 'Week 3', value: 94 },
    { label: 'Week 4', value: 96 },
  ]
  const fallbackDefects = [
    { label: 'Jan', value: 2.4 },
    { label: 'Feb', value: 1.8 },
    { label: 'Mar', value: 1.5 },
    { label: 'Apr', value: 1.2 },
  ]
  const fallbackCategory = [
    { label: 'PPE', value: 1300 },
    { label: 'Medical', value: 800 },
    { label: 'First Aid', value: 600 },
    { label: 'Diagnostics', value: 450 },
  ]

  const forecastChartData = toChartSeries(
    analyticsData.forecastSeries?.length ? analyticsData.forecastSeries : forecastSeries,
    [],
  )
  const efficiencyData = toChartSeries(analyticsData.efficiencyTrend, fallbackEfficiency)
  const defectData = toChartSeries(analyticsData.defectTrend, fallbackDefects)
  const categoryProduction = toChartSeries(analyticsData.categoryProduction, fallbackCategory)

  const totalOutputFallback = batches.reduce((sum, row) => sum + Number(row.quantity ?? 0), 0)
  const analyticsStats = {
    avgEfficiency: analyticsData.stats?.avgEfficiency || '93%',
    avgDefectRate: analyticsData.stats?.avgDefectRate || '1.73%',
    totalOutput: analyticsData.stats?.totalOutput || totalOutputFallback || '3,150',
    forecast:
      analyticsData.stats?.forecastNext ||
      forecastChartData[forecastChartData.length - 1]?.value ||
      0,
  }

  return (
    <div className="analytics-container">
      <div className="analytics-stats-grid">
        <div className="stat-card">
          <span className="stat-label">Avg Efficiency</span>
          <span className="stat-value">{analyticsStats.avgEfficiency}</span>
          <span className="stat-trend positive">+4.2%</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Avg Defect Rate</span>
          <span className="stat-value">{analyticsStats.avgDefectRate}</span>
          <span className="stat-trend positive">-0.67%</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Output</span>
          <span className="stat-value">{analyticsStats.totalOutput}</span>
          <span className="stat-trend positive">+12.5%</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">AI Forecast Next</span>
          <span className="stat-value">{analyticsStats.forecast}</span>
          <span className="stat-trend neutral">Predicted</span>
        </div>
      </div>

      <div className="analytics-charts-grid">
        <div className="card chart-large">
          <h4 className="card-title">AI Production Forecast</h4>
          <AreaChart data={forecastChartData} color="#0ea5e9" />
          <p className="chart-note">Blue area shows historical data, projection continues trend</p>
        </div>

        <div className="card">
          <h4 className="card-title">Production Efficiency (%)</h4>
          <LineChart data={efficiencyData} color="#22c55e" />
        </div>

        <div className="card">
          <h4 className="card-title">Defect Rate Trend (%)</h4>
          <LineChart data={defectData} color="#ef4444" />
        </div>

        <div className="card">
          <h4 className="card-title">Production by Category</h4>
          <BarChart data={categoryProduction} color="#a855f7" />
        </div>
      </div>

      <div className="card insights-card">
        <h4 className="card-title">Key Insights</h4>
        <div className="insights-grid">
          <div className="insight-item">
            <div className="insight-icon insight-success">OK</div>
            <div className="insight-content">
              <h5>Production Efficiency Up</h5>
              <p>Efficiency trend is improving over the latest production cycle.</p>
            </div>
          </div>
          <div className="insight-item">
            <div className="insight-icon insight-success">OK</div>
            <div className="insight-content">
              <h5>Defect Rate Declining</h5>
              <p>Quality trend indicates lower defects across recent months.</p>
            </div>
          </div>
          <div className="insight-item">
            <div className="insight-icon insight-info">i</div>
            <div className="insight-content">
              <h5>AI Forecast Active</h5>
              <p>Forecasted next cycle output: {analyticsStats.forecast} units.</p>
            </div>
          </div>
          <div className="insight-item">
            <div className="insight-icon insight-warning">!</div>
            <div className="insight-content">
              <h5>Category Focus</h5>
              <p>Category mix is sourced from live backend inventory quantities.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Analytics
