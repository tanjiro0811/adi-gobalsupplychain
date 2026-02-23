import { useMemo } from 'react'
import { getInitials, getShipmentDetails, projectCoordinates } from './shipmentUtils'

function GPSMap({ shipments = {}, center = [20.5937, 78.9629], zoom = 5 }) {
  const shipmentRows = useMemo(
    () => Object.entries(shipments).map(([id, item]) => getShipmentDetails(id, item)),
    [shipments],
  )

  const livePoints = shipmentRows
    .filter((item) => item.hasGps)
    .map((item) => ({
      ...item,
      ...projectCoordinates(item.lat, item.lng),
    }))

  return (
    <section className="card gps-map-container">
      <div className="shipments-header">
        <h4 className="card-title">Live GPS Tracking</h4>
        <div className="shipments-controls">
          <span className="tracking-chip live">Active Vehicles: {livePoints.length}</span>
          <span className="tracking-chip">Center: {center.join(', ')} | Zoom: {zoom}</span>
        </div>
      </div>

      <div className="gps-map">
        <div className="fleet-grid" />
        {livePoints.map((point) => (
          <button
            key={point.id}
            type="button"
            className={`fleet-marker gps-marker ${point.isDelayed ? 'delayed' : ''}`.trim()}
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
            title={`${point.id} | ${point.partnerName} | ${point.liveTracking}`}
          >
            <span className="gps-marker-badge">
              <span className="gps-marker-fallback">{getInitials(point.partnerName)}</span>
              {point.partnerLogo ? (
                <img
                  className="gps-marker-logo"
                  src={point.partnerLogo}
                  alt={`${point.partnerName} logo`}
                  onError={(event) => {
                    event.currentTarget.style.display = 'none'
                  }}
                />
              ) : null}
            </span>
          </button>
        ))}
      </div>

      <div className="tracking-feedback-list">
        {shipmentRows.map((item) => (
          <article key={item.id} className="tracking-feedback-item">
            <div className="tracking-feedback-head">
              <strong>{item.id}</strong>
              <span className={`assignment-chip ${item.assignmentStatus.toLowerCase().includes('pending') ? 'pending' : 'assigned'}`}>
                {item.assignmentStatus}
              </span>
            </div>
            <p className="tracking-feedback-route">{item.origin} to {item.destination}</p>
            <p className="tracking-feedback-note">
              Partner: {item.partnerName} | Vehicle: {item.vehicleNumber} | {item.liveTracking}
            </p>
            <p className="tracking-feedback-note">Feedback: {item.feedbackMessage}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

export default GPSMap
