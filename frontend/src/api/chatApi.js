import { getAuthState } from '../store/useAuthStore'

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? 'http://127.0.0.1:8000/api' : '/api')
).replace(/\/+$/, '')

function buildUrl(path) {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${normalizedPath}`
}

function parseSseEvent(rawEvent) {
  const lines = String(rawEvent || '').split('\n')
  let eventType = 'message'
  let data = ''

  for (const line of lines) {
    if (line.startsWith('event:')) {
      eventType = line.slice('event:'.length).trim() || 'message'
      continue
    }
    if (line.startsWith('data:')) {
      data += line.slice('data:'.length).trim()
      continue
    }
  }

  return { event: eventType, data }
}

export async function streamChatResponse(prompt, { onDelta, onError, onDone, signal } = {}) {
  const auth = getAuthState()
  const headers = { 'Content-Type': 'application/json' }
  if (auth?.token) {
    headers.Authorization = `Bearer ${auth.token}`
  }

  let response
  try {
    response = await fetch(buildUrl('/chat/stream'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ q: String(prompt || '') }),
      signal,
    })
  } catch (error) {
    onError?.(error)
    return
  }

  if (!response.ok || !response.body) {
    const error = new Error(`Chat request failed (${response.status})`)
    error.status = response.status
    onError?.(error)
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })

      const parts = buffer.split('\n\n')
      buffer = parts.pop() || ''

      for (const part of parts) {
        const { event, data } = parseSseEvent(part)
        if (event === 'done') {
          onDone?.()
          return
        }

        if (!data) {
          continue
        }

        try {
          const payload = JSON.parse(data)
          const delta = payload?.delta
          if (typeof delta === 'string' && delta) {
            onDelta?.(delta)
          }
        } catch {
          onDelta?.(data)
        }
      }
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      return
    }
    onError?.(error)
    return
  } finally {
    try {
      reader.releaseLock()
    } catch {
      // ignore
    }
  }

  onDone?.()
}

