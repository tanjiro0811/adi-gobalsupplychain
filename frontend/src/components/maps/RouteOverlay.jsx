function toPolyline(points = []) {
  return points
    .map((point, index) => {
      const x = Math.min(Math.max(point.x, 2), 98)
      const y = Math.min(Math.max(point.y, 2), 98)
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')
}

function RouteOverlay({ originalRoute = [], optimizedRoute = [] }) {
  if (!originalRoute.length && !optimizedRoute.length) {
    return null
  }

  return (
    <>
      <svg className="route-original" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d={toPolyline(originalRoute)} />
      </svg>
      <svg className="route-optimized" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d={toPolyline(optimizedRoute)} />
      </svg>
    </>
  )
}

export default RouteOverlay
