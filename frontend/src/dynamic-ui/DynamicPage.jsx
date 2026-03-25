import { useEffect, useState } from 'react'
import DynamicRenderer from './DynamicRenderer'

function defaultFetchOptions() {
  return { headers: { Accept: 'application/json' } }
}

export default function DynamicPage({
  src,
  node,
  refreshMs = 0,
  cacheBust = true,
  fallback = null,
}) {
  const [loadedNode, setLoadedNode] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const effectiveNode = node ?? loadedNode

  useEffect(() => {
    if (!src) return undefined

    let active = true
    let timer = null

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const baseUrl = String(src)
        const url = cacheBust
          ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}t=${Date.now()}`
          : baseUrl
        const response = await fetch(url, defaultFetchOptions())
        if (!response.ok) {
          throw new Error(`Failed to load UI metadata (${response.status})`)
        }
        const payload = await response.json()
        if (active) setLoadedNode(payload)
      } catch (err) {
        if (active) setError(err?.message || 'Failed to load UI metadata')
      } finally {
        if (active) setLoading(false)
      }
    }

    load()

    if (refreshMs && refreshMs > 0) {
      timer = setInterval(load, refreshMs)
    }

    return () => {
      active = false
      if (timer) clearInterval(timer)
    }
  }, [cacheBust, refreshMs, src])

  if (loading && !effectiveNode) {
    return fallback
  }

  if (error && !effectiveNode) {
    return (
      <div style={{ padding: 12, border: '1px solid #ef4444', color: '#ef4444', borderRadius: 8 }}>
        {error}
      </div>
    )
  }

  if (!effectiveNode) {
    return fallback
  }

  return <DynamicRenderer node={effectiveNode} />
}
