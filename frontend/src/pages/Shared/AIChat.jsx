import { useMemo, useRef, useState } from 'react'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { streamChatResponse } from '../../api/chatApi'

function buildId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function AIChat({ role = 'Admin', user, onLogout, onNavigate, currentPath }) {
  const [messages, setMessages] = useState(() => [
    {
      id: buildId(),
      role: 'assistant',
      content:
        "Ask me anything about inventory, shipments, forecasting, or the blockchain journey.\n\n" +
        "Try:\n" +
        "- /demand [120,128,134,140] horizon=4\n" +
        "- /delay distance_km=400 weather_score=0.2 traffic_score=0.4\n" +
        "- /tools",
    },
  ])
  const [prompt, setPrompt] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState('')
  const abortRef = useRef(null)

  const stats = useMemo(() => [], [])

  const stopStream = () => {
    abortRef.current?.abort?.()
    abortRef.current = null
    setIsStreaming(false)
  }

  const send = async () => {
    const question = String(prompt || '').trim()
    if (!question || isStreaming) {
      return
    }

    setError('')
    setPrompt('')
    setIsStreaming(true)

    const userId = buildId()
    const assistantId = buildId()

    setMessages((prev) => [
      ...prev,
      { id: userId, role: 'user', content: question },
      { id: assistantId, role: 'assistant', content: '' },
    ])

    const controller = new AbortController()
    abortRef.current = controller

    await streamChatResponse(question, {
      signal: controller.signal,
      onDelta: (delta) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: (m.content || '') + delta } : m)),
        )
      },
      onDone: () => {
        abortRef.current = null
        setIsStreaming(false)
      },
      onError: (err) => {
        abortRef.current = null
        setIsStreaming(false)
        setError(err?.message || 'Chat stream failed.')
      },
    })
  }

  return (
    <DashboardLayout
      role={role}
      userName={user?.name}
      onLogout={onLogout}
      onNavigate={onNavigate}
      currentPath={currentPath}
      stats={stats}
      notifications={0}
    >
      <section style={{ display: 'grid', gap: 12 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div>
            <h2 style={{ margin: 0 }}>AI Chat</h2>
            <p className="muted" style={{ margin: '6px 0 0' }}>
              Streaming responses from the backend (`/api/chat/stream`).
            </p>
          </div>
          {isStreaming ? (
            <button type="button" className="primary-btn" onClick={stopStream}>
              Stop
            </button>
          ) : null}
        </header>

        {error ? (
          <div style={{ padding: 12, border: '1px solid #ef4444', borderRadius: 12, background: '#fee2e2' }}>
            {error}
          </div>
        ) : null}

        <div
          style={{
            border: '1px solid rgba(148, 163, 184, 0.25)',
            borderRadius: 14,
            padding: 14,
            background: 'rgba(15, 23, 42, 0.35)',
            minHeight: 260,
          }}
        >
          <div style={{ display: 'grid', gap: 12 }}>
            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: 720,
                    whiteSpace: 'pre-wrap',
                    padding: '10px 12px',
                    borderRadius: 14,
                    border: '1px solid rgba(148, 163, 184, 0.28)',
                    background: m.role === 'user' ? 'rgba(59, 130, 246, 0.22)' : 'rgba(34, 197, 94, 0.14)',
                  }}
                >
                  {m.content || (m.role === 'assistant' && isStreaming ? '...' : '')}
                </div>
              </div>
            ))}
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
          style={{ display: 'grid', gap: 10 }}
        >
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask a question..."
            rows={3}
            disabled={isStreaming}
            style={{
              width: '100%',
              borderRadius: 14,
              padding: 12,
              border: '1px solid rgba(148, 163, 184, 0.35)',
              background: 'rgba(15, 23, 42, 0.35)',
              color: '#e2e8f0',
              resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="submit" className="primary-btn" disabled={!prompt.trim() || isStreaming}>
              Send
            </button>
          </div>
        </form>
      </section>
    </DashboardLayout>
  )
}

export default AIChat
