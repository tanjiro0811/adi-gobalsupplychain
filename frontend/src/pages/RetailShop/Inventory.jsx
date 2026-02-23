import { useState } from 'react'
import Table from '../../components/common/Table'
import BlockchainBadge from '../../components/blockchain/BlockchainBadge'

function Inventory({ products = [] }) {
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('name')

  const mockInventory = [
    {
      id: 'N95-001',
      name: 'N95 Mask Box (50pcs)',
      category: 'PPE',
      stock: 120,
      reorderLevel: 50,
      price: 45.99,
      verified: true,
      status: 'in-stock',
    },
    {
      id: 'IV-002',
      name: 'IV Set Standard',
      category: 'Medical Supplies',
      stock: 34,
      reorderLevel: 40,
      price: 12.50,
      verified: true,
      status: 'low-stock',
    },
    {
      id: 'CARE-003',
      name: 'Home Care Kit',
      category: 'Kits',
      stock: 12,
      reorderLevel: 20,
      price: 89.99,
      verified: false,
      status: 'low-stock',
    },
    {
      id: 'GLOVE-004',
      name: 'Nitrile Gloves (100pcs)',
      category: 'PPE',
      stock: 78,
      reorderLevel: 60,
      price: 24.99,
      verified: true,
      status: 'in-stock',
    },
    {
      id: 'THERM-005',
      name: 'Digital Thermometer',
      category: 'Diagnostics',
      stock: 45,
      reorderLevel: 30,
      price: 15.99,
      verified: true,
      status: 'in-stock',
    },
    {
      id: 'BAND-006',
      name: 'Adhesive Bandages (100pcs)',
      category: 'First Aid',
      stock: 5,
      reorderLevel: 25,
      price: 8.99,
      verified: true,
      status: 'critical',
    },
  ]

  const displayInventory = products.length > 0 ? products : mockInventory

  const filteredInventory = displayInventory
    .filter((item) => {
      if (filter === 'all') return true
      if (filter === 'low-stock') return item.status === 'low-stock' || item.status === 'critical'
      if (filter === 'verified') return item.verified
      return true
    })
    .filter((item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'stock') return b.stock - a.stock
      if (sortBy === 'price') return b.price - a.price
      return 0
    })

  const stockStats = {
    total: displayInventory.length,
    inStock: displayInventory.filter((i) => i.status === 'in-stock').length,
    lowStock: displayInventory.filter((i) => i.status === 'low-stock').length,
    critical: displayInventory.filter((i) => i.status === 'critical').length,
  }

  return (
    <div className="inventory-container">
      {/* Inventory Stats */}
      <div className="inventory-stats">
        <div className="stat-card stat-total">
          <span className="stat-value">{stockStats.total}</span>
          <span className="stat-label">Total Products</span>
        </div>
        <div className="stat-card stat-in-stock">
          <span className="stat-value">{stockStats.inStock}</span>
          <span className="stat-label">In Stock</span>
        </div>
        <div className="stat-card stat-low-stock">
          <span className="stat-value">{stockStats.lowStock}</span>
          <span className="stat-label">Low Stock</span>
        </div>
        <div className="stat-card stat-critical">
          <span className="stat-value">{stockStats.critical}</span>
          <span className="stat-label">Critical</span>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="card">
        <div className="inventory-header">
          <h4 className="card-title">Product Inventory</h4>
          <div className="inventory-controls">
            <input
              type="text"
              className="search-input"
              placeholder="Search inventory..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select
              className="sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="name">Sort by Name</option>
              <option value="stock">Sort by Stock</option>
              <option value="price">Sort by Price</option>
            </select>
            <div className="filter-buttons">
              <button
                className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                All
              </button>
              <button
                className={`filter-btn ${filter === 'low-stock' ? 'active' : ''}`}
                onClick={() => setFilter('low-stock')}
              >
                Low Stock
              </button>
              <button
                className={`filter-btn ${filter === 'verified' ? 'active' : ''}`}
                onClick={() => setFilter('verified')}
              >
                Verified
              </button>
            </div>
          </div>
        </div>

        <Table
          columns={[
            { key: 'id', label: 'SKU' },
            { key: 'name', label: 'Product Name' },
            { key: 'category', label: 'Category' },
            {
              key: 'stock',
              label: 'Stock',
              render: (value, row) => (
                <span className={`stock-badge stock-${row.status}`}>
                  {value} units
                </span>
              ),
            },
            { key: 'reorderLevel', label: 'Reorder Level' },
            {
              key: 'price',
              label: 'Price',
              render: (value) => `$${value.toFixed(2)}`,
            },
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
          rows={filteredInventory}
          emptyMessage="No products found"
        />
      </div>
    </div>
  )
}

export default Inventory