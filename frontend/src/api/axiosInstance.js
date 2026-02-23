import { getAuthState, logout } from '../store/useAuthStore'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '')

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
    let message = `Request failed with status ${response.status}`
    const rawBody = await safeReadText(response)
    if (rawBody) {
      const contentType = response.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        const payload = tryParseJson(rawBody)
        if (payload) {
          message = payload.message || payload.detail || rawBody || message
        } else {
          message = rawBody
        }
      } else {
        message = rawBody
      }
    }
    throw new Error(message)
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

function withFallback(action, fallback) {
  return async (...args) => {
    const auth = getAuthState()
    if (auth?.isGuest) {
      return typeof fallback === 'function' ? fallback(...args) : fallback
    }

    try {
      return await action(...args)
    } catch {
      return typeof fallback === 'function' ? fallback(...args) : fallback
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
  stats: withFallback(() => http.get('/admin/stats'), {
    total_users: 0,
    total_products: 0,
    total_batches: 0,
    active_shipments: 0,
    revenue: 0,
  }),
  aiForecast: withFallback(
    (history, periods) =>
      http.get(`/admin/ai-forecast?history=${encodeURIComponent(history)}&horizon=${periods}`),
    { forecast: [42, 46, 52, 49, 58, 63] },
  ),
  analytics: withFallback(
    (timeRange = '30d') => http.get(`/admin/analytics?range=${encodeURIComponent(timeRange)}`),
    {},
  ),
  blockchainTransactions: withFallback(() => http.get('/admin/blockchain/transactions'), {
    transactions: [],
    stats: {
      totalVerifications: 0,
      successRate: 0,
      avgGasFee: 0,
      pendingTransactions: 0,
    },
  }),
  verifyBlockchainTransaction: withFallback(
    (txHash) => http.post('/admin/blockchain/verify', { txHash }),
    { success: true },
  ),
  generateReport: withFallback(
    (payload) => http.post('/admin/reports/generate', payload, { responseType: 'blob' }),
    new Blob(['Report generation unavailable in local mode.'], { type: 'text/plain' }),
  ),
}

export const manufacturerApi = {
  products: withFallback(() => http.get('/manufacturer/products'), { items: [] }),
  aiForecast: withFallback(
    (history, periods) =>
      http.get(`/manufacturer/ai-forecast?history=${encodeURIComponent(history)}&horizon=${periods}`),
    { forecast: [120, 132, 140, 155, 161, 169] },
  ),
  analytics: withFallback(() => http.get('/manufacturer/analytics'), {
    forecastSeries: [120, 132, 140, 155, 161, 169],
    efficiencyTrend: [],
    defectTrend: [],
    categoryProduction: [],
    stats: {},
  }),
  batches: withFallback(() => http.get('/manufacturer/batches'), { items: [] }),
}

export const trackingApi = {
  liveGps: withFallback(() => http.get('/tracking/live-gps'), { shipments: {} }),
  analytics: withFallback(
    (timeRange = '7d') => http.get(`/tracking/analytics?range=${encodeURIComponent(timeRange)}`),
    { deliveryTrends: [], statusData: [], forecast: { today: 0, projected: 0, trend: '+0%', series: [] } },
  ),
}

export const inventoryApi = {
  getInventory: withFallback(() => http.get('/inventory'), { products: [], sales: [] }),
  salesAnalytics: withFallback(
    (timeRange = 'week') => http.get(`/inventory/sales-analytics?range=${encodeURIComponent(timeRange)}`),
    {
      period: 'week',
      trend: [],
      topProducts: [],
      recentTransactions: [],
      salesStats: { today: '$0', week: '$0', month: '$0', avgTransaction: '$0.00' },
    },
  ),
}

export const dealerApi = {
  recentOrders: withFallback(() => http.get('/dealer/orders/recent'), { orders: [] }),
  orderTrends: withFallback(() => http.get('/dealer/orders/trends'), { trends: [] }),
  lowStockAlerts: withFallback(() => http.get('/dealer/low-stock'), { items: [] }),
  inventory: withFallback(() => http.get('/dealer/inventory'), { items: [] }),
  arrivals: withFallback(() => http.get('/dealer/arrivals'), { shipments: [] }),
  analytics: withFallback(
    (timeRange = '30d') => http.get(`/dealer/analytics?range=${encodeURIComponent(timeRange)}`),
    {},
  ),
}

export default http
