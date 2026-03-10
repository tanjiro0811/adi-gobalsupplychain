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
import { StatCardSkeleton, TableSkeleton } from '../../components/ui/Skeleton'
import './manufacturer.css'

const baseHistory = [0, 0, 0, 0, 0, 0]
const projected = forecastDemand(baseHistory, 3)
const LIVE_REFRESH_MS = 15000

function ManufacturerDashboard({
  user,
  onLogout,
  onNavigate,
  currentPath,
  initialView = 'overview',
}) {
  const [isLoading, setIsLoading] = useState(true)
  const [forecastSeries, setForecastSeries] = useState([...baseHistory, ...projected])
  const [rows, setRows] = useState([])
  const [products, setProducts] = useState([])
  const [analyticsPayload, setAnalyticsPayload] = useState({
    forecastSeries: [...baseHistory, ...projected],
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
          manufacturerApi.aiForecast('', 3),
          manufacturerApi.batches(),
          manufacturerApi.products(),
          manufacturerApi.analytics(),
        ])

        if (!mounted) {
          return
        }

        const analyticsSeries = analyticsRes?.forecastSeries ?? []
        const forecast = aiPayload?.forecast ?? projected
        const historySeries = Array.isArray(aiPayload?.history) && aiPayload.history.length
          ? aiPayload.history
          : baseHistory
        const resolvedSeries = analyticsSeries.length ? analyticsSeries : [...historySeries, ...forecast]
        const apiRows = (batchPayload?.items ?? []).map((item) => ({
          batchId: item.batch_id || item.batchId,
          sku: item.product_sku || item.sku,
          quantity: Number(item.quantity || 0),
          status: item.status || 'created',
          startDate: item.startDate || item.created_at || '--',
          endDate: item.endDate || '--',
          qcStatus: item.qcStatus || (item.status === 'completed' ? 'passed' : 'pending'),
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
    const intervalId = setInterval(loadData, LIVE_REFRESH_MS)
    return () => {
      mounted = false
      clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    setActiveView(initialView)
  }, [initialView])

  const avgDefectRate = analyticsPayload?.stats?.avgDefectRate || '0%'

  const stats = useMemo(
    () => [
      { label: 'Batches Today', value: rows.length, trend: '' },
      { label: 'Output Units', value: rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0), trend: 'Live' },
      { label: 'Defect Rate', value: avgDefectRate, trend: 'Live' },
      { label: 'Pending Dispatch', value: rows.filter((row) => String(row.status).toLowerCase() !== 'completed').length, trend: 'Live' },
      {
        label: 'Forecast Next Cycle',
        value: forecastSeries.at(-1) ?? 0,
        trend: 'AI estimate',
      },
    ],
    [rows, forecastSeries, avgDefectRate],
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
      {/* Overview View */}
      {activeView === 'overview' && isLoading && (
        <>
           <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
             <StatCardSkeleton />
             <StatCardSkeleton />
             <StatCardSkeleton />
             <StatCardSkeleton />
             <StatCardSkeleton />
           </div>
           <TableSkeleton rows={3} cols={4} />
           <div className="mt-6">
             <StatCardSkeleton />
           </div>
        </>
      )}

      {/* Navigation Tabs */}
      {/* Overview View */}
      {activeView === 'overview' && !isLoading && (
        <>
          <AreaChart title="AI Forecasting Trend" data={forecastSeries} />
          <section style={{ marginTop: 14 }}>
            <Table
              columns={[
                { key: 'batchId', label: 'Batch ID' },
                { key: 'sku', label: 'SKU' },
                { key: 'quantity', label: 'Qty' },
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
