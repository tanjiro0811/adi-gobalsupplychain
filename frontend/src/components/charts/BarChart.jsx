import { Bar } from 'react-chartjs-2'
import { toRgba } from './chartSetup'

function normalizePoints(data = []) {
  return data.map((item, index) => ({
    label: item?.label ?? `${index + 1}`,
    value: Number(item?.value ?? item ?? 0),
  })).filter((point) => Number.isFinite(point.value))
}

function BarChart({ data = [], color = '#0ea5e9', height = 200 }) {
  const points = normalizePoints(data)

  if (!points.length) {
    return <p style={{ margin: 0, color: '#64748b' }}>No chart data</p>
  }

  const chartData = {
    labels: points.map((point) => String(point.label)),
    datasets: [
      {
        data: points.map((point) => point.value),
        backgroundColor: toRgba(color, 0.88),
        borderColor: color,
        borderWidth: 1,
        borderRadius: 6,
        maxBarThickness: 34,
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
      <Bar data={chartData} options={options} />
    </div>
  )
}

export default BarChart
