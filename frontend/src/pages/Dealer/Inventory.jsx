import { useEffect, useState } from 'react'
import { dealerApi } from '../../api/axiosInstance'
import StatusDonut from '../../components/charts/StatusDonut'
import Table from '../../components/common/Table'
import Loader from '../../components/common/Loader'
import DashboardLayout from '../../components/layout/DashboardLayout'
import './dealer.css'

function Inventory({ user, onLogout, onNavigate, currentPath }) {
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [stockFilter, setStockFilter] = useState('all')

  const stats = [
    { label: 'Total SKUs', value: 156, trend: '+12 this month' },
    { label: 'In Stock', value: 128, trend: '82% availability' },
    { label: 'Low Stock', value: 19, trend: 'Need reorder' },
    { label: 'Stock Value', value: '$142K', trend: '+8%' },
  ]

  useEffect(() => {
    let mounted = true
    async function loadInventory() {
      try {
        const response = await dealerApi.inventory()
        if (mounted) {
          setInventory(response.items || getMockInventory())
        }
      } catch (error) {
        console.error('Error loading inventory:', error)
        if (mounted) {
          setInventory(getMockInventory())
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }
    loadInventory()
    return () => { mounted = false }
  }, [])

  const getMockInventory = () => [
    {
      id: 1,
      sku: 'MED-001',
      productName: 'Paracetamol 500mg',
      category: 'Medicines',
      manufacturer: 'ABC Pharma',
      currentStock: 1500,
      minStock: 500,
      maxStock: 2000,
      unitPrice: 12.50,
      stockStatus: 'In Stock',
      lastRestocked: '2026-02-10'
    },
    {
      id: 2,
      sku: 'SUR-002',
      productName: 'Surgical Gloves',
      category: 'Surgical Supplies',
      manufacturer: 'MediTech Inc',
      currentStock: 300,
      minStock: 400,
      maxStock: 1000,
      unitPrice: 45.00,
      stockStatus: 'Low Stock',
      lastRestocked: '2026-02-05'
    },
    {
      id: 3,
      sku: 'LAB-003',
      productName: 'Test Tubes (Box)',
      category: 'Lab Equipment',
      manufacturer: 'Lab Solutions',
      currentStock: 0,
      minStock: 50,
      maxStock: 200,
      unitPrice: 85.00,
      stockStatus: 'Out of Stock',
      lastRestocked: '2026-01-28'
    },
    {
      id: 4,
      sku: 'MED-004',
      productName: 'Insulin Injection',
      category: 'Medicines',
      manufacturer: 'Global Health',
      currentStock: 850,
      minStock: 300,
      maxStock: 1000,
      unitPrice: 125.00,
      stockStatus: 'In Stock',
      lastRestocked: '2026-02-12'
    },
    {
      id: 5,
      sku: 'DEV-005',
      productName: 'Blood Pressure Monitor',
      category: 'Medical Devices',
      manufacturer: 'HealthTech Corp',
      currentStock: 420,
      minStock: 500,
      maxStock: 800,
      unitPrice: 340.00,
      stockStatus: 'Low Stock',
      lastRestocked: '2026-02-08'
    },
  ]

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = !searchTerm ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.manufacturer.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter
    const matchesStock = stockFilter === 'all' || item.stockStatus === stockFilter
    return matchesSearch && matchesCategory && matchesStock
  })

  const getStockBadge = (status) => {
    const styles = {
      'In Stock': { bg: '#dcfce7', color: '#166534', icon: '✓' },
      'Low Stock': { bg: '#fef3c7', color: '#92400e', icon: '⚠' },
      'Out of Stock': { bg: '#fee2e2', color: '#991b1b', icon: '✗' }
    }
    const style = styles[status] || styles['In Stock']
    return (
      <span style={{
        padding: '4px 12px',
        borderRadius: 9999,
        fontSize: 12,
        fontWeight: 600,
        background: style.bg,
        color: style.color,
      }}>
        {style.icon} {status}
      </span>
    )
  }

  const getStockPercentage = (current, max) => {
    return Math.round((current / max) * 100)
  }

  const stockStatusData = [
    { label: 'In Stock', value: inventory.filter(i => i.stockStatus === 'In Stock').length, color: '#22c55e' },
    { label: 'Low Stock', value: inventory.filter(i => i.stockStatus === 'Low Stock').length, color: '#f59e0b' },
    { label: 'Out of Stock', value: inventory.filter(i => i.stockStatus === 'Out of Stock').length, color: '#ef4444' },
  ]

  const categories = ['all', ...new Set(inventory.map(i => i.category))]

  const handleExportInventory = () => {
    const csvContent = [
      ['SKU', 'Product', 'Category', 'Manufacturer', 'Stock', 'Min', 'Max', 'Price', 'Status'],
      ...filteredInventory.map(item => [
        item.sku,
        item.productName,
        item.category,
        item.manufacturer,
        item.currentStock,
        item.minStock,
        item.maxStock,
        `$${item.unitPrice}`,
        item.stockStatus
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inventory_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const inventoryRows = filteredInventory.map(item => ({
    sku: <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{item.sku}</span>,
    productName: item.productName,
    category: <span style={{ fontSize: 12, color: '#6b7280' }}>{item.category}</span>,
    stock: (
      <div style={{ minWidth: 120 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
          <span style={{ fontWeight: 600 }}>{item.currentStock}</span>
          <span style={{ color: '#6b7280' }}>/ {item.maxStock}</span>
        </div>
        <div style={{ width: '100%', height: 6, background: '#e5e7eb', borderRadius: 9999, overflow: 'hidden' }}>
          <div
            style={{
              width: `${getStockPercentage(item.currentStock, item.maxStock)}%`,
              height: '100%',
              background: item.stockStatus === 'In Stock' ? '#22c55e' : 
                          item.stockStatus === 'Low Stock' ? '#f59e0b' : '#ef4444',
              borderRadius: 9999,
            }}
          ></div>
        </div>
      </div>
    ),
    unitPrice: <span style={{ fontWeight: 600 }}>${item.unitPrice.toFixed(2)}</span>,
    totalValue: <span style={{ fontWeight: 600, color: '#10b981' }}>
      ${(item.currentStock * item.unitPrice).toLocaleString()}
    </span>,
    status: getStockBadge(item.stockStatus),
  }))

  if (loading) {
    return (
      <DashboardLayout
        role="Dealer"
        themeClass="dealer-theme"
        userName={user?.name}
        onLogout={onLogout}
        onNavigate={onNavigate}
        currentPath={currentPath}
        stats={stats}
      >
        <Loader label="Loading inventory..." />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout
      role="Dealer"
      themeClass="dealer-theme"
      userName={user?.name}
      onLogout={onLogout}
      onNavigate={onNavigate}
      currentPath={currentPath}
      stats={stats}
    >
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 'bold', margin: 0 }}>Inventory Management</h2>
        <p style={{ color: '#6b7280', margin: '4px 0 0 0' }}>
          Monitor and manage your product stock levels
        </p>
      </div>

      {/* Stock Status Overview */}
      <section style={{ display: 'grid', gap: 24, gridTemplateColumns: '2fr 1fr', marginBottom: 24 }}>
        {/* Filters */}
        <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
                Search Products
              </label>
              <input
                type="text"
                placeholder="Search by SKU, product name, or manufacturer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  fontSize: 14,
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
                Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  fontSize: 14,
                }}
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat === 'all' ? 'All Categories' : cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
                Stock Status
              </label>
              <select
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  fontSize: 14,
                }}
              >
                <option value="all">All Status</option>
                <option value="In Stock">In Stock</option>
                <option value="Low Stock">Low Stock</option>
                <option value="Out of Stock">Out of Stock</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
            <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>
              Showing {filteredInventory.length} of {inventory.length} items
            </p>
            <button
              onClick={handleExportInventory}
              style={{
                fontSize: 14,
                color: '#3b82f6',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              📥 Export to CSV
            </button>
          </div>
        </div>

        {/* Stock Status Donut */}
        <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <StatusDonut
            data={stockStatusData}
            height={200}
          />
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stockStatusData.map((item, index) => (
              <div key={index} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: item.color }}></div>
                  <span>{item.label}</span>
                </div>
                <span style={{ fontWeight: 600 }}>{item.value} SKUs</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Low Stock Alert */}
      {inventory.filter(i => i.stockStatus === 'Low Stock' || i.stockStatus === 'Out of Stock').length > 0 && (
        <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 12, padding: 16, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'start', gap: 12 }}>
            <span style={{ fontSize: 24 }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <h4 style={{ margin: '0 0 4px 0', color: '#92400e', fontWeight: 600 }}>
                Stock Alert
              </h4>
              <p style={{ margin: 0, fontSize: 14, color: '#78350f' }}>
                {inventory.filter(i => i.stockStatus === 'Low Stock').length} items are low on stock and{' '}
                {inventory.filter(i => i.stockStatus === 'Out of Stock').length} items are out of stock.
              </p>
            </div>
            <button
              style={{
                padding: '8px 16px',
                background: '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                fontWeight: 500,
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              Create Restock Order
            </button>
          </div>
        </div>
      )}

      {/* Inventory Table */}
      <div style={{ background: 'white', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <Table
          columns={[
            { key: 'sku', label: 'SKU' },
            { key: 'productName', label: 'Product Name' },
            { key: 'category', label: 'Category' },
            { key: 'stock', label: 'Stock Level' },
            { key: 'unitPrice', label: 'Unit Price' },
            { key: 'totalValue', label: 'Total Value' },
            { key: 'status', label: 'Status' },
          ]}
          rows={inventoryRows}
          emptyMessage="No inventory items found"
        />
      </div>
    </DashboardLayout>
  )
}

export default Inventory
