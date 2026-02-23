import { Doughnut } from 'react-chartjs-2'
import './chartSetup'

function PieChart({ title = 'Distribution', data = [], height = 220 }) {
  const normalized = data
    .map((item) => ({
      label: item.label,
      value: Number(item.value ?? 0),
      color: item.color ?? '#0f766e',
    }))
    .filter((item) => Number.isFinite(item.value) && item.value >= 0)

  const total = normalized.reduce((sum, item) => sum + item.value, 0)
  const segments = normalized

  return (
    <section style={{ border: '1px solid #e2e8f0', borderRadius: 12, background: '#ffffff', padding: 16 }}>
      <h4 style={{ margin: '0 0 12px', color: '#0f172a' }}>{title}</h4>
      {!total && <p style={{ margin: 0, color: '#64748b' }}>No chart data</p>}
      {!!total && (
        <div style={{ display: 'grid', gap: 14 }}>
          <div style={{ position: 'relative', width: '100%', height }}>
            <Doughnut
              data={{
                labels: normalized.map((item) => item.label),
                datasets: [
                  {
                    data: normalized.map((item) => item.value),
                    backgroundColor: normalized.map((item) => item.color),
                    borderColor: '#ffffff',
                    borderWidth: 2,
                    hoverOffset: 6,
                    spacing: 1,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                cutout: '68%',
                plugins: {
                  legend: { display: false },
                },
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
                pointerEvents: 'none',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#64748b' }}>Total</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{Math.round(total)}</div>
              </div>
            </div>
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
            {segments.map((item) => (
              <li
                key={item.label}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: item.color,
                      display: 'inline-block',
                    }}
                  />
                  {item.label}
                </span>
                <strong>{((item.value / total) * 100).toFixed(1)}%</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

export default PieChart
