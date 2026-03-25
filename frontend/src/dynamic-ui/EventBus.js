export function createEventBus() {
  const listenersByEvent = new Map()

  function on(eventName, handler) {
    const name = String(eventName || '').trim()
    if (!name) {
      throw new Error('Event name must be a non-empty string')
    }
    if (typeof handler !== 'function') {
      throw new Error('Event handler must be a function')
    }

    const set = listenersByEvent.get(name) ?? new Set()
    set.add(handler)
    listenersByEvent.set(name, set)

    return () => {
      const current = listenersByEvent.get(name)
      if (!current) return
      current.delete(handler)
      if (!current.size) {
        listenersByEvent.delete(name)
      }
    }
  }

  function emit(eventName, payload) {
    const name = String(eventName || '').trim()
    if (!name) return
    const handlers = listenersByEvent.get(name)
    if (!handlers || !handlers.size) return
    for (const handler of [...handlers]) {
      handler(payload)
    }
  }

  function clear() {
    listenersByEvent.clear()
  }

  return Object.freeze({ on, emit, clear })
}

