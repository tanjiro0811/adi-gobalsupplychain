import { Fragment, createElement, useEffect, useMemo, useRef } from 'react'
import { dispatchAction, isActionLike, resolveValue } from './resolve'
import { useDynamicUI } from './DynamicUIContext'

function renderPrimitive(value) {
  if (value == null || value === false) return null
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return JSON.stringify(value)
}

function normalizeListenerSpec(raw) {
  if (!raw || typeof raw !== 'object') return null
  const event = String(raw.event ?? raw.on ?? '').trim()
  if (!event) return null
  const action = raw.action ?? raw.do ?? raw.actions ?? raw.then
  return { event, action }
}

function normalizeEmitterSpec(raw) {
  if (!raw) return null
  if (typeof raw === 'string') {
    return { event: raw, payload: undefined }
  }
  if (typeof raw === 'object') {
    const event = String(raw.event ?? raw.emit ?? raw.name ?? '').trim()
    if (!event) return null
    return { event, payload: raw.payload }
  }
  return null
}

function WidgetNode({ node, context }) {
  const type = String(node.type || node.widget || '').trim()
  const Widget = context.registry?.get(type)

  const rawProps = node.props && typeof node.props === 'object' ? node.props : {}
  const rawStyles = node.styles && typeof node.styles === 'object' ? node.styles : null
  const rawConfig = node.config && typeof node.config === 'object' ? node.config : null

  const listeners = useMemo(() => {
    const raw = node.events?.listeners
    if (!Array.isArray(raw)) return []
    return raw.map(normalizeListenerSpec).filter(Boolean)
  }, [node.events?.listeners])

  const contextRef = useRef(context)
  useEffect(() => {
    contextRef.current = context
  }, [context])

  useEffect(() => {
    if (!listeners.length || !context.eventBus?.on) return undefined
    const unsubs = listeners.map((listener) =>
      context.eventBus.on(listener.event, (payload) => {
        const latest = contextRef.current
        dispatchAction(listener.action, { ...latest, event: { name: listener.event, payload } })
      }),
    )
    return () => {
      for (const unsub of unsubs) unsub?.()
    }
  }, [context.eventBus, listeners])

  useEffect(() => {
    if (!node.init) return
    dispatchAction(node.init, contextRef.current)
  }, [node.init])

  if (!Widget) {
    return (
      <div style={{ padding: 12, border: '1px solid #ef4444', color: '#ef4444', borderRadius: 8 }}>
        Unknown widget: <strong>{type}</strong>
      </div>
    )
  }

  const resolvedProps = {}
  for (const [key, value] of Object.entries(rawProps)) {
    if (key.startsWith('on') && isActionLike(value)) {
      resolvedProps[key] = (event) => dispatchAction(value, context, event)
      continue
    }
    resolvedProps[key] = resolveValue(value, context)
  }

  if (rawStyles) {
    const resolvedStyles = resolveValue(rawStyles, context)
    if (resolvedStyles && typeof resolvedStyles === 'object') {
      resolvedProps.style = { ...(resolvedProps.style || {}), ...resolvedStyles }
    }
  }

  if (rawConfig) {
    resolvedProps.config = resolveValue(rawConfig, context)
  }

  const rawEmitters = node.events?.emitters
  if (rawEmitters && typeof rawEmitters === 'object') {
    for (const [propName, spec] of Object.entries(rawEmitters)) {
      const emitter = normalizeEmitterSpec(spec)
      if (!emitter) continue
      const previous = resolvedProps[propName]
      resolvedProps[propName] = (event) => {
        if (typeof previous === 'function') {
          previous(event)
        }
        if (context.eventBus?.emit) {
          context.eventBus.emit(emitter.event, resolveValue(emitter.payload, context))
        }
      }
    }
  }

  const children = <DynamicNode node={node.children} context={context} />
  const key = node.key ?? node.id
  const elementProps = key != null ? { ...resolvedProps, key } : resolvedProps

  return createElement(Widget, elementProps, children)
}

function DynamicNode({ node, context }) {
  if (node == null || node === false) return null

  if (Array.isArray(node)) {
    return node.map((child, index) => (
      <Fragment key={child?.key ?? child?.id ?? index}>
        <DynamicNode node={child} context={context} />
      </Fragment>
    ))
  }

  if (typeof node === 'string' || typeof node === 'number') {
    return renderPrimitive(node)
  }

  if (typeof node !== 'object') {
    return null
  }

  if (node.$ref) {
    return renderPrimitive(resolveValue(node, context))
  }

  const type = String(node.type || node.widget || '').trim()
  if (!type) return null

  if (type === 'If') {
    const when = Boolean(resolveValue(node.props?.when, context))
    const branch = when ? node.children : node.props?.else
    return <DynamicNode node={branch} context={context} />
  }

  if (type === 'Repeat') {
    const items = resolveValue(node.props?.items, context)
    if (!Array.isArray(items) || items.length === 0) return null
    const alias = String(node.props?.as || 'item').trim() || 'item'
    const indexAlias = String(node.props?.indexAs || 'index').trim() || 'index'

    return items.map((item, index) => {
      const nextContext = {
        ...context,
        scope: {
          ...(context.scope || {}),
          [alias]: item,
          [indexAlias]: index,
        },
      }
      return (
        <Fragment key={item?.id ?? item?.key ?? `${alias}-${index}`}>
          <DynamicNode node={node.children} context={nextContext} />
        </Fragment>
      )
    })
  }

  return <WidgetNode node={node} context={context} />
}

export default function DynamicRenderer({ node }) {
  const context = useDynamicUI()
  return <DynamicNode node={node} context={context} />
}
