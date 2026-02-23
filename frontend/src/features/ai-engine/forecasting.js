export function movingAverage(values = [], windowSize = 3) {
  if (!values.length || windowSize <= 0) {
    return []
  }

  return values.map((_, index) => {
    const start = Math.max(index - windowSize + 1, 0)
    const window = values.slice(start, index + 1)
    const sum = window.reduce((acc, value) => acc + value, 0)
    return Number((sum / window.length).toFixed(2))
  })
}

export function forecastDemand(values = [], projectionCount = 3) {
  if (!values.length) {
    return []
  }

  const trend = movingAverage(values, Math.min(3, values.length))
  const lastKnown = trend.at(-1) ?? values.at(-1) ?? 0
  return Array.from({ length: projectionCount }, (_, index) =>
    Number((lastKnown * (1 + index * 0.03)).toFixed(2)),
  )
}
