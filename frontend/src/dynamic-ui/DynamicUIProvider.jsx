import { useMemo, useRef, useState } from 'react'
import { DynamicUIContext } from './DynamicUIContext'
import { createEventBus } from './EventBus'

export default function DynamicUIProvider({
  registry,
  data = {},
  actions = {},
  params = {},
  env = {},
  navigate,
  children,
}) {
  const [uiState, setUiState] = useState({})
  const eventBusRef = useRef(null)
  if (!eventBusRef.current) {
    eventBusRef.current = createEventBus()
  }

  const contextValue = useMemo(
    () => ({
      registry,
      data,
      actions,
      params,
      env,
      navigate,
      eventBus: eventBusRef.current,
      uiState,
      setUiState,
      scope: {},
    }),
    [actions, data, env, navigate, params, registry, uiState],
  )

  return <DynamicUIContext.Provider value={contextValue}>{children}</DynamicUIContext.Provider>
}
