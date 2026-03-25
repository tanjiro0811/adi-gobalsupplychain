function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && value.constructor === Object
}

function normalizePath(path) {
  return String(path || '').trim()
}

export function getByPath(root, path) {
  const normalized = normalizePath(path)
  if (!normalized) return undefined

  const segments = []
  const pattern = /[^.[\]]+|\[(\d+)\]/g
  for (const match of normalized.matchAll(pattern)) {
    if (match[1] !== undefined) {
      segments.push(Number(match[1]))
    } else {
      segments.push(match[0])
    }
  }

  let current = root
  for (const segment of segments) {
    if (current == null) return undefined
    current = current[segment]
  }
  return current
}

export function resolveTemplate(text, context) {
  const raw = String(text ?? '')
  if (!raw.includes('{{')) return raw

  return raw.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, expr) => {
    const value = getByPath(context, expr)
    if (value == null) return ''
    return typeof value === 'string' || typeof value === 'number' ? String(value) : JSON.stringify(value)
  })
}

export function resolveValue(value, context) {
  if (value == null) return value

  if (typeof value === 'string') {
    return resolveTemplate(value, context)
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveValue(item, context))
  }

  if (isPlainObject(value)) {
    if ('$concat' in value) {
      const parts = Array.isArray(value.$concat) ? value.$concat : []
      return parts.map((part) => resolveValue(part, context)).join('')
    }

    if ('$eq' in value) {
      const items = Array.isArray(value.$eq) ? value.$eq : []
      if (items.length < 2) return false
      const left = resolveValue(items[0], context)
      const right = resolveValue(items[1], context)
      return left === right
    }

    if ('$cond' in value) {
      const spec = value.$cond
      if (!isPlainObject(spec)) return undefined
      const condition = Boolean(resolveValue(spec.if, context))
      return condition ? resolveValue(spec.then, context) : resolveValue(spec.else, context)
    }

    if ('$ref' in value) {
      return getByPath(context, value.$ref)
    }
    if ('$literal' in value) {
      return value.$literal
    }
    const resolved = {}
    for (const [key, child] of Object.entries(value)) {
      resolved[key] = resolveValue(child, context)
    }
    return resolved
  }

  return value
}

function setByPath(root, path, nextValue) {
  const normalized = normalizePath(path)
  if (!normalized) return root

  const segments = []
  const pattern = /[^.[\]]+|\[(\d+)\]/g
  for (const match of normalized.matchAll(pattern)) {
    if (match[1] !== undefined) {
      segments.push(Number(match[1]))
    } else {
      segments.push(match[0])
    }
  }

  const copyRoot = Array.isArray(root) ? [...root] : { ...(root || {}) }
  let current = copyRoot
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]
    const isLeaf = index === segments.length - 1
    if (isLeaf) {
      current[segment] = nextValue
      break
    }

    const existing = current[segment]
    const nextContainer =
      Array.isArray(existing) ? [...existing] : isPlainObject(existing) ? { ...existing } : {}
    current[segment] = nextContainer
    current = nextContainer
  }

  return copyRoot
}

export function dispatchAction(actionSpec, context, event) {
  if (!actionSpec) return

  if (Array.isArray(actionSpec)) {
    for (const item of actionSpec) {
      dispatchAction(item, context, event)
    }
    return
  }

  if (typeof actionSpec === 'string') {
    dispatchAction({ $action: actionSpec }, context, event)
    return
  }

  if (!isPlainObject(actionSpec) || !actionSpec.$action) {
    return
  }

  const kind = String(actionSpec.$action || '').trim()

  if (kind === 'preventDefault') {
    event?.preventDefault?.()
    return
  }

  if (kind === 'stopPropagation') {
    event?.stopPropagation?.()
    return
  }

  if (kind === 'navigate') {
    const to = resolveValue(actionSpec.to, context)
    if (typeof to === 'string' && to && typeof context.navigate === 'function') {
      context.navigate(to)
    }
    return
  }

  if (kind === 'emit') {
    const name = resolveValue(actionSpec.event ?? actionSpec.name, context)
    const eventName = typeof name === 'string' ? name : ''
    const payload = resolveValue(actionSpec.payload, context)
    if (eventName && context.eventBus?.emit) {
      context.eventBus.emit(eventName, payload)
    }
    return
  }

  if (kind === 'setState') {
    const path = String(actionSpec.path || '').trim()
    if (!path || typeof context.setUiState !== 'function') return
    const nextValue = resolveValue(actionSpec.value, context)
    context.setUiState((prev) => setByPath(prev, path, nextValue))
    return
  }

  if (kind === 'call') {
    const name = String(actionSpec.name || '').trim()
    const fn = name ? context.actions?.[name] : null
    if (typeof fn !== 'function') return

    const resolvedArgs = Array.isArray(actionSpec.args)
      ? actionSpec.args.map((arg) => resolveValue(arg, context))
      : []
    fn(...resolvedArgs)
  }
}

export function isActionLike(value) {
  if (!value) return false
  if (Array.isArray(value)) return value.some(isActionLike)
  return isPlainObject(value) && typeof value.$action === 'string'
}
