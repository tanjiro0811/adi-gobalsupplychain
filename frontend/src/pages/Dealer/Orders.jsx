import { useEffect, useMemo, useState } from 'react'
import { dealerApi, manufacturerApi, trackingApi } from '../../api/axiosInstance'
import Table from '../../components/common/Table'
import Loader from '../../components/common/Loader'
import DashboardLayout from '../../components/layout/DashboardLayout'
import './dealer.css'

function formatStage(stage) {
  return String(stage || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function Orders({ user, onLogout, onNavigate, currentPath }) {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [busyOrder, setBusyOrder] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [actionMessage, setActionMessage] = useState('')

  const loadOrders = async () => {
    const response = await dealerApi.pipelineOrders()
    setItems(Array.isArray(response?.items) ? response.items : [])
  }

  useEffect(() => {
    let mounted = true
    async function hydrate() {
      try {
        const response = await dealerApi.pipelineOrders()
        if (mounted) {
          setItems(Array.isArray(response?.items) ? response.items : [])
        }
      } catch (error) {
        if (mounted) setErrorMessage(error?.message || 'Failed to load pipeline orders')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    hydrate()
    return () => {
      mounted = false
    }
  }, [])

  const runAction = async (order, action) => {
    if (!order?.orderCode) return
    setBusyOrder(order.orderCode)
    setErrorMessage('')
    setActionMessage('')
    try {
      let response = null
      if (action === 'confirm') {
        response = await dealerApi.confirmOrder(order.orderCode)
      } else if (action === 'forward') {
        response = await dealerApi.forwardOrderToManufacturer(order.orderCode, { manufacturer_id: 'manufacturer' })
      } else if (action === 'create_batch') {
        response = await manufacturerApi.createBatchForOrder(order.orderCode, {
          product_sku: order.productSku,
          quantity: order.quantity,
        })
      } else if (action === 'assign_transporter') {
        response = await manufacturerApi.assignTransporter(order.orderCode, {
          transporter_id: 'transporter',
          shipment_id: order.shipmentId || `SHP-${order.orderCode.replace(/\D/g, '').padStart(4, '0')}`,
          origin: order.origin || 'Manufacturer Hub',
          destination: order.destination || 'Dealer Warehouse',
          eta: new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString(),
          vehicle_number: 'MH12AB4321',
          lat: 18.5204,
          lng: 73.8567,
        })
      } else if (action === 'in_transit') {
        response = await trackingApi.updateOrderStage(order.orderCode, {
          stage: 'in_transit',
          shipment_id: order.shipmentId,
          lat: 18.6204,
          lng: 74.0567,
        })
      } else if (action === 'dealer_receive') {
        response = await dealerApi.receiveOrder(order.orderCode)
      } else if (action === 'retail_receive') {
        response = await dealerApi.retailReceiveOrder(order.orderCode)
      }
      const hashes = [
        response?.txHash,
        response?.dispatchTxHash,
        response?.deliveredTxHash,
      ].filter(Boolean)
      if (hashes.length) {
        setActionMessage(
          `Order ${order.orderCode} updated. tx: ${hashes.map((hash) => String(hash).slice(0, 16)).join(', ')}...`
        )
      }
      await loadOrders()
    } catch (error) {
      setErrorMessage(error?.message || 'Action failed')
    } finally {
      setBusyOrder('')
    }
  }

  const stats = useMemo(() => {
    const stageCounts = items.reduce((acc, item) => {
      const stage = String(item.currentStage || 'unknown')
      acc[stage] = (acc[stage] || 0) + 1
      return acc
    }, {})
    return [
      { label: 'Pipeline Orders', value: items.length, trend: 'Live' },
      { label: 'Awaiting Dealer', value: stageCounts.retail_ordered || 0, trend: 'Confirm pending' },
      { label: 'Manufacturer Work', value: stageCounts.dealer_ordered_manufacturer || 0, trend: 'Batch pending' },
      { label: 'In Transit', value: stageCounts.in_transit || 0, trend: 'GPS-linked' },
      { label: 'Delivered to Retail', value: stageCounts.retail_received || 0, trend: 'Completed' },
    ]
  }, [items])

  const rows = items.map((item) => {
    const stage = String(item.currentStage || '')
    let actionLabel = 'Completed'
    let actionKey = ''

    if (stage === 'retail_ordered') {
      actionLabel = 'Confirm'
      actionKey = 'confirm'
    } else if (stage === 'dealer_confirmed') {
      actionLabel = 'Order Manufacturer'
      actionKey = 'forward'
    } else if (stage === 'dealer_ordered_manufacturer') {
      actionLabel = 'Create Batch'
      actionKey = 'create_batch'
    } else if (stage === 'manufacturer_batch_created') {
      actionLabel = 'Assign Transporter'
      actionKey = 'assign_transporter'
    } else if (stage === 'transporter_assigned') {
      actionLabel = 'Mark In Transit'
      actionKey = 'in_transit'
    } else if (stage === 'in_transit') {
      actionLabel = 'Dealer Receive'
      actionKey = 'dealer_receive'
    } else if (stage === 'dealer_received') {
      actionLabel = 'Retail Receive'
      actionKey = 'retail_receive'
    }

    return {
      orderCode: <span style={{ fontWeight: 700, color: '#1e40af' }}>{item.orderCode}</span>,
      retailer: item.retailer,
      product: `${item.productSku} x ${item.quantity}`,
      stage: <span className="assignment-chip assigned">{formatStage(item.currentStage)}</span>,
      shipment: item.shipmentId || '--',
      txReady: item.batchId ? 'Yes' : 'Pending',
      action: actionKey ? (
        <button
          type="button"
          onClick={() => runAction(item, actionKey)}
          disabled={busyOrder === item.orderCode}
          style={{
            padding: '6px 10px',
            borderRadius: 8,
            border: 'none',
            background: '#2563eb',
            color: '#fff',
            cursor: busyOrder === item.orderCode ? 'not-allowed' : 'pointer',
            fontSize: 12,
            fontWeight: 600,
            opacity: busyOrder === item.orderCode ? 0.7 : 1,
          }}
        >
          {busyOrder === item.orderCode ? 'Working...' : actionLabel}
        </button>
      ) : (
        <span className="tracking-chip live">Done</span>
      ),
    }
  })

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
        <Loader label="Loading pipeline orders..." />
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
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 24, margin: 0 }}>End-to-End Order Pipeline</h2>
        <p style={{ color: '#6b7280', margin: '4px 0 0 0' }}>
          Retail {'>'} Dealer {'>'} Manufacturer {'>'} Transporter {'>'} Dealer {'>'} Retail
        </p>
      </div>

      {errorMessage && (
        <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: '#fee2e2', color: '#991b1b' }}>
          {errorMessage}
        </div>
      )}

      {actionMessage && (
        <div style={{ marginBottom: 16, padding: 12, borderRadius: 8, background: '#eff6ff', color: '#1d4ed8' }}>
          {actionMessage}
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <Table
          columns={[
            { key: 'orderCode', label: 'Order' },
            { key: 'retailer', label: 'Retailer' },
            { key: 'product', label: 'Product' },
            { key: 'stage', label: 'Current Stage' },
            { key: 'shipment', label: 'Shipment ID' },
            { key: 'txReady', label: 'Blockchain Trail' },
            { key: 'action', label: 'Next Action' },
          ]}
          rows={rows}
          emptyMessage="No pipeline orders"
        />
      </div>
    </DashboardLayout>
  )
}

export default Orders
