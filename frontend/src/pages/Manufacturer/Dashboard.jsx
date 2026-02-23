import { useEffect, useMemo, useState } from 'react'
import { manufacturerApi } from '../../api/axiosInstance'
import AreaChart from '../../components/charts/AreaChart'
import Loader from '../../components/common/Loader'
import Table from '../../components/common/Table'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { forecastDemand } from '../../features/ai-engine'
import Production from './Production'
import Inventory from './Inventory'
import BlockchainRegister from './BlockchainRegister'
import Analytics from './Analytics'
import './manufacturer.css'

const productionHistory = [120, 132, 140, 155, 161, 169]
const projected = forecastDemand(productionHistory, 3)

function ManufacturerDashboard({
  user,
  onLogout,
  onNavigate,
  currentPath,
  initialView = 'overview',
}) {
  const [isLoading, setIsLoading] = useState(true)
  const [forecastSeries, setForecastSeries] = useState([...productionHistory, ...projected])
  const [rows, setRows] = useState([])
  const [products, setProducts] = useState([])
  const [analyticsPayload, setAnalyticsPayload] = useState({
    forecastSeries: [...productionHistory, ...projected],
    efficiencyTrend: [],
    defectTrend: [],
    categoryProduction: [],
    stats: {},
  })
  const [activeView, setActiveView] = useState(initialView) // overview, production, inventory, blockchain, analytics

  useEffect(() => {
    let mounted = true

    async function loadData() {
      try {
        const [aiPayload, batchPayload, productPayload, analyticsRes] = await Promise.all([
          manufacturerApi.aiForecast(productionHistory.join(','), 3),
          manufacturerApi.batches(),
          manufacturerApi.products(),
          manufacturerApi.analytics(),
        ])

        if (!mounted) {
          return
        }

        const analyticsSeries = analyticsRes?.forecastSeries ?? []
        const forecast = aiPayload?.forecast ?? projected
        const resolvedSeries = analyticsSeries.length ? analyticsSeries : [...productionHistory, ...forecast]
        const apiRows = (batchPayload?.items ?? []).map((item) => ({
          batchId: item.batch_id,
          sku: item.product_sku,
          status: item.status,
        }))
        const apiProducts = productPayload?.items ?? []

        setForecastSeries(resolvedSeries)
        setRows(apiRows)
        setProducts(apiProducts)
        setAnalyticsPayload({
          forecastSeries: resolvedSeries,
          efficiencyTrend: analyticsRes?.efficiencyTrend ?? [],
          defectTrend: analyticsRes?.defectTrend ?? [],
          categoryProduction: analyticsRes?.categoryProduction ?? [],
          stats: analyticsRes?.stats ?? {},
        })
      } catch {
        if (mounted) {
          setRows([])
          setProducts([])
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    loadData()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    setActiveView(initialView)
  }, [initialView])

  const stats = useMemo(
    () => [
      { label: 'Batches Today', value: rows.length, trend: '' },
      { label: 'Output Units', value: 169, trend: '+4.9%' },
      { label: 'Defect Rate', value: '1.8%', trend: '-0.2%' },
      { label: 'Pending Dispatch', value: 11, trend: '+2' },
      {
        label: 'Forecast Next Cycle',
        value: forecastSeries.at(-1) ?? 0,
        trend: 'AI estimate',
      },
    ],
    [rows.length, forecastSeries],
  )

  return (
    <DashboardLayout
      role="Manufacturer"
      themeClass="manufacturer-theme"
      userName={user?.name}
      onLogout={onLogout}
      onNavigate={onNavigate}
      currentPath={currentPath}
      stats={stats}
      notifications={2}
    >
      {/* Navigation Tabs */}
      {/* Overview View */}
      {activeView === 'overview' && (
        <>
          {isLoading ? (
            <Loader label="Loading AI and batch data..." />
          ) : (
            <AreaChart title="AI Forecasting Trend" data={forecastSeries} />
          )}
          <section style={{ marginTop: 14 }}>
            <Table
              columns={[
                { key: 'batchId', label: 'Batch ID' },
                { key: 'sku', label: 'SKU' },
                { key: 'status', label: 'Status' },
              ]}
              rows={rows}
              emptyMessage="No batch data"
            />
          </section>
        </>
      )}

      {/* Production View */}
      {activeView === 'production' && <Production batches={rows} />}

      {/* Inventory View */}
      {activeView === 'inventory' && <Inventory products={products} />}

      {/* Blockchain Register View */}
      {activeView === 'blockchain' && <BlockchainRegister batches={rows} />}

      {/* Analytics View */}
      {activeView === 'analytics' && (
        <Analytics
          forecastSeries={forecastSeries}
          batches={rows}
          analyticsData={analyticsPayload}
        />
      )}
    </DashboardLayout>
  )
}

export default ManufacturerDashboard
