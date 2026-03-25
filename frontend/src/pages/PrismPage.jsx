import { useMemo } from 'react'
import DynamicUIProvider from '../dynamic-ui/DynamicUIProvider'
import DynamicPage from '../dynamic-ui/DynamicPage'
import { createPrismWidgetRegistry } from '../prism/widgetRegistry'

const PRISM_REGISTRY = createPrismWidgetRegistry()

export default function PrismPage({ pageId, user, role, isGuest, onLogout, onNavigate, currentPath }) {
  const data = useMemo(
    () => ({
      app: {
        user,
        role,
        isGuest: Boolean(isGuest),
        currentPath,
      },
      page: {
        id: pageId,
      },
    }),
    [currentPath, isGuest, pageId, role, user],
  )

  const actions = useMemo(() => ({ logout: () => onLogout?.() }), [onLogout])

  return (
    <DynamicUIProvider registry={PRISM_REGISTRY} data={data} actions={actions} navigate={onNavigate}>
      <DynamicPage src={`/dynamic-pages/${encodeURIComponent(pageId)}.json`} fallback={null} />
    </DynamicUIProvider>
  )
}

