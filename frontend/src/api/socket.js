let gpsSocket = null

function getDefaultSocketUrl() {
  if (typeof window === 'undefined') {
    return 'ws://localhost:8000/ws/gps'
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/ws/gps`
}

export function connectGpsSocket({
  url = import.meta.env.VITE_GPS_SOCKET_URL ?? getDefaultSocketUrl(),
  onMessage,
  onOpen,
  onClose,
} = {}) {
  if (gpsSocket && gpsSocket.readyState <= WebSocket.OPEN) {
    return gpsSocket
  }

  try {
    gpsSocket = new WebSocket(url)
  } catch {
    return null
  }

  if (onOpen) {
    gpsSocket.addEventListener('open', onOpen)
  }

  if (onClose) {
    gpsSocket.addEventListener('close', onClose)
  }

  if (onMessage) {
    gpsSocket.addEventListener('message', (event) => {
      try {
        onMessage(JSON.parse(event.data))
      } catch {
        onMessage(event.data)
      }
    })
  }

  return gpsSocket
}

export function disconnectGpsSocket() {
  if (gpsSocket) {
    gpsSocket.close()
    gpsSocket = null
  }
}

export function getGpsSocket() {
  return gpsSocket
}
