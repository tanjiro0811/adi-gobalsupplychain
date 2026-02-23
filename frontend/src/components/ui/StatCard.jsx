const ICONS = ['$', 'AI', '#', 'GPS', 'BLK']

function Sparkline({ points = [], color = '#0f766e' }) {
  const normalized = points.length ? points : [20, 28, 24, 32, 38, 34, 42]
  const maxValue = Math.max(...normalized, 1)
  const line = normalized
    .map((value, index) => {
      const x = (index / Math.max(normalized.length - 1, 1)) * 100
      const y = 100 - (value / maxValue) * 85
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg className="sparkline" viewBox="0 0 100 100" aria-hidden="true">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={line}
      />
    </svg>
  )
}

function StatCard({
  label,
  value,
  trend = '+0.0%',
  sparkline = [],
  color = '#0f766e',
  icon,
  index = 0,
}) {
  const normalizedTrend = `${trend}`.trim()
  const trendClass = normalizedTrend.startsWith('-') ? 'trend-badge down' : 'trend-badge'
  return (
    <article className="kpi-card" style={{ '--kpi-color': color, '--kpi-icon-bg': `${color}20` }}>
      <div className="kpi-top">
        <p className="kpi-label">{label}</p>
        <span className="kpi-icon">{icon ?? ICONS[index % ICONS.length]}</span>
      </div>
      <h3 className="kpi-value">{value}</h3>
      <div className="kpi-bottom">
        <Sparkline points={sparkline} color={color} />
        {normalizedTrend ? <span className={trendClass}>{normalizedTrend}</span> : null}
      </div>
    </article>
  )
}

export default StatCard
