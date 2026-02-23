import { Line } from 'react-chartjs-2'
import { toRgba } from './chartSetup'

function normalizePoints(data = []) {
  return data.map((item, index) => ({
    label: item?.label ?? `${index + 1}`,
    value: Number(item?.value ?? item ?? 0),
  })).filter((point) => Number.isFinite(point.value))
}

function LineChart({ data = [], color = '#0ea5e9', height = 200 }) {
  const points = normalizePoints(data)

  if (!points.length) {
    return <p style={{ margin: 0, color: '#64748b' }}>No chart data</p>
  }

  const chartData = {
    labels: points.map((point) => point.label),
    datasets: [
      {
        data: points.map((point) => point.value),
        borderColor: color,
        pointBackgroundColor: color,
        pointBorderColor: '#ffffff',
        pointBorderWidth: 1.4,
        pointRadius: 3.2,
        pointHoverRadius: 4.6,
        borderWidth: 2.4,
        tension: 0.32,
        fill: true,
        backgroundColor: toRgba(color, 0.12),
      },
    ],
  }

  const options = {
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
  }

  return (
    <div style={{ width: '100%', height }}>
      <Line data={chartData} options={options} />
    </div>
  )
}

export default LineChart
