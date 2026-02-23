import { useMemo, useState } from 'react'
import Table from '../../components/common/Table'
import { getInitials, getShipmentDetails } from './shipmentUtils'

function Shipments({ shipments = {} }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('id')

  const shipmentList = useMemo(
    () => Object.entries(shipments).map(([id, item]) => getShipmentDetails(id, item)),
    [shipments],
  )

  const filteredShipments = shipmentList
    .filter((s) =>
      [
        s.id,
        s.status,
        s.partnerName,
        s.assignmentStatus,
        s.vehicleNumber,
        s.origin,
        s.destination,
      ]
        .join(' ')
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'id') return a.id.localeCompare(b.id)
      if (sortBy === 'status') return a.status.localeCompare(b.status)
      if (sortBy === 'partner') return a.partnerName.localeCompare(b.partnerName)
      if (sortBy === 'assignment') return a.assignmentStatus.localeCompare(b.assignmentStatus)
      return 0
    })

  return (
    <section className="card shipments-container">
      <div className="shipments-header">
        <h4 className="card-title">All Shipments</h4>
        <div className="shipments-controls">
          <input
            type="text"
            className="search-input"
            placeholder="Search shipments..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            className="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="id">Sort by ID</option>
            <option value="status">Sort by Status</option>
            <option value="partner">Sort by Partner</option>
            <option value="assignment">Sort by Assignment</option>
          </select>
        </div>
      </div>
      <Table
        columns={[
          { key: 'id', label: 'Shipment ID' },
          {
            key: 'partnerName',
            label: 'Delivery Partner',
            render: (_, row) => (
              <div className="partner-cell">
                {row.partnerLogo ? (
                  <img className="partner-logo" src={row.partnerLogo} alt={row.partnerName} />
                ) : (
                  <span className="partner-logo partner-logo-fallback">
                    {getInitials(row.partnerName)}
                  </span>
                )}
                <div className="partner-meta">
                  <strong>{row.partnerName}</strong>
                  <span>{row.partnerPhone}</span>
                  <span>Rating: {row.partnerRating}</span>
                </div>
              </div>
            ),
          },
          {
            key: 'assignmentStatus',
            label: 'Assignment',
            render: (value, row) => (
              <span
                className={`assignment-chip ${String(value).toLowerCase().includes('pending') ? 'pending' : 'assigned'}`}
              >
                {value} | {row.vehicleNumber}
              </span>
            ),
          },
          { key: 'origin', label: 'Origin' },
          { key: 'destination', label: 'Destination' },
          {
            key: 'status',
            label: 'Status',
            render: (value, row) => (
              <span className={`shipment-status ${row.isDelayed ? 'delayed' : 'active'}`}>{value}</span>
            ),
          },
          {
            key: 'liveTracking',
            label: 'Live Tracking',
            render: (value, row) => (
              <span className={`tracking-chip ${row.hasGps ? 'live' : 'offline'}`}>{value}</span>
            ),
          },
          { key: 'eta', label: 'ETA' },
          { key: 'weight', label: 'Weight (kg)' },
          {
            key: 'feedbackMessage',
            label: 'Transport Feedback',
            render: (value) => <span className="feedback-chip">{value}</span>,
          },
        ]}
        rows={filteredShipments}
        emptyMessage="No shipments found"
      />
    </section>
  )
}

export default Shipments
