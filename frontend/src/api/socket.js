let gpsSocket = null
let notificationSocket = null
let reconnectTimer = null
let reconnectEnabled = true
let lastConnectOptions = null
let reconnectAttempts = 0

const RECONNECT_DELAY_MS = Number(import.meta.env.VITE_GPS_SOCKET_RECONNECT_MS ?? 2500)
const MAX_RECONNECT_DELAY_MS = Number(import.meta.env.VITE_GPS_SOCKET_MAX_DELAY_MS ?? 15000)
const MAX_RECONNECT_ATTEMPTS = Number(
  import.meta.env.VITE_GPS_SOCKET_MAX_RETRIES ??
    (import.meta.env.DEV ? 8 : Number.POSITIVE_INFINITY),
)

function toSocketUrl(httpUrl) {
  const normalized = String(httpUrl || '').trim()
  if (!normalized) {
    return ''
  }

  if (normalized.startsWith('ws://') || normalized.startsWith('wss://')) {
    return normalized
  }

  if (normalized.startsWith('http://')) {
    return `ws://${normalized.slice('http://'.length)}`
  }

  if (normalized.startsWith('https://')) {
    return `wss://${normalized.slice('https://'.length)}`
  }

  return normalized
}

function getLocalBackendSocketUrl() {
  const backendTarget = import.meta.env.VITE_DEV_PROXY_TARGET || 'http://127.0.0.1:8000'
  const wsBase = toSocketUrl(backendTarget).replace(/\/+$/, '')
  return `${wsBase}/ws/gps`
}

function getLocalBackendSocketBase() {
  const backendTarget = import.meta.env.VITE_DEV_PROXY_TARGET || 'http://127.0.0.1:8000'
  return toSocketUrl(backendTarget).replace(/\/+$/, '')
}

function getDefaultSocketUrl() {
  if (typeof window === 'undefined') {
    return getLocalBackendSocketUrl()
  }

  if (import.meta.env.DEV) {
    const host = window.location.hostname
    if (host === 'localhost' || host === '127.0.0.1') {
      // In local dev, connect directly to backend to avoid Vite WS proxy spam when backend is down.
      return getLocalBackendSocketUrl()
    }
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/ws/gps`
}

function getDefaultSocketBase() {
  if (typeof window === 'undefined') {
    return getLocalBackendSocketBase()
  }

  if (import.meta.env.DEV) {
    const host = window.location.hostname
    if (host === 'localhost' || host === '127.0.0.1') {
      return getLocalBackendSocketBase()
    }
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}`
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
}

function parseSocketMessage(rawData) {
  if (typeof rawData !== 'string') {
    return rawData
  }
  try {
    return JSON.parse(rawData)
  } catch {
    return rawData
  }
}

function scheduleReconnect() {
  if (!reconnectEnabled || reconnectTimer || !lastConnectOptions) {
    return
  }

  if (Number.isFinite(MAX_RECONNECT_ATTEMPTS) && reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    reconnectEnabled = false
    return
  }

  reconnectAttempts += 1
  const backoffMultiplier = Math.max(1, reconnectAttempts)
  const delay = Math.min(RECONNECT_DELAY_MS * backoffMultiplier, MAX_RECONNECT_DELAY_MS)

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connectGpsSocket(lastConnectOptions, { isReconnect: true })
  }, delay)
}

export function connectGpsSocket({
  url = import.meta.env.VITE_GPS_SOCKET_URL ?? getDefaultSocketUrl(),
  onMessage,
  onOpen,
  onClose,
} = {}, { isReconnect = false } = {}) {
  lastConnectOptions = { url, onMessage, onOpen, onClose }
  reconnectEnabled = true
  if (!isReconnect) {
    reconnectAttempts = 0
  }

  if (gpsSocket && (gpsSocket.readyState === WebSocket.OPEN || gpsSocket.readyState === WebSocket.CONNECTING)) {
    return gpsSocket
  }

  clearReconnectTimer()

  try {
    gpsSocket = new WebSocket(url)
  } catch {
    scheduleReconnect()
    return null
  }

  gpsSocket.addEventListener('open', (event) => {
    clearReconnectTimer()
    reconnectAttempts = 0
    if (onOpen) {
      onOpen(event)
    }
  })

  gpsSocket.addEventListener('message', (event) => {
    if (onMessage) {
      onMessage(parseSocketMessage(event.data))
    }
  })

  gpsSocket.addEventListener('close', (event) => {
    gpsSocket = null
    if (onClose) {
      onClose(event)
    }
    scheduleReconnect()
  })

  gpsSocket.addEventListener('error', () => {
    try {
      gpsSocket?.close()
    } catch {
      // Ignore socket close errors.
    }
  })

  return gpsSocket
}

export function disconnectGpsSocket() {
  reconnectEnabled = false
  lastConnectOptions = null
  reconnectAttempts = 0
  clearReconnectTimer()
  if (gpsSocket) {
    gpsSocket.close()
    gpsSocket = null
  }
}

export function getGpsSocket() {
  return gpsSocket
}

export function connectNotificationSocket(userId, { onMessage, onOpen, onClose } = {}) {
  const normalizedUser = String(userId || '').trim()
  if (!normalizedUser) {
    return null
  }

  if (
    notificationSocket &&
    (notificationSocket.readyState === WebSocket.OPEN || notificationSocket.readyState === WebSocket.CONNECTING)
  ) {
    return notificationSocket
  }

  const url = `${getDefaultSocketBase()}/ws/notifications/${encodeURIComponent(normalizedUser)}`
  try {
    notificationSocket = new WebSocket(url)
  } catch {
    return null
  }

  notificationSocket.addEventListener('open', (event) => {
    if (onOpen) onOpen(event)
  })

  notificationSocket.addEventListener('message', (event) => {
    if (onMessage) onMessage(parseSocketMessage(event.data))
  })

  notificationSocket.addEventListener('close', (event) => {
    notificationSocket = null
    if (onClose) onClose(event)
  })

  notificationSocket.addEventListener('error', () => {
    try {
      notificationSocket?.close()
    } catch {
      // Ignore socket close errors.
    }
  })

  return notificationSocket
}

export function disconnectNotificationSocket() {
  if (notificationSocket) {
    notificationSocket.close()
    notificationSocket = null
  }
}
