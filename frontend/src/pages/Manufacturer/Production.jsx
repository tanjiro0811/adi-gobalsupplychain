import { useState } from 'react'
import Table from '../../components/common/Table'

function Production({ batches = [] }) {
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddBatch, setShowAddBatch] = useState(false)
  const [newBatch, setNewBatch] = useState({
    productName: '',
    quantity: '',
    batchNumber: '',
  })

  const mockProduction = [
    {
      batchId: 'BATCH-2024-001',
      sku: 'N95-MASK-50',
      productName: 'N95 Mask Box (50pcs)',
      quantity: 500,
      status: 'completed',
      startDate: '2024-02-10',
      endDate: '2024-02-14',
      qcStatus: 'passed',
    },
    {
      batchId: 'BATCH-2024-002',
      sku: 'IV-SET-STD',
      productName: 'IV Set Standard',
      quantity: 300,
      status: 'in-progress',
      startDate: '2024-02-15',
      endDate: '--',
      qcStatus: 'pending',
    },
    {
      batchId: 'BATCH-2024-003',
      sku: 'SYRINGE-10ML',
      productName: 'Disposable Syringe 10ml',
      quantity: 1000,
      status: 'in-progress',
      startDate: '2024-02-14',
      endDate: '--',
      qcStatus: 'pending',
    },
    {
      batchId: 'BATCH-2024-004',
      sku: 'GLOVE-NITRILE',
      productName: 'Nitrile Gloves (100pcs)',
      quantity: 800,
      status: 'completed',
      startDate: '2024-02-08',
      endDate: '2024-02-12',
      qcStatus: 'passed',
    },
    {
      batchId: 'BATCH-2024-005',
      sku: 'BANDAGE-ADHV',
      productName: 'Adhesive Bandages (100pcs)',
      quantity: 600,
      status: 'quality-check',
      startDate: '2024-02-11',
      endDate: '2024-02-15',
      qcStatus: 'in-review',
    },
  ]

  const displayProduction = batches.length > 0 
    ? batches.map((b, i) => ({
        ...mockProduction[i % mockProduction.length],
        batchId: b.batchId || b.batch_id,
        sku: b.sku || b.product_sku,
        status: b.status,
      }))
    : mockProduction

  const filteredProduction = displayProduction
    .filter((item) => {
      if (filter === 'all') return true
      if (filter === 'in-progress') return item.status === 'in-progress'
      if (filter === 'completed') return item.status === 'completed'
      if (filter === 'quality-check') return item.status === 'quality-check'
      return true
    })
    .filter((item) =>
      item.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.batchId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku?.toLowerCase().includes(searchTerm.toLowerCase())
    )

  const productionStats = {
    total: displayProduction.length,
    inProgress: displayProduction.filter((p) => p.status === 'in-progress').length,
    completed: displayProduction.filter((p) => p.status === 'completed').length,
    qualityCheck: displayProduction.filter((p) => p.status === 'quality-check').length,
  }

  const handleAddBatch = (e) => {
    e.preventDefault()
    alert(`New batch created:\n${JSON.stringify(newBatch, null, 2)}`)
    setShowAddBatch(false)
    setNewBatch({ productName: '', quantity: '', batchNumber: '' })
  }

  return (
    <div className="production-container">
      {/* Production Stats */}
      <div className="production-stats">
        <div className="stat-card stat-total">
          <span className="stat-value">{productionStats.total}</span>
          <span className="stat-label">Total Batches</span>
        </div>
        <div className="stat-card stat-in-progress">
          <span className="stat-value">{productionStats.inProgress}</span>
          <span className="stat-label">In Progress</span>
        </div>
        <div className="stat-card stat-completed">
          <span className="stat-value">{productionStats.completed}</span>
          <span className="stat-label">Completed</span>
        </div>
        <div className="stat-card stat-quality">
          <span className="stat-value">{productionStats.qualityCheck}</span>
          <span className="stat-label">Quality Check</span>
        </div>
      </div>

      {/* Production Table */}
      <div className="card">
        <div className="production-header">
          <h4 className="card-title">Production Batches</h4>
          <div className="production-controls">
            <input
              type="text"
              className="search-input"
              placeholder="Search batches..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="filter-buttons">
              <button
                className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                All
              </button>
              <button
                className={`filter-btn ${filter === 'in-progress' ? 'active' : ''}`}
                onClick={() => setFilter('in-progress')}
              >
                In Progress
              </button>
              <button
                className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
                onClick={() => setFilter('completed')}
              >
                Completed
              </button>
              <button
                className={`filter-btn ${filter === 'quality-check' ? 'active' : ''}`}
                onClick={() => setFilter('quality-check')}
              >
                QC
              </button>
            </div>
            <button
              className="btn-add-batch"
              onClick={() => setShowAddBatch(!showAddBatch)}
            >
              + New Batch
            </button>
          </div>
        </div>

        {showAddBatch && (
          <form className="add-batch-form" onSubmit={handleAddBatch}>
            <input
              type="text"
              placeholder="Product Name"
              value={newBatch.productName}
              onChange={(e) => setNewBatch({ ...newBatch, productName: e.target.value })}
              required
            />
            <input
              type="number"
              placeholder="Quantity"
              value={newBatch.quantity}
              onChange={(e) => setNewBatch({ ...newBatch, quantity: e.target.value })}
              required
            />
            <input
              type="text"
              placeholder="Batch Number"
              value={newBatch.batchNumber}
              onChange={(e) => setNewBatch({ ...newBatch, batchNumber: e.target.value })}
              required
            />
            <button type="submit" className="btn-submit">Create Batch</button>
            <button
              type="button"
              className="btn-cancel"
              onClick={() => setShowAddBatch(false)}
            >
              Cancel
            </button>
          </form>
        )}

        <Table
          columns={[
            { key: 'batchId', label: 'Batch ID' },
            { key: 'sku', label: 'SKU' },
            { key: 'productName', label: 'Product' },
            { key: 'quantity', label: 'Quantity' },
            {
              key: 'status',
              label: 'Status',
              render: (value) => (
                <span className={`status-badge status-${value}`}>
                  {value.replace('-', ' ')}
                </span>
              ),
            },
            { key: 'startDate', label: 'Start Date' },
            { key: 'endDate', label: 'End Date' },
            {
              key: 'qcStatus',
              label: 'QC Status',
              render: (value) => (
                <span className={`qc-badge qc-${value}`}>
                  {value}
                </span>
              ),
            },
          ]}
          rows={filteredProduction}
          emptyMessage="No production batches found"
        />
      </div>
    </div>
  )
}

export default Production