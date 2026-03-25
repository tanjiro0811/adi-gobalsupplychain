export function createWidgetRegistry(initialWidgets = {}) {
  const widgets = { ...initialWidgets }

  return {
    register(type, component) {
      const normalizedType = String(type || '').trim()
      if (!normalizedType) {
        throw new Error('Widget type must be a non-empty string')
      }
      if (typeof component !== 'function') {
        throw new Error(`Widget "${normalizedType}" must be a React component`)
      }
      widgets[normalizedType] = component
      return this
    },
    get(type) {
      return widgets[String(type || '').trim()]
    },
    has(type) {
      return Boolean(widgets[String(type || '').trim()])
    },
    list() {
      return { ...widgets }
    },
  }
}

