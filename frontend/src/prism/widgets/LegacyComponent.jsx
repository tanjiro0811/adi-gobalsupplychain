import { Suspense } from 'react'
import { useDynamicUI } from '../../dynamic-ui/DynamicUIContext'
import { legacyComponents } from '../legacyComponents'

function buildFallback() {
  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      Loading page...
    </main>
  )
}

export default function LegacyComponent({ componentKey, component, ...rest }) {
  const context = useDynamicUI()
  const key = String(componentKey ?? component ?? '').trim()
  const Component = legacyComponents[key]

  if (!Component) {
    return (
      <div style={{ padding: 12, border: '1px solid #ef4444', color: '#ef4444', borderRadius: 8 }}>
        Unknown legacy component: <strong>{key || '(missing)'}</strong>
      </div>
    )
  }

  const app = context.data?.app || {}
  const baseProps = {
    user: app.user,
    onLogout: context.actions?.logout,
    onNavigate: context.navigate,
    currentPath: app.currentPath,
    isGuest: Boolean(app.isGuest),
  }

  return (
    <Suspense fallback={buildFallback()}>
      <Component {...baseProps} {...rest} />
    </Suspense>
  )
}

