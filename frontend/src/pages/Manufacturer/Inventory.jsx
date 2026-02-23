import { useMemo, useState } from 'react'
import PieChart from '../../components/charts/PieChart'
import Table from '../../components/common/Table'

function normalizeProducts(products = []) {
  return products.map((item, index) => {
    const sku = item.sku || item.id || `SKU-${index + 1}`
    const stockLevel = Number(item.quantity ?? item.stock ?? item.currentStock ?? 0)
    const reorderPoint = Number(item.reorderLevel ?? item.minStock ?? Math.max(50, Math.floor(stockLevel * 0.4)))
    const status =
      stockLevel <= Math.max(15, Math.floor(reorderPoint * 0.4))
        ? 'critical'
        : stockLevel <= reorderPoint
          ? 'low'
          : 'adequate'

    return {
      sku,
      productName: item.name || item.productName || `Product ${index + 1}`,
      category: item.category || 'Medical Supplies',
      rawMaterial: item.rawMaterial || 'Composite Medical Polymer',
      stockLevel,
      reorderPoint,
      unitCost: Number(item.price ?? item.unitCost ?? 0),
      status: item.status || status,
    }
  })
}

const mockInventory = [
  {
    sku: 'N95-KIT',
    productName: 'N95 Safety Kit',
    category: 'PPE',
    rawMaterial: 'Polypropylene',
    stockLevel: 1200,
    reorderPoint: 500,
    unitCost: 42.5,
    status: 'adequate',
  },
  {
    sku: 'IV-SET',
    productName: 'IV Set',
    category: 'Medical Supplies',
    rawMaterial: 'Medical Grade PVC',
    stockLevel: 760,
    reorderPoint: 400,
    unitCost: 15.0,
    status: 'adequate',
  },
]

function Inventory({ products = [] }) {
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  const displayInventory = useMemo(() => {
    const normalized = normalizeProducts(products)
    return normalized.length ? normalized : mockInventory
  }, [products])

  const filteredInventory = displayInventory
    .filter((item) => {
      if (filter === 'all') return true
      if (filter === 'low') return item.status === 'low' || item.status === 'critical'
      if (filter === 'adequate') return item.status === 'adequate'
      return true
    })
    .filter((item) =>
      [item.productName, item.sku, item.category]
        .join(' ')
        .toLowerCase()
        .includes(searchTerm.toLowerCase()),
    )

  const categoryDistribution = Object.entries(
    displayInventory.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1
      return acc
    }, {}),
  ).map(([label, value], index) => ({
    label,
    value,
    color: ['#0ea5e9', '#22c55e', '#f59e0b', '#a855f7'][index % 4],
  }))

  return (
    <div className="inventory-container">
      <div className="inventory-grid">
        <div className="inventory-main">
          <div className="card">
            <div className="inventory-header">
              <h4 className="card-title">Raw Material Inventory</h4>
              <div className="inventory-controls">
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search inventory..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <div className="filter-buttons">
                  <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
                    All
                  </button>
                  <button
                    className={`filter-btn ${filter === 'adequate' ? 'active' : ''}`}
                    onClick={() => setFilter('adequate')}
                  >
                    Adequate
                  </button>
                  <button className={`filter-btn ${filter === 'low' ? 'active' : ''}`} onClick={() => setFilter('low')}>
                    Low Stock
                  </button>
                </div>
              </div>
            </div>

            <Table
              columns={[
                { key: 'sku', label: 'SKU' },
                { key: 'productName', label: 'Product' },
                { key: 'category', label: 'Category' },
                { key: 'rawMaterial', label: 'Raw Material' },
                { key: 'stockLevel', label: 'Stock Level' },
                { key: 'reorderPoint', label: 'Reorder Point' },
                {
                  key: 'unitCost',
                  label: 'Unit Cost',
                  render: (value) => `$${Number(value).toFixed(2)}`,
                },
              ]}
              rows={filteredInventory}
              emptyMessage="No inventory found"
            />
          </div>
        </div>

        <div className="inventory-sidebar">
          <PieChart title="Category Distribution" data={categoryDistribution} />
        </div>
      </div>
    </div>
  )
}

export default Inventory
