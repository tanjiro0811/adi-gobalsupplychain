import BarChart from '../charts/BarChart'
import PieChart from '../charts/PieChart'

const MONTH_LABELS = ['January', 'February', 'March', 'April', 'May', 'June', 'July']
const MONTH_COLORS = ['#3b82f6', '#f59e0b', '#facc15', '#14b8a6', '#8b5cf6', '#94a3b8', '#ec4899']
const BASE_CURVE = [0.74, 0.92, 0.84, 0.68, 1.12, 0.88, 1.18]

function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9.-]+/g, ''))
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return null
}

function getRoleOffset(role = '') {
  return String(role)
    .split('')
    .reduce((sum, char) => sum + char.charCodeAt(0), 0) % 9
}

function buildMonthlySeries(role, stats = []) {
  const numericValues = stats
    .map((item) => toNumber(item?.value))
    .filter((value) => value !== null && value > 0)

  const fallbackBase = 36 + getRoleOffset(role)
  const baseValue = numericValues[0] ?? fallbackBase
  const normalization = Math.max(1, baseValue / 70)
  const roleOffset = getRoleOffset(role)

  return MONTH_LABELS.map((label, index) => {
    const source = numericValues[index % Math.max(numericValues.length, 1)] ?? baseValue
    const curve = BASE_CURVE[index] + (roleOffset % 3) * 0.04
    const value = Math.max(8, Math.round((source / normalization) * curve))
    return { label, value }
  })
}

function DashboardReportSection({ role, stats = [] }) {
  const series = buildMonthlySeries(role, stats)
  const donutData = series.map((item, index) => ({
    label: item.label,
    value: item.value,
    color: MONTH_COLORS[index % MONTH_COLORS.length],
  }))

  return (
    <section className="dashboard-report-block">
      <div className="dashboard-report-grid">
        <PieChart title="Monthly Sales Report" data={donutData} height={260} />
        <section className="dashboard-report-card">
          <h4 className="dashboard-report-title">Monthly Sales Report</h4>
          <BarChart data={series} color="#93c5fd" height={260} />
          <p className="dashboard-report-note">Sales data for current cycle</p>
        </section>
      </div>
    </section>
  )
}

export default DashboardReportSection
