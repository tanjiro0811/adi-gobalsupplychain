import {
  ArcElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  BarElement,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
)

export function toRgba(hex, alpha = 1) {
  if (!hex || typeof hex !== 'string') {
    return `rgba(14, 165, 233, ${alpha})`
  }

  const normalized = hex.replace('#', '').trim()
  if (![3, 6].includes(normalized.length)) {
    return `rgba(14, 165, 233, ${alpha})`
  }

  const chars = normalized.length === 3
    ? normalized.split('').map((char) => `${char}${char}`).join('')
    : normalized

  const value = Number.parseInt(chars, 16)
  if (Number.isNaN(value)) {
    return `rgba(14, 165, 233, ${alpha})`
  }

  const r = (value >> 16) & 255
  const g = (value >> 8) & 255
  const b = value & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
