import { Line } from 'react-chartjs-2'
import { toRgba } from './chartSetup'

function toValues(values) {
  return values
    .map((entry) => (typeof entry === 'number' ? entry : Number(entry?.value ?? 0)))
    .filter((value) => Number.isFinite(value))
}

const phaseDividerPlugin = {
  id: 'phaseDivider',
  beforeDraw(chart, _args, options) {
    const splitIndex = options?.splitIndex
    if (!Number.isFinite(splitIndex)) {
      return
    }

    const { ctx, chartArea, scales } = chart
    if (!chartArea || !scales?.x) {
      return
    }

    const splitX = scales.x.getPixelForValue(splitIndex)
    if (!Number.isFinite(splitX)) {
      return
    }

    ctx.save()
    ctx.fillStyle = '#f8fafc'
    ctx.fillRect(chartArea.left, chartArea.top, Math.max(0, splitX - chartArea.left), chartArea.bottom - chartArea.top)
    ctx.fillStyle = 'rgba(236, 254, 255, 0.75)'
    ctx.fillRect(splitX, chartArea.top, Math.max(0, chartArea.right - splitX), chartArea.bottom - chartArea.top)
    ctx.restore()
  },
  afterDatasetsDraw(chart, _args, options) {
    const splitIndex = options?.splitIndex
    if (!Number.isFinite(splitIndex)) {
      return
    }

    const { ctx, chartArea, scales } = chart
    if (!chartArea || !scales?.x) {
      return
    }

    const splitX = scales.x.getPixelForValue(splitIndex)
    if (!Number.isFinite(splitX)) {
      return
    }

    ctx.save()
    ctx.setLineDash([4, 4])
    ctx.strokeStyle = '#94a3b8'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(splitX, chartArea.top)
    ctx.lineTo(splitX, chartArea.bottom)
    ctx.stroke()
    ctx.restore()
  },
}

function ForecastChart({ title = 'Forecast', data = [], predictionStart = 4 }) {
  const values = toValues(data)
  const splitAt = Math.min(Math.max(predictionStart, 1), Math.max(values.length - 1, 1))

  if (!values.length) {
    return (
      <section className="card">
        <h4 className="card-title">{title}</h4>
        <p className="muted">No chart data</p>
      </section>
    )
  }

  const labels = values.map((_, index) => `${index + 1}`)
  const historical = values.map((value, index) => (index <= splitAt ? value : null))
  const forecast = values.map((value, index) => (index >= splitAt ? value : null))

  return (
    <section className="card">
      <h4 className="card-title">{title}</h4>
      <div style={{ width: '100%', height: 220 }}>
        <Line
          data={{
            labels,
            datasets: [
              {
                label: 'Historical',
                data: historical,
                borderColor: '#0f766e',
                backgroundColor: toRgba('#0f766e', 0.14),
                fill: true,
                borderWidth: 2.6,
                tension: 0.32,
                pointRadius: 0,
                spanGaps: true,
              },
              {
                label: 'Forecast',
                data: forecast,
                borderColor: '#0284c7',
                backgroundColor: toRgba('#0284c7', 0.18),
                fill: true,
                borderWidth: 2.6,
                tension: 0.32,
                borderDash: [6, 4],
                pointRadius: 0,
                spanGaps: true,
              },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              phaseDivider: { splitIndex: splitAt },
            },
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
            interaction: { intersect: false, mode: 'index' },
          }}
          plugins={[phaseDividerPlugin]}
        />
      </div>
      <p className="forecast-note">
        Solid section represents historical observations. Shaded section represents AI prediction.
      </p>
    </section>
  )
}

export default ForecastChart
