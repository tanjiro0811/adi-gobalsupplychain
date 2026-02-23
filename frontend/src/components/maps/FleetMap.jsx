import RouteOverlay from './RouteOverlay'
import LorryIcon from '../../pages/Transporter/LorryIcon'
import { getShipmentDetails, projectCoordinates } from '../../pages/Transporter/shipmentUtils'

function FleetMap({ shipments = {} }) {
  const points = Object.entries(shipments).map(([id, item]) => {
    const details = getShipmentDetails(id, item)
    const lat = details.lat ?? 0
    const lng = details.lng ?? 0
    return {
      ...details,
      ...projectCoordinates(lat, lng),
    }
  }).filter((point) => point.hasGps)

  const originalRoute = points.slice(0, 4).map((point) => ({ x: point.x, y: point.y }))
  const optimizedRoute = originalRoute.map((point, index) => ({
    x: point.x + (index % 2 ? -2.4 : 2.4),
    y: point.y + (index % 2 ? 1.4 : -1.8),
  }))

  return (
    <section className="card">
      <h4 className="card-title">Live Fleet Map</h4>
      <div className="fleet-map">
        <div className="fleet-grid" />
        <RouteOverlay originalRoute={originalRoute} optimizedRoute={optimizedRoute} />
        {points.map((point) => (
          <span
            key={point.id}
            className={`fleet-marker ${point.isDelayed ? 'delayed' : ''}`.trim()}
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
            title={`${point.id} | ${point.partnerName} | ${point.assignmentStatus} | ${point.status}`}
          >
            <LorryIcon className="lorry-icon" title="Live vehicle" />
          </span>
        ))}
      </div>
      <p className="forecast-note">Glowing line: original route. Dashed line: AI-optimized reroute.</p>
    </section>
  )
}

export default FleetMap
