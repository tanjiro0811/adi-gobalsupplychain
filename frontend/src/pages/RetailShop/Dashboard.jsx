import { useEffect, useState } from 'react'
import { inventoryApi } from '../../api/axiosInstance'
import BlockchainBadge from '../../components/blockchain/BlockchainBadge'
import PieChart from '../../components/charts/PieChart'
import Table from '../../components/common/Table'
import DashboardLayout from '../../components/layout/DashboardLayout'
import POS from './POS'
import Scanner from './Scanner'
import Inventory from './Inventory'
import Sales from './Sales'
import './retail.css'

function RetailShopDashboard({
  user,
  onLogout,
  onNavigate,
  currentPath,
  initialView = 'overview',
}) {
  const [products, setProducts] = useState([])
  const [salesData, setSalesData] = useState([])
  const [activeView, setActiveView] = useState(initialView) // overview, pos, scanner, inventory, sales

  useEffect(() => {
    let mounted = true

    async function loadRetailData() {
      try {
        const data = await inventoryApi.getInventory()
        if (mounted) {
          setProducts(data?.products ?? [])
          setSalesData(data?.sales ?? [])
        }
      } catch (error) {
        console.error('Failed to load retail data:', error)
      }
    }

    loadRetailData()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    setActiveView(initialView)
  }, [initialView])

  const rows = [
    { sku: 'N95-Box', sold: 32, stock: 120, verify: 'Verified' },
    { sku: 'IV-Set', sold: 11, stock: 34, verify: 'Verified' },
    { sku: 'Care Kit', sold: 5, stock: 12, verify: 'Pending' },
  ]

  const stats = [
    { label: 'Store Sales Today', value: '$3,940', trend: '+7.4%' },
    { label: 'Customer Orders', value: 46, trend: '+5' },
    { label: 'Low Stock Alerts', value: 4, trend: '-1' },
    { label: 'Verified Products', value: 129, trend: '+22' },
    { label: 'Returns', value: 2, trend: 'Stable' },
  ]

  return (
    <DashboardLayout
      role="RetailShop"
      themeClass="retail-theme"
      userName={user?.name}
      onLogout={onLogout}
      onNavigate={onNavigate}
      currentPath={currentPath}
      stats={stats}
      notifications={4}
    >
      {/* Navigation Tabs */}
      {/* Overview View */}
      {activeView === 'overview' && (
        <>
          <div style={{ marginBottom: 12 }}>
            <BlockchainBadge />
          </div>
          <section style={{ display: 'grid', gap: 12, gridTemplateColumns: '2fr 1fr' }}>
            <Table
              columns={[
                { key: 'sku', label: 'Product' },
                { key: 'sold', label: 'Sold' },
                { key: 'stock', label: 'In Stock' },
                {
                  key: 'verify',
                  label: 'Verification',
                  render: (value) =>
                    value === 'Verified' ? (
                      <BlockchainBadge label="Verified" />
                    ) : (
                      <span>{value}</span>
                    ),
                },
              ]}
              rows={rows}
              emptyMessage="No retail data"
            />
            <PieChart
              title="Sales Mix"
              data={[
                { label: 'N95-Box', value: 32, color: '#0ea5e9' },
                { label: 'IV-Set', value: 11, color: '#22c55e' },
                { label: 'Care Kit', value: 5, color: '#f59e0b' },
              ]}
            />
          </section>
        </>
      )}

      {/* POS View */}
      {activeView === 'pos' && <POS products={products} />}

      {/* Scanner View */}
      {activeView === 'scanner' && <Scanner />}

      {/* Inventory View */}
      {activeView === 'inventory' && <Inventory products={products} />}

      {/* Sales View */}
      {activeView === 'sales' && <Sales salesData={salesData} />}
    </DashboardLayout>
  )
}

export default RetailShopDashboard  
