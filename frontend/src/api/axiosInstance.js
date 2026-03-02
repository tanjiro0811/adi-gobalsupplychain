import { getAuthState, logout } from '../store/useAuthStore'

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? 'http://127.0.0.1:8000/api' : '/api')
).replace(/\/+$/, '')
const ENABLE_DEMO_FALLBACK = String(import.meta.env.VITE_ENABLE_DEMO_FALLBACK || '').toLowerCase() === 'true'

function buildUrl(path) {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${normalizedPath}`
}

async function safeReadText(response) {
  if (!response || response.bodyUsed) {
    return ''
  }
  try {
    return await response.text()
  } catch {
    return ''
  }
}

function tryParseJson(rawText) {
  if (!rawText) {
    return null
  }
  try {
    return JSON.parse(rawText)
  } catch {
    return null
  }
}

const DEFAULT_STATUS_MESSAGES = {
  400: 'Bad request. Please check your input and try again.',
  403: 'You do not have permission to perform this action.',
  404: 'Requested resource was not found.',
  409: 'This action conflicts with existing data.',
  422: 'Submitted data is invalid. Please review and try again.',
  429: 'Too many requests. Please wait and try again.',
  500: 'Server error. Please try again in a moment.',
  502: 'Gateway error. Please try again shortly.',
  503: 'Service is temporarily unavailable. Please try again shortly.',
}

function extractErrorMessage(value) {
  if (value === null || value === undefined) {
    return ''
  }

  if (typeof value === 'string') {
    return value.trim()
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = extractErrorMessage(item)
      if (nested) {
        return nested
      }
    }
    return ''
  }

  if (typeof value === 'object') {
    const direct =
      value.message ??
      value.detail ??
      value.error ??
      value.title ??
      value.msg ??
      value.reason

    const directMessage = extractErrorMessage(direct)
    if (directMessage) {
      return directMessage
    }

    if (Array.isArray(value.errors)) {
      const errorsMessage = extractErrorMessage(value.errors)
      if (errorsMessage) {
        return errorsMessage
      }
    }
  }

  return ''
}

function canUseRawErrorText(rawText, contentType, status) {
  const trimmed = String(rawText || '').trim()
  if (!trimmed) {
    return false
  }
  if (contentType.includes('text/html')) {
    return false
  }
  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    return false
  }
  if (status >= 500 && trimmed.length > 160) {
    return false
  }
  return true
}

function looksLikeProxyConnectionFailure(rawText = '', contentType = '') {
  const haystack = `${String(contentType || '').toLowerCase()}\n${String(rawText || '').toLowerCase()}`
  return (
    haystack.includes('ecconnrefused') ||
    haystack.includes('connect econnrefused') ||
    haystack.includes('proxy error') ||
    haystack.includes('http proxy error') ||
    haystack.includes('target machine actively refused') ||
    haystack.includes('fetch failed')
  )
}

async function request(path, { method = 'GET', data, headers = {}, responseType = 'json' } = {}) {
  const auth = getAuthState()
  const requestHeaders = {
    ...headers,
  }

  if (auth.token) {
    requestHeaders.Authorization = `Bearer ${auth.token}`
  }

  if (data !== undefined && !requestHeaders['Content-Type']) {
    requestHeaders['Content-Type'] = 'application/json'
  }

  const requestUrl = buildUrl(path)
  let response
  try {
    response = await fetch(requestUrl, {
      method,
      headers: requestHeaders,
      body: data !== undefined ? JSON.stringify(data) : undefined,
    })
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw error
    }
    const connectionHint = API_BASE_URL.startsWith('http')
      ? API_BASE_URL
      : `backend via ${API_BASE_URL} (dev proxy)`
    throw new Error(`Cannot reach server (${connectionHint}). Make sure backend is running.`)
  }

  if (response.status === 401) {
    if (auth.token && !auth.isGuest) {
      logout()
      throw new Error('Session expired. Please login again.')
    }
    throw new Error('Unauthorized')
  }

  if (!response.ok) {
    let message = DEFAULT_STATUS_MESSAGES[response.status] || `Request failed with status ${response.status}`
    const rawBody = await safeReadText(response)
    if (rawBody) {
      const contentType = response.headers.get('content-type') || ''
      if (response.status >= 500 && looksLikeProxyConnectionFailure(rawBody, contentType)) {
        const connectionHint = API_BASE_URL.startsWith('http')
          ? API_BASE_URL
          : `backend via ${API_BASE_URL} (dev proxy)`
        message = `Cannot reach server (${connectionHint}). Make sure backend is running.`
      } else if (contentType.includes('application/json')) {
        const payload = tryParseJson(rawBody)
        if (payload) {
          const extractedMessage = extractErrorMessage(payload)
          if (extractedMessage) {
            message = extractedMessage
          }
        } else {
          if (canUseRawErrorText(rawBody, contentType, response.status)) {
            message = rawBody.trim()
          }
        }
      } else {
        if (canUseRawErrorText(rawBody, contentType, response.status)) {
          message = rawBody.trim()
        }
      }
    }
    const requestError = new Error(message)
    requestError.status = response.status
    throw requestError
  }

  if (responseType === 'blob') {
    return response.blob()
  }

  if (responseType === 'text') {
    return safeReadText(response)
  }

  if (response.status === 204) {
    return null
  }

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const rawBody = await safeReadText(response)
    const payload = tryParseJson(rawBody)
    if (payload !== null) {
      return payload
    }
    return rawBody || null
  }

  return safeReadText(response)
}

const http = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, data, options) => request(path, { ...options, method: 'POST', data }),
  put: (path, data, options) => request(path, { ...options, method: 'PUT', data }),
  patch: (path, data, options) => request(path, { ...options, method: 'PATCH', data }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
}

function getRangeLength(range, fallback = 30) {
  const normalized = String(range || '').toLowerCase()
  if (normalized === '7d' || normalized === 'week') return 7
  if (normalized === '30d' || normalized === 'month') return 30
  if (normalized === '90d') return 90
  if (normalized === '1y') return 365
  return fallback
}

function buildNumericSeries(length, base, step, variance = 0) {
  return Array.from({ length }, (_, index) =>
    Math.max(0, Math.round(base + (index * step) + (((index % 3) - 1) * variance))),
  )
}

function buildLabeledSeries(labels = [], base, step, variance = 0) {
  return labels.map((label, index) => ({
    label,
    value: Math.max(0, Math.round(base + (index * step) + (((index % 3) - 1) * variance))),
  }))
}

const FALLBACK_ADMIN_STATS = {
  total_users: 1301,
  total_products: 586,
  total_batches: 214,
  active_shipments: 73,
  revenue: 1254800,
}

function buildAdminAnalytics(range = '30d') {
  const length = getRangeLength(range, 30)
  return {
    revenue: buildNumericSeries(length, 78000, 840, 4200),
    forecast: buildNumericSeries(Math.min(Math.max(length, 30), 90), 86000, 960, 5200),
    userDistribution: [
      { label: 'Manufacturers', value: 245, color: '#3b82f6' },
      { label: 'Transporters', value: 128, color: '#10b981' },
      { label: 'Dealers', value: 342, color: '#8b5cf6' },
      { label: 'Retail Shops', value: 586, color: '#f59e0b' },
    ],
    systemStatus: [
      { label: 'Active', value: 892, color: '#10b981' },
      { label: 'Pending', value: 45, color: '#f59e0b' },
      { label: 'Issues', value: 12, color: '#ef4444' },
      { label: 'Maintenance', value: 8, color: '#6b7280' },
    ],
    apiMetrics: {
      auth: 12847,
      blockchain: 8523,
      gps: 15234,
      analytics: 6789,
    },
  }
}

const FALLBACK_BLOCKCHAIN_TRANSACTIONS = {
  transactions: [
    {
      id: 1,
      transactionHash: '0x7f9fade1c0d57a7af66ab4ead79fade1c0d57a7af66ab4ead7c2c2eb7b11a91385',
      productBatch: 'BATCH-2026-001',
      manufacturer: 'ABC Manufacturing',
      status: 'verified',
      blockNumber: 18234567,
      gasFee: 42,
      timestamp: '2026-02-24T09:45:00Z',
      productDetails: { name: 'Sterile Gloves', quantity: 1200, category: 'Healthcare' },
    },
    {
      id: 2,
      transactionHash: '0x8c1fade2d1e68b8bb77bc5fbe8efade2d1e68b8bb77bc5fbe8d3d3fc8c22b02496',
      productBatch: 'BATCH-2026-002',
      manufacturer: 'Prime Meditech',
      status: 'pending',
      blockNumber: null,
      gasFee: 0,
      timestamp: '2026-02-24T10:05:00Z',
      productDetails: { name: 'IV Set Standard', quantity: 800, category: 'Medical Supplies' },
    },
    {
      id: 3,
      transactionHash: '0x9d2cbef3e2f79c9cc88cd6ccf9fccef3e2f79c9cc88cd6ccf9e4e4cd9d33c13507',
      productBatch: 'BATCH-2026-003',
      manufacturer: 'Nova Healthcare',
      status: 'failed',
      blockNumber: null,
      gasFee: 0,
      timestamp: '2026-02-24T08:22:00Z',
      productDetails: { name: 'Diagnostic Kit', quantity: 450, category: 'Diagnostics' },
    },
    {
      id: 4,
      transactionHash: '0xaa3e3cc4f3c80d0dd99de7cec0ccec4f3c80d0dd99de7cec0cf5f5ce0e44d24618',
      productBatch: 'BATCH-2026-004',
      manufacturer: 'Global Supplies',
      status: 'verified',
      blockNumber: 18234554,
      gasFee: 47,
      timestamp: '2026-02-24T07:58:00Z',
      productDetails: { name: 'Surgical Masks', quantity: 2000, category: 'PPE' },
    },
  ],
  stats: {
    totalVerifications: 4523,
    successRate: 98.5,
    avgGasFee: 45,
    pendingTransactions: 12,
  },
}

const FALLBACK_MANUFACTURER_PRODUCTS = {
  items: [
    {
      id: 'N95-001',
      sku: 'N95-001',
      name: 'N95 Mask Box (50pcs)',
      category: 'PPE',
      rawMaterial: 'Polypropylene',
      quantity: 1200,
      reorderLevel: 500,
      price: 45.99,
      verified: true,
      status: 'in-stock',
      stock: 1200,
    },
    {
      id: 'IV-002',
      sku: 'IV-002',
      name: 'IV Set Standard',
      category: 'Medical Supplies',
      rawMaterial: 'Medical PVC',
      quantity: 760,
      reorderLevel: 400,
      price: 12.5,
      verified: true,
      status: 'in-stock',
      stock: 760,
    },
    {
      id: 'CARE-003',
      sku: 'CARE-003',
      name: 'Home Care Kit',
      category: 'Kits',
      rawMaterial: 'Composite',
      quantity: 210,
      reorderLevel: 300,
      price: 89.99,
      verified: false,
      status: 'low-stock',
      stock: 210,
    },
    {
      id: 'GLOVE-004',
      sku: 'GLOVE-004',
      name: 'Nitrile Gloves (100pcs)',
      category: 'PPE',
      rawMaterial: 'Nitrile',
      quantity: 980,
      reorderLevel: 500,
      price: 24.99,
      verified: true,
      status: 'in-stock',
      stock: 980,
    },
  ],
}

const FALLBACK_MANUFACTURER_BATCHES = {
  items: [
    { batch_id: 'BATCH-2026-001', product_sku: 'N95-001', status: 'completed', quantity: 500 },
    { batch_id: 'BATCH-2026-002', product_sku: 'IV-002', status: 'in-progress', quantity: 300 },
    { batch_id: 'BATCH-2026-003', product_sku: 'CARE-003', status: 'quality-check', quantity: 220 },
    { batch_id: 'BATCH-2026-004', product_sku: 'GLOVE-004', status: 'completed', quantity: 640 },
  ],
}

const FALLBACK_MANUFACTURER_ANALYTICS = {
  forecastSeries: [120, 132, 140, 155, 161, 169, 176, 184, 191],
  efficiencyTrend: [
    { label: 'Week 1', value: 92 },
    { label: 'Week 2', value: 89 },
    { label: 'Week 3', value: 94 },
    { label: 'Week 4', value: 96 },
  ],
  defectTrend: [
    { label: 'Jan', value: 2.4 },
    { label: 'Feb', value: 1.9 },
    { label: 'Mar', value: 1.6 },
    { label: 'Apr', value: 1.3 },
  ],
  categoryProduction: [
    { label: 'PPE', value: 1320 },
    { label: 'Medical', value: 860 },
    { label: 'First Aid', value: 610 },
    { label: 'Diagnostics', value: 480 },
  ],
  stats: {
    avgEfficiency: '93%',
    avgDefectRate: '1.73%',
    totalOutput: '3,270',
    forecastNext: 198,
  },
}

const FALLBACK_TRACKING_SHIPMENTS = {
  'TRK-SHP-1001': {
    origin: 'Mumbai, MH',
    destination: 'Bengaluru, KA',
    status: 'in_transit',
    eta: '6h',
    weight: 840,
    lat: 18.5204,
    lng: 73.8567,
    updatedAt: '2026-02-24T10:20:00Z',
    deliveryPartner: {
      name: 'SwiftMove Logistics',
      phone: '+91 90000 12001',
      rating: 4.7,
    },
    assignment: { status: 'Assigned' },
    vehicle: { number: 'KA-01-TR-2211', type: 'Lorry' },
    feedback: { comment: 'On route and tracking stable.' },
    driver: {
      employeeId: 'EMP-1001',
      totalTrips: 145,
      onTimeDeliveries: 132,
      delayedDeliveries: 13,
      kmDriven: 42000,
      incidents: 0,
      currentSpeed: 68,
      licenseType: 'HGV',
      licenseExpiry: '2026-06-30',
      joinedDate: '2021-03-15',
    },
  },
  'TRK-SHP-1002': {
    origin: 'Delhi, DL',
    destination: 'Bengaluru, KA',
    status: 'delayed',
    eta: '14h',
    weight: 620,
    lat: 17.385,
    lng: 78.4867,
    updatedAt: '2026-02-24T10:02:00Z',
    deliveryPartner: {
      name: 'PrimeRoute Carriers',
      phone: '+91 90000 12002',
      rating: 4.5,
    },
    assignment: { status: 'Assigned' },
    vehicle: { number: 'KA-03-TR-1187', type: 'Truck' },
    feedback: { comment: 'Delay due to route congestion near city entry point.' },
    driver: {
      employeeId: 'EMP-1002',
      totalTrips: 98,
      onTimeDeliveries: 90,
      delayedDeliveries: 8,
      kmDriven: 28000,
      incidents: 1,
      currentSpeed: 0,
      licenseType: 'LGV',
      licenseExpiry: '2025-12-15',
      joinedDate: '2022-01-10',
    },
  },
  'TRK-SHP-1003': {
    origin: 'Chennai, TN',
    destination: 'Kochi, KL',
    status: 'delivered',
    eta: 'Arrived',
    weight: 410,
    lat: 9.9312,
    lng: 76.2673,
    updatedAt: '2026-02-24T09:35:00Z',
    deliveryPartner: {
      name: 'CargoLink Express',
      phone: '+91 90000 12003',
      rating: 4.6,
    },
    assignment: { status: 'Assigned' },
    vehicle: { number: 'KL-07-TR-4488', type: 'Container' },
    feedback: { comment: 'Delivered safely and acknowledged by receiver.' },
    driver: {
      employeeId: 'EMP-1003',
      totalTrips: 210,
      onTimeDeliveries: 195,
      delayedDeliveries: 15,
      kmDriven: 68000,
      incidents: 0,
      currentSpeed: 0,
      licenseType: 'Class A',
      licenseExpiry: '2027-03-20',
      joinedDate: '2020-06-01',
    },
  },
  'TRK-SHP-1004': {
    origin: 'Hyderabad, TG',
    destination: 'Pune, MH',
    status: 'in_transit',
    eta: '9h',
    weight: 700,
    updatedAt: '2026-02-24T09:58:00Z',
    deliveryPartner: {
      name: 'TransitEdge Movers',
      phone: '+91 90000 12004',
      rating: 4.4,
    },
    assignment: { status: 'Pending Assignment' },
    vehicle: { number: 'MH-12-TR-6670', type: 'Mini Truck' },
    feedback: { comment: 'Awaiting final segment reassignment.' },
    driver: {
      employeeId: 'EMP-1004',
      totalTrips: 88,
      onTimeDeliveries: 82,
      delayedDeliveries: 6,
      kmDriven: 31000,
      incidents: 0,
      currentSpeed: 0,
      licenseType: 'HGV',
      licenseExpiry: '2026-09-10',
      joinedDate: '2021-07-20',
    },
  },
}

const FALLBACK_TRACKING_ANALYTICS = {
  deliveryTrends: buildLabeledSeries(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], 44, 4, 3),
  statusData: [
    { label: 'In Transit', value: 2, color: '#0ea5e9' },
    { label: 'Delayed', value: 1, color: '#f97316' },
    { label: 'Completed', value: 1, color: '#22c55e' },
    { label: 'GPS Offline', value: 1, color: '#64748b' },
  ],
  forecast: {
    today: 4,
    projected: 6,
    trend: '+50%',
    series: [
      { label: 'Today', value: 4 },
      { label: 'D+1', value: 5 },
      { label: 'D+2', value: 5 },
      { label: 'D+3', value: 6 },
    ],
  },
}

const FALLBACK_RETAIL_INVENTORY = {
  products: [
    { id: 'N95-001', name: 'N95 Mask Box (50pcs)', price: 45.99, stock: 120, reorderLevel: 50, category: 'PPE', verified: true, status: 'in-stock' },
    { id: 'IV-002', name: 'IV Set Standard', price: 12.5, stock: 34, reorderLevel: 40, category: 'Medical Supplies', verified: true, status: 'low-stock' },
    { id: 'CARE-003', name: 'Home Care Kit', price: 89.99, stock: 12, reorderLevel: 20, category: 'Kits', verified: false, status: 'low-stock' },
    { id: 'GLOVE-004', name: 'Nitrile Gloves (100pcs)', price: 24.99, stock: 78, reorderLevel: 60, category: 'PPE', verified: true, status: 'in-stock' },
    { id: 'THERM-005', name: 'Digital Thermometer', price: 15.99, stock: 45, reorderLevel: 30, category: 'Diagnostics', verified: true, status: 'in-stock' },
  ],
  sales: [
    { label: 'Mon', value: 3280 },
    { label: 'Tue', value: 3470 },
    { label: 'Wed', value: 3610 },
    { label: 'Thu', value: 3720 },
    { label: 'Fri', value: 3940 },
    { label: 'Sat', value: 4210 },
    { label: 'Sun', value: 3890 },
  ],
}

function buildRetailSalesAnalytics(period = 'week') {
  const isMonth = String(period || '').toLowerCase() === 'month'
  const labels = isMonth
    ? Array.from({ length: 30 }, (_, index) => `D${index + 1}`)
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return {
    period: isMonth ? 'month' : 'week',
    trend: buildLabeledSeries(labels, isMonth ? 2600 : 3100, isMonth ? 38 : 120, isMonth ? 170 : 210),
    topProducts: [
      { product: 'N95 Mask Box', units: 186, revenue: '$8,560', growth: '+12%' },
      { product: 'Surgical Gloves', units: 149, revenue: '$6,705', growth: '+8%' },
      { product: 'Digital Thermometer', units: 118, revenue: '$4,980', growth: '+6%' },
      { product: 'IV Set Standard', units: 96, revenue: '$3,740', growth: '+5%' },
      { product: 'Home Care Kit', units: 72, revenue: '$3,120', growth: '+9%' },
    ],
    recentTransactions: [
      { id: 'TXN-9041', time: '10:12', items: 4, amount: '$186.40', payment: 'Card', status: 'Completed' },
      { id: 'TXN-9042', time: '10:27', items: 2, amount: '$91.98', payment: 'UPI', status: 'Completed' },
      { id: 'TXN-9043', time: '10:44', items: 6, amount: '$212.50', payment: 'Cash', status: 'Completed' },
      { id: 'TXN-9044', time: '11:03', items: 3, amount: '$134.97', payment: 'Card', status: 'Completed' },
      { id: 'TXN-9045', time: '11:18', items: 5, amount: '$245.00', payment: 'Wallet', status: 'Completed' },
    ],
    salesStats: {
      today: '$3,940',
      week: '$23,870',
      month: '$97,420',
      avgTransaction: '$142.86',
    },
  }
}

const FALLBACK_DEALER_RECENT_ORDERS = {
  orders: [
    { orderId: 'DL-3321', retailer: 'Nova Med', amount: '$2,460', status: 'Dispatched', date: '2026-02-15' },
    { orderId: 'DL-3322', retailer: 'CareHub', amount: '$1,810', status: 'Pending', date: '2026-02-14' },
    { orderId: 'DL-3323', retailer: 'Prime Labs', amount: '$4,105', status: 'Delivered', date: '2026-02-13' },
    { orderId: 'DL-3324', retailer: 'HealthFirst', amount: '$3,250', status: 'Dispatched', date: '2026-02-12' },
    { orderId: 'DL-3325', retailer: 'MediCare Plus', amount: '$1,980', status: 'Pending', date: '2026-02-11' },
  ],
}

const FALLBACK_DEALER_ORDER_TRENDS = {
  trends: [42, 38, 45, 52, 49, 58, 63],
}

const FALLBACK_DEALER_LOW_STOCK = {
  items: [
    { sku: 'SUR-002', productName: 'Surgical Gloves', currentStock: 300, minStock: 400, stockStatus: 'Low Stock' },
    { sku: 'LAB-003', productName: 'Test Tubes (Box)', currentStock: 0, minStock: 50, stockStatus: 'Out of Stock' },
    { sku: 'DEV-005', productName: 'Blood Pressure Monitor', currentStock: 420, minStock: 500, stockStatus: 'Low Stock' },
  ],
}

const FALLBACK_DEALER_INVENTORY = {
  items: [
    {
      id: 1,
      sku: 'MED-001',
      productName: 'Paracetamol 500mg',
      category: 'Medicines',
      manufacturer: 'ABC Pharma',
      currentStock: 1500,
      minStock: 500,
      maxStock: 2000,
      unitPrice: 12.5,
      stockStatus: 'In Stock',
      lastRestocked: '2026-02-10',
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
      unitPrice: 45,
      stockStatus: 'Low Stock',
      lastRestocked: '2026-02-05',
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
      unitPrice: 85,
      stockStatus: 'Out of Stock',
      lastRestocked: '2026-01-28',
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
      unitPrice: 125,
      stockStatus: 'In Stock',
      lastRestocked: '2026-02-12',
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
      unitPrice: 340,
      stockStatus: 'Low Stock',
      lastRestocked: '2026-02-08',
    },
  ],
}

const FALLBACK_DEALER_ARRIVALS = {
  shipments: [
    {
      id: 1,
      shipmentId: 'SHP-2026-001',
      orderId: 'DL-3321',
      manufacturer: 'ABC Pharma',
      carrier: 'FastTrack Logistics',
      origin: 'Mumbai, MH',
      destination: 'Bengaluru, KA',
      status: 'In Transit',
      estimatedArrival: '2026-02-27',
      currentLocation: 'Pune, MH',
      progress: 65,
      blockchainVerified: true,
      items: 50,
    },
    {
      id: 2,
      shipmentId: 'SHP-2026-002',
      orderId: 'DL-3322',
      manufacturer: 'XYZ Medical',
      carrier: 'Swift Transport',
      origin: 'Delhi, DL',
      destination: 'Bengaluru, KA',
      status: 'Arriving Today',
      estimatedArrival: '2026-02-24',
      currentLocation: 'Bengaluru, KA',
      progress: 95,
      blockchainVerified: true,
      items: 30,
    },
    {
      id: 3,
      shipmentId: 'SHP-2026-003',
      orderId: 'DL-3323',
      manufacturer: 'MediTech Inc',
      carrier: 'Express Cargo',
      origin: 'Hyderabad, TG',
      destination: 'Bengaluru, KA',
      status: 'Delayed',
      estimatedArrival: '2026-02-28',
      currentLocation: 'Hyderabad, TG',
      progress: 20,
      blockchainVerified: false,
      items: 75,
    },
    {
      id: 4,
      shipmentId: 'SHP-2026-004',
      orderId: 'DL-3324',
      manufacturer: 'Global Health',
      carrier: 'Prime Movers',
      origin: 'Chennai, TN',
      destination: 'Bengaluru, KA',
      status: 'In Transit',
      estimatedArrival: '2026-02-26',
      currentLocation: 'Hosur, TN',
      progress: 80,
      blockchainVerified: true,
      items: 60,
    },
  ],
}

function buildDealerAnalytics(range = '30d') {
  const length = getRangeLength(range, 30)
  return {
    revenue: buildNumericSeries(length, 1400, 22, 130),
    topProducts: [
      { label: 'Medicines', value: 42, color: '#3b82f6' },
      { label: 'Surgical Supplies', value: 28, color: '#10b981' },
      { label: 'Lab Equipment', value: 18, color: '#f59e0b' },
      { label: 'Medical Devices', value: 12, color: '#8b5cf6' },
    ],
    orderStatus: [
      { label: 'Delivered', value: 45, color: '#22c55e' },
      { label: 'Dispatched', value: 30, color: '#0ea5e9' },
      { label: 'Pending', value: 13, color: '#f59e0b' },
    ],
    categoryMix: [
      { label: 'Medicines', value: 42, color: '#3b82f6' },
      { label: 'Surgical', value: 28, color: '#10b981' },
      { label: 'Equipment', value: 18, color: '#f59e0b' },
      { label: 'Devices', value: 12, color: '#8b5cf6' },
    ],
  }
}

function cloneData(value) {
  if (value === null || value === undefined || typeof value !== 'object') {
    return value
  }
  if (value instanceof Blob) {
    return value
  }
  if (Array.isArray(value)) {
    return value.map(cloneData)
  }

  const cloned = {}
  for (const [key, item] of Object.entries(value)) {
    cloned[key] = cloneData(item)
  }
  return cloned
}

function resolveFallback(fallback, args) {
  const value = typeof fallback === 'function' ? fallback(...args) : fallback
  return cloneData(value)
}

function withFallback(action, fallback, shouldFallback) {
  return async (...args) => {
    const auth = getAuthState()
    const allowFallback = auth?.isGuest || ENABLE_DEMO_FALLBACK
    if (auth?.isGuest) {
      return resolveFallback(fallback, args)
    }

    try {
      const response = await action(...args)
      if (typeof shouldFallback === 'function' && shouldFallback(response, ...args)) {
        if (allowFallback) {
          return resolveFallback(fallback, args)
        }
      }
      return response
    } catch (error) {
      if (allowFallback) {
        return resolveFallback(fallback, args)
      }
      throw error
    }
  }
}

export const authApi = {
  post: http.post,
  get: http.get,
  login: (payload) => http.post('/auth/login', payload),
  signup: (payload) => http.post('/auth/signup', payload),
  guestEntry: (payload) => http.post('/auth/guest-entry', payload),
}

export const adminApi = {
  stats: withFallback(
    () => http.get('/admin/stats'),
    FALLBACK_ADMIN_STATS,
    (payload) =>
      ['total_users', 'total_products', 'total_batches', 'active_shipments', 'revenue']
        .every((key) => Number(payload?.[key] ?? 0) <= 0),
  ),
  aiForecast: withFallback(
    (history, periods) =>
      http.get(`/admin/ai-forecast?history=${encodeURIComponent(history)}&horizon=${periods}`),
    { forecast: [42, 46, 52, 49, 58, 63] },
    (payload) => !Array.isArray(payload?.forecast) || !payload.forecast.length,
  ),
  analytics: withFallback(
    (timeRange = '30d') => http.get(`/admin/analytics?range=${encodeURIComponent(timeRange)}`),
    (timeRange = '30d') => buildAdminAnalytics(timeRange),
    (payload) => {
      const revenueEmpty = !Array.isArray(payload?.revenue) || !payload.revenue.length
      const forecastEmpty = !Array.isArray(payload?.forecast) || !payload.forecast.length
      const usersEmpty = !Array.isArray(payload?.userDistribution) || !payload.userDistribution.length
      const systemEmpty = !Array.isArray(payload?.systemStatus) || !payload.systemStatus.length
      return revenueEmpty && forecastEmpty && usersEmpty && systemEmpty
    },
  ),
  blockchainTransactions: withFallback(
    () => http.get('/admin/blockchain/transactions'),
    FALLBACK_BLOCKCHAIN_TRANSACTIONS,
    (payload) => !Array.isArray(payload?.transactions) || !payload.transactions.length,
  ),
  verifyBlockchainTransaction: withFallback(
    (txHash) => http.post('/admin/blockchain/verify', { txHash }),
    { success: true, message: 'Transaction verified (demo mode).' },
  ),
  generateReport: withFallback(
    (payload) => http.post('/admin/reports/generate', payload, { responseType: 'blob' }),
    () => new Blob(['Report generation unavailable in local mode.'], { type: 'text/plain' }),
  ),
}

export const manufacturerApi = {
  products: withFallback(
    () => http.get('/manufacturer/products'),
    FALLBACK_MANUFACTURER_PRODUCTS,
    (payload) => !Array.isArray(payload?.items) || !payload.items.length,
  ),
  aiForecast: withFallback(
    (history, periods) =>
      http.get(`/manufacturer/ai-forecast?history=${encodeURIComponent(history)}&horizon=${periods}`),
    { forecast: [120, 132, 140, 155, 161, 169] },
    (payload) => !Array.isArray(payload?.forecast) || !payload.forecast.length,
  ),
  analytics: withFallback(
    () => http.get('/manufacturer/analytics'),
    FALLBACK_MANUFACTURER_ANALYTICS,
    (payload) => {
      const forecastEmpty = !Array.isArray(payload?.forecastSeries) || !payload.forecastSeries.length
      const efficiencyEmpty = !Array.isArray(payload?.efficiencyTrend) || !payload.efficiencyTrend.length
      const defectEmpty = !Array.isArray(payload?.defectTrend) || !payload.defectTrend.length
      const categoryEmpty = !Array.isArray(payload?.categoryProduction) || !payload.categoryProduction.length
      return forecastEmpty && efficiencyEmpty && defectEmpty && categoryEmpty
    },
  ),
  batches: withFallback(
    () => http.get('/manufacturer/batches'),
    FALLBACK_MANUFACTURER_BATCHES,
    (payload) => !Array.isArray(payload?.items) || !payload.items.length,
  ),
  createBatchForOrder: (orderCode, payload) =>
    http.patch(`/manufacturer/orders/${encodeURIComponent(orderCode)}/create-batch`, payload),
  assignTransporter: (orderCode, payload) =>
    http.patch(`/manufacturer/orders/${encodeURIComponent(orderCode)}/assign-transporter`, payload),
}

export const trackingApi = {
  liveGps: withFallback(
    () => http.get('/tracking/live-gps'),
    { shipments: FALLBACK_TRACKING_SHIPMENTS },
    (payload) =>
      !payload?.shipments ||
      typeof payload.shipments !== 'object' ||
      !Object.keys(payload.shipments).length,
  ),
  analytics: withFallback(
    (timeRange = '7d') => http.get(`/tracking/analytics?range=${encodeURIComponent(timeRange)}`),
    () => FALLBACK_TRACKING_ANALYTICS,
    (payload) => {
      const trendEmpty = !Array.isArray(payload?.deliveryTrends) || !payload.deliveryTrends.length
      const statusEmpty = !Array.isArray(payload?.statusData) || !payload.statusData.length
      const forecastEmpty =
        Number(payload?.forecast?.today ?? 0) <= 0 &&
        Number(payload?.forecast?.projected ?? 0) <= 0
      return trendEmpty && statusEmpty && forecastEmpty
    },
  ),
  updateOrderStage: (orderCode, payload) =>
    http.patch(`/tracking/orders/${encodeURIComponent(orderCode)}/stage`, payload),
  updateShipmentLocation: (shipmentId, payload) =>
    http.patch(`/tracking/shipments/${encodeURIComponent(shipmentId)}`, payload),
}

export const inventoryApi = {
  getInventory: withFallback(
    () => http.get('/inventory'),
    FALLBACK_RETAIL_INVENTORY,
    (payload) =>
      !Array.isArray(payload?.products) || !payload.products.length,
  ),
  salesAnalytics: withFallback(
    (timeRange = 'week') => http.get(`/inventory/sales-analytics?range=${encodeURIComponent(timeRange)}`),
    (timeRange = 'week') => buildRetailSalesAnalytics(timeRange),
    (payload) =>
      !Array.isArray(payload?.trend) || !payload.trend.length,
  ),
  sellProduct: withFallback(
    (payload) => http.post('/inventory/sales', payload),
    (payload) => ({
      success: true,
      sale: {
        sku: payload?.sku,
        units_sold: payload?.quantity,
        sale_amount: Number(payload?.quantity || 0) * 10,
      },
      txHash: 'demo-tx-hash',
      updatedStock: 0,
      saleAmount: Number(payload?.quantity || 0) * 10,
    }),
  ),
}

export const dealerApi = {
  recentOrders: withFallback(
    () => http.get('/dealer/orders/recent'),
    FALLBACK_DEALER_RECENT_ORDERS,
    (payload) => !Array.isArray(payload?.orders) || !payload.orders.length,
  ),
  orderTrends: withFallback(
    () => http.get('/dealer/orders/trends'),
    FALLBACK_DEALER_ORDER_TRENDS,
    (payload) => !Array.isArray(payload?.trends) || !payload.trends.length,
  ),
  lowStockAlerts: withFallback(
    () => http.get('/dealer/low-stock'),
    FALLBACK_DEALER_LOW_STOCK,
    (payload) => !Array.isArray(payload?.items) || !payload.items.length,
  ),
  inventory: withFallback(
    () => http.get('/dealer/inventory'),
    FALLBACK_DEALER_INVENTORY,
    (payload) => !Array.isArray(payload?.items) || !payload.items.length,
  ),
  arrivals: withFallback(
    () => http.get('/dealer/arrivals'),
    FALLBACK_DEALER_ARRIVALS,
    (payload) => !Array.isArray(payload?.shipments) || !payload.shipments.length,
  ),
  analytics: withFallback(
    (timeRange = '30d') => http.get(`/dealer/analytics?range=${encodeURIComponent(timeRange)}`),
    (timeRange = '30d') => buildDealerAnalytics(timeRange),
    (payload) => {
      const revenueEmpty = !Array.isArray(payload?.revenue) || !payload.revenue.length
      const topProductsEmpty = !Array.isArray(payload?.topProducts) || !payload.topProducts.length
      const orderStatusEmpty = !Array.isArray(payload?.orderStatus) || !payload.orderStatus.length
      return revenueEmpty && topProductsEmpty && orderStatusEmpty
    },
  ),
  pipelineOrders: () => http.get('/dealer/orders/pipeline'),
  createRetailOrder: (payload) => http.post('/dealer/orders/retail', payload),
  confirmOrder: (orderCode) => http.patch(`/dealer/orders/${encodeURIComponent(orderCode)}/confirm`, {}),
  forwardOrderToManufacturer: (orderCode, payload = {}) =>
    http.patch(`/dealer/orders/${encodeURIComponent(orderCode)}/dealer-order`, payload),
  receiveOrder: (orderCode) => http.patch(`/dealer/orders/${encodeURIComponent(orderCode)}/receive`, {}),
  retailReceiveOrder: (orderCode) =>
    http.patch(`/dealer/orders/${encodeURIComponent(orderCode)}/retail-receive`, {}),
  reorderRecommendations: (days = 30) =>
    http.get(`/dealer/reorder-recommendations?days=${encodeURIComponent(days)}`),
}

export const blockchainApi = {
  journey: (productSku) => http.get(`/blockchain/journey/${encodeURIComponent(productSku)}`),
  qr: (productSku) => http.get(`/blockchain/qr/${encodeURIComponent(productSku)}`),
  verify: (payload) => http.post('/blockchain/verify', payload),
}

export default http
