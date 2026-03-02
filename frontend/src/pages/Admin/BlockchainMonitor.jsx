import { useEffect, useState } from 'react'
import { adminApi } from '../../api/axiosInstance'
import Loader from '../../components/common/Loader'
import Table from '../../components/common/Table'
import DashboardLayout from '../../components/layout/DashboardLayout'
import './../Admin/admin.css'

const DEFAULT_BLOCKCHAIN_STATS = {
  totalVerifications: 4523,
  successRate: 98.5,
  avgGasFee: 45,
  pendingTransactions: 12,
}

function Blockchain({ user, onLogout, onNavigate, currentPath }) {
  const [transactions, setTransactions] = useState([])
  const [stats, setStats] = useState(DEFAULT_BLOCKCHAIN_STATS)
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTx, setSelectedTx] = useState(null)
  const [verifyTxHash, setVerifyTxHash] = useState('')
  const [verifyMessage, setVerifyMessage] = useState('')

  useEffect(() => {
    let mounted = true
    async function fetchBlockchainData() {
      try {
        const response = await adminApi.blockchainTransactions()
        if (mounted) {
          setTransactions(response.transactions || getMockTransactions())
          setStats(response.stats || DEFAULT_BLOCKCHAIN_STATS)
        }
      } catch (error) {
        console.error('Error fetching blockchain data:', error)
        if (mounted) {
          setTransactions(getMockTransactions())
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetchBlockchainData()
    
    // Refresh every 10 seconds
    const interval = setInterval(fetchBlockchainData, 10000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  const getMockTransactions = () => [
    {
      id: 1,
      transactionHash: '0x7f9fade1c0d57a7af66ab4ead79fade1c0d57a7af66ab4ead7c2c2eb7b11a91385',
      productBatch: 'BATCH-2024-001',
      manufacturer: 'ABC Manufacturing',
      status: 'verified',
      blockNumber: 18234567,
      gasFee: 42,
      timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      productDetails: { name: 'Product A', quantity: 1000, category: 'Electronics' }
    },
    {
      id: 2,
      transactionHash: '0x8c1fade2d1e68b8bg77bc5fbe8efade2d1e68b8bg77bc5fbe8d3d3fc8c22b02496',
      productBatch: 'BATCH-2024-002',
      manufacturer: 'XYZ Industries',
      status: 'pending',
      blockNumber: null,
      gasFee: 0,
      timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      productDetails: { name: 'Product B', quantity: 500, category: 'Automotive' }
    },
    {
      id: 3,
      transactionHash: '0x9d2gbef3e2f79c9ch88cd6gcf9fgbef3e2f79c9ch88cd6gcf9e4e4gd9d33c13507',
      productBatch: 'BATCH-2024-003',
      manufacturer: 'Tech Corp',
      status: 'verified',
      blockNumber: 18234565,
      gasFee: 48,
      timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      productDetails: { name: 'Product C', quantity: 2000, category: 'Consumer Goods' }
    },
    {
      id: 4,
      transactionHash: '0xa3e3hcg4f3g80d0di99de7heg0ghcg4f3g80d0di99de7heg0gf5f5he0e44d24618',
      productBatch: 'BATCH-2024-004',
      manufacturer: 'Global Supplies',
      status: 'failed',
      blockNumber: null,
      gasFee: 0,
      timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      productDetails: { name: 'Product D', quantity: 750, category: 'Healthcare' }
    }
  ]

  const filteredTransactions = transactions.filter(tx => {
    const matchesStatus = filterStatus === 'all' || tx.status === filterStatus
    const matchesSearch = !searchTerm || 
      tx.transactionHash?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.productBatch?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.manufacturer?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesStatus && matchesSearch
  })

  const getStatusBadge = (status) => {
    const styles = {
      verified: { bg: '#dcfce7', color: '#166534', icon: '✅' },
      pending: { bg: '#fef3c7', color: '#92400e', icon: '⏳' },
      failed: { bg: '#fee2e2', color: '#991b1b', icon: '❌' }
    }
    const style = styles[status] || styles.pending
    return (
      <span style={{
        padding: '4px 12px',
        borderRadius: 9999,
        fontSize: 12,
        fontWeight: 600,
        background: style.bg,
        color: style.color
      }}>
        {style.icon} {status}
      </span>
    )
  }

  const handleVerifyTransaction = async (txHash) => {
    try {
      const result = await adminApi.verifyBlockchainTransaction(txHash)
      setVerifyMessage(result?.success ? 'Transaction verified successfully.' : 'Transaction hash not found in ledger.')
      // Refresh data
      const response = await adminApi.blockchainTransactions()
      setTransactions(response.transactions || transactions)
    } catch (error) {
      console.error('Error verifying transaction:', error)
      setVerifyMessage('Failed to verify transaction.')
    }
  }

  const dashboardStats = [
    { label: 'Total Verifications', value: stats.totalVerifications, trend: 'All-time' },
    { label: 'Success Rate', value: `${stats.successRate}%`, trend: 'Last 30 days' },
    { label: 'Avg Gas Fee', value: `${stats.avgGasFee} Gwei`, trend: 'Current' },
    { label: 'Pending', value: stats.pendingTransactions, trend: 'Active now' }
  ]

  const tableColumns = [
    { key: 'transactionHash', label: 'Transaction Hash' },
    { key: 'productBatch', label: 'Product Batch' },
    { key: 'manufacturer', label: 'Manufacturer' },
    { key: 'status', label: 'Status' },
    { key: 'timestamp', label: 'Timestamp' },
    { key: 'actions', label: 'Actions' }
  ]

  const tableRows = filteredTransactions.map(tx => ({
    transactionHash: (
      <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
        {tx.transactionHash?.substring(0, 16)}...
      </span>
    ),
    productBatch: <span style={{ fontWeight: 500 }}>{tx.productBatch}</span>,
    manufacturer: tx.manufacturer,
    status: getStatusBadge(tx.status),
    timestamp: new Date(tx.timestamp).toLocaleString(),
    actions: (
      <button
        onClick={() => setSelectedTx(tx)}
        style={{
          padding: '6px 12px',
          background: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 500
        }}
      >
        View Details
      </button>
    )
  }))

  if (loading) {
    return (
      <DashboardLayout
        role="Admin"
        themeClass="admin-theme"
        userName={user?.name}
        onLogout={onLogout}
        onNavigate={onNavigate}
        currentPath={currentPath}
        stats={dashboardStats}
      >
        <Loader label="Loading blockchain data..." />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout
      role="Admin"
      themeClass="admin-theme"
      userName={user?.name}
      onLogout={onLogout}
      onNavigate={onNavigate}
      currentPath={currentPath}
      stats={dashboardStats}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 'bold', margin: 0 }}>Blockchain Monitor</h2>
          <p style={{ color: '#6b7280', margin: '4px 0 0 0' }}>Real-time blockchain transaction tracking</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '8px 16px',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 500
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {/* Blockchain Network Status */}
      <section style={{ marginBottom: 24 }}>
        <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Blockchain Network Status</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div style={{ padding: 16, background: '#dcfce7', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 500 }}>
                <span>Network Status</span>
                <span style={{ color: '#166534', fontWeight: 'bold' }}>Online</span>
              </div>
            </div>
            <div style={{ padding: 16, background: '#dbeafe', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 500 }}>
                <span>Block Height</span>
                <span style={{ color: '#1e40af', fontWeight: 'bold' }}>18,234,567</span>
              </div>
            </div>
            <div style={{ padding: 16, background: '#f3e8ff', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 500 }}>
                <span>Gas Price</span>
                <span style={{ color: '#6b21a8', fontWeight: 'bold' }}>45 Gwei</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section style={{ marginBottom: 24 }}>
        <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Search</label>
              <input
                type="text"
                placeholder="Search by hash, batch, or manufacturer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  fontSize: 14
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Status Filter</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  fontSize: 14
                }}
              >
                <option value="all">All Status</option>
                <option value="verified">Verified</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 12 }}>
            <input
              type="text"
              placeholder="Verify by txHash..."
              value={verifyTxHash}
              onChange={(e) => setVerifyTxHash(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}
            />
            <button
              type="button"
              onClick={() => handleVerifyTransaction(verifyTxHash)}
              style={{
                padding: '8px 12px',
                border: 'none',
                borderRadius: 8,
                background: '#10b981',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Verify txHash
            </button>
          </div>
          {verifyMessage && (
            <p style={{ margin: '10px 0 0 0', fontSize: 13, color: '#1f2937' }}>{verifyMessage}</p>
          )}
        </div>
      </section>

      {/* Transactions Table */}
      <section>
        <Table
          columns={tableColumns}
          rows={tableRows}
          emptyMessage="No transactions found"
        />
      </section>

      {/* Transaction Details Modal */}
      {selectedTx && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50
          }}
          onClick={() => setSelectedTx(null)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: 12,
              padding: 24,
              maxWidth: 600,
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 20, fontWeight: 'bold', margin: 0 }}>Transaction Details</h3>
              <button
                onClick={() => setSelectedTx(null)}
                style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 4px 0' }}>Transaction Hash</p>
                  <p style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all', margin: 0 }}>
                    {selectedTx.transactionHash}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 4px 0' }}>Status</p>
                  {getStatusBadge(selectedTx.status)}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 4px 0' }}>Product Batch</p>
                  <p style={{ fontWeight: 600, margin: 0 }}>{selectedTx.productBatch}</p>
                </div>
                <div>
                  <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 4px 0' }}>Manufacturer</p>
                  <p style={{ fontWeight: 600, margin: 0 }}>{selectedTx.manufacturer}</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 4px 0' }}>Block Number</p>
                  <p style={{ fontFamily: 'monospace', margin: 0 }}>
                    {selectedTx.blockNumber || 'Pending'}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 4px 0' }}>Gas Fee</p>
                  <p style={{ fontWeight: 600, margin: 0 }}>{selectedTx.gasFee || 0} Gwei</p>
                </div>
              </div>

              <div>
                <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 4px 0' }}>Timestamp</p>
                <p style={{ margin: 0 }}>{new Date(selectedTx.timestamp).toLocaleString()}</p>
              </div>

              <div>
                <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 8px 0' }}>Product Details</p>
                <div style={{ background: '#f9fafb', borderRadius: 8, padding: 12 }}>
                  <pre style={{ fontSize: 12, margin: 0, overflow: 'auto' }}>
                    {JSON.stringify(selectedTx.productDetails, null, 2)}
                  </pre>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, paddingTop: 16 }}>
                <button
                  onClick={() => window.open(`https://etherscan.io/tx/${selectedTx.transactionHash}`, '_blank')}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontWeight: 500
                  }}
                >
                  View on Etherscan
                </button>
                {selectedTx.status === 'pending' && (
                  <button
                    onClick={() => handleVerifyTransaction(selectedTx.transactionHash)}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      background: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontWeight: 500
                    }}
                  >
                    Force Verify
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}

export default Blockchain
