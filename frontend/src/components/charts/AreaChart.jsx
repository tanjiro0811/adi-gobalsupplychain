import { Line } from 'react-chartjs-2'
import { toRgba } from './chartSetup'

function normalizePoints(data = []) {
  return data.map((entry, index) => ({
    label: entry?.label ?? `${index + 1}`,
    value: Number(typeof entry === 'number' ? entry : entry?.value),
  }))
    .filter((entry) => Number.isFinite(entry.value))
}

function AreaChart({
  title = 'Forecast Trend',
  data = [],
  color = '#0f766e',
  height = 220,
}) {
  const points = normalizePoints(data)

  return (
    <section style={{ border: '1px solid #e2e8f0', borderRadius: 12, background: '#ffffff', padding: 16 }}>
      <h4 style={{ margin: '0 0 12px', color: '#0f172a' }}>{title}</h4>
      {!points.length && <p style={{ margin: 0, color: '#64748b' }}>No chart data</p>}
      {!!points.length && (
        <div style={{ width: '100%', height }}>
          <Line
            data={{
              labels: points.map((point) => point.label),
              datasets: [
                {
                  data: points.map((point) => point.value),
                  borderColor: color,
                  backgroundColor: toRgba(color, 0.22),
                  borderWidth: 2.2,
                  pointRadius: 3,
                  pointHoverRadius: 4.6,
                  pointBackgroundColor: color,
                  pointBorderColor: '#ffffff',
                  pointBorderWidth: 1.3,
                  fill: true,
                  tension: 0.34,
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: { intersect: false, mode: 'index' },
              },
              interaction: { intersect: false, mode: 'index' },
              scales: {
                x: {
                  grid: { display: false },
                  ticks: { color: '#64748b', font: { size: 11 } },
                },
                y: {
                  beginAtZero: true,
                  grid: { color: '#e2e8f0' },
                  ticks: { color: '#64748b', font: { size: 11 } },
                },
              },
            }}
          />
        </div>
      )}
    </section>
  )
}

export default AreaChart
