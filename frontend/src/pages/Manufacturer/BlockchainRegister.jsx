import { useState } from 'react'
import BlockchainBadge from '../../components/blockchain/BlockchainBadge'
import Table from '../../components/common/Table'

function BlockchainRegister({ batches = [] }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [showRegisterForm, setShowRegisterForm] = useState(false)
  const [newRegistration, setNewRegistration] = useState({
    batchId: '',
    productName: '',
    quantity: '',
  })

  const mockBlockchainData = [
    {
      batchId: 'BATCH-2024-001',
      productName: 'N95 Mask Box (50pcs)',
      quantity: 500,
      blockchainHash: '0x7a8f9b2c...3d4e5f6a',
      timestamp: '2024-02-14 10:32:15',
      verified: true,
      transactionId: 'TXN-BC-001',
    },
    {
      batchId: 'BATCH-2024-002',
      productName: 'IV Set Standard',
      quantity: 300,
      blockchainHash: '0x2b3c4d5e...6f7a8b9c',
      timestamp: '2024-02-15 14:22:48',
      verified: true,
      transactionId: 'TXN-BC-002',
    },
    {
      batchId: 'BATCH-2024-003',
      productName: 'Disposable Syringe 10ml',
      quantity: 1000,
      blockchainHash: 'Pending...',
      timestamp: '--',
      verified: false,
      transactionId: '--',
    },
    {
      batchId: 'BATCH-2024-004',
      productName: 'Nitrile Gloves (100pcs)',
      quantity: 800,
      blockchainHash: '0x4d5e6f7a...8b9c0d1e',
      timestamp: '2024-02-12 09:15:33',
      verified: true,
      transactionId: 'TXN-BC-004',
    },
  ]

  const displayData = batches.length > 0
    ? batches.map((b, i) => ({
        ...mockBlockchainData[i % mockBlockchainData.length],
        batchId: b.batchId || b.batch_id,
      }))
    : mockBlockchainData

  const filteredData = displayData.filter((item) =>
    item.batchId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.transactionId.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const blockchainStats = {
    total: displayData.length,
    verified: displayData.filter((d) => d.verified).length,
    pending: displayData.filter((d) => !d.verified).length,
  }

  const handleRegister = (e) => {
    e.preventDefault()
    alert(`Registering on blockchain:\n${JSON.stringify(newRegistration, null, 2)}`)
    setShowRegisterForm(false)
    setNewRegistration({ batchId: '', productName: '', quantity: '' })
  }

  return (
    <div className="blockchain-container">
      {/* Blockchain Stats */}
      <div className="blockchain-stats">
        <div className="stat-card stat-total">
          <span className="stat-value">{blockchainStats.total}</span>
          <span className="stat-label">Total Registered</span>
        </div>
        <div className="stat-card stat-verified">
          <span className="stat-value">{blockchainStats.verified}</span>
          <span className="stat-label">Verified</span>
        </div>
        <div className="stat-card stat-pending">
          <span className="stat-value">{blockchainStats.pending}</span>
          <span className="stat-label">Pending</span>
        </div>
      </div>

      {/* Blockchain Info Card */}
      <div className="card blockchain-info-card">
        <div className="blockchain-info-header">
          <div className="blockchain-icon-large">🔗</div>
          <div>
            <h4 className="card-title">Blockchain Registration</h4>
            <p className="blockchain-description">
              Secure, immutable records of all manufactured batches on the blockchain network
            </p>
          </div>
        </div>
      </div>

      {/* Blockchain Registry Table */}
      <div className="card">
        <div className="blockchain-header">
          <h4 className="card-title">Blockchain Registry</h4>
          <div className="blockchain-controls">
            <input
              type="text"
              className="search-input"
              placeholder="Search blockchain records..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button
              className="btn-register"
              onClick={() => setShowRegisterForm(!showRegisterForm)}
            >
              + Register Batch
            </button>
          </div>
        </div>

        {showRegisterForm && (
          <form className="register-form" onSubmit={handleRegister}>
            <input
              type="text"
              placeholder="Batch ID"
              value={newRegistration.batchId}
              onChange={(e) =>
                setNewRegistration({ ...newRegistration, batchId: e.target.value })
              }
              required
            />
            <input
              type="text"
              placeholder="Product Name"
              value={newRegistration.productName}
              onChange={(e) =>
                setNewRegistration({ ...newRegistration, productName: e.target.value })
              }
              required
            />
            <input
              type="number"
              placeholder="Quantity"
              value={newRegistration.quantity}
              onChange={(e) =>
                setNewRegistration({ ...newRegistration, quantity: e.target.value })
              }
              required
            />
            <button type="submit" className="btn-submit">
              Register on Blockchain
            </button>
            <button
              type="button"
              className="btn-cancel"
              onClick={() => setShowRegisterForm(false)}
            >
              Cancel
            </button>
          </form>
        )}

        <Table
          columns={[
            { key: 'batchId', label: 'Batch ID' },
            { key: 'productName', label: 'Product' },
            { key: 'quantity', label: 'Quantity' },
            { key: 'blockchainHash', label: 'Blockchain Hash' },
            { key: 'timestamp', label: 'Timestamp' },
            { key: 'transactionId', label: 'Transaction ID' },
            {
              key: 'verified',
              label: 'Status',
              render: (value) =>
                value ? (
                  <BlockchainBadge label="Verified" />
                ) : (
                  <span className="badge-pending">Pending</span>
                ),
            },
          ]}
          rows={filteredData}
          emptyMessage="No blockchain records found"
        />
      </div>
    </div>
  )
}

export default BlockchainRegister