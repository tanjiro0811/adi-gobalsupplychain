import { useState } from 'react'
import Table from '../../components/common/Table'

function FleetManager({ shipments = {} }) {
  const [filter, setFilter] = useState('all')

  const vehicles = Object.entries(shipments).map(([id, item]) => ({
    id,
    vehicle: id,
    driver: item.driver ?? 'Unassigned',
    status: String(item.status ?? 'unknown'),
    location: `${item.lat?.toFixed?.(2) ?? 0}, ${item.lng?.toFixed?.(2) ?? 0}`,
    lastUpdate: item.timestamp ?? '--',
  }))

  const filteredVehicles = vehicles.filter((v) => {
    if (filter === 'all') return true
    if (filter === 'active') return v.status.toLowerCase().includes('in transit')
    if (filter === 'delayed') return v.status.toLowerCase().includes('delay')
    return true
  })

  return (
    <section className="card fleet-manager-container">
      <div className="fleet-manager-header">
        <h4 className="card-title">Fleet Manager</h4>
        <div className="fleet-filters">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({vehicles.length})
          </button>
          <button
            className={`filter-btn ${filter === 'active' ? 'active' : ''}`}
            onClick={() => setFilter('active')}
          >
            Active
          </button>
          <button
            className={`filter-btn ${filter === 'delayed' ? 'active' : ''}`}
            onClick={() => setFilter('delayed')}
          >
            Delayed
          </button>
        </div>
      </div>
      <Table
        columns={[
          { key: 'vehicle', label: 'Vehicle ID' },
          { key: 'driver', label: 'Driver' },
          { key: 'status', label: 'Status' },
          { key: 'location', label: 'Location' },
          { key: 'lastUpdate', label: 'Last Update' },
        ]}
        rows={filteredVehicles}
        emptyMessage="No vehicles found"
      />
    </section>
  )
}

export default FleetManager