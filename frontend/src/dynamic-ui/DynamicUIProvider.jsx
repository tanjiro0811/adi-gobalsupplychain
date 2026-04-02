import { useMemo, useState } from 'react'
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
  const [eventBus] = useState(() => createEventBus())

  const contextValue = useMemo(
    () => ({
      registry,
      data,
      actions,
      params,
      env,
      navigate,
      eventBus,
      uiState,
      setUiState,
      scope: {},
    }),
    [actions, data, env, eventBus, navigate, params, registry, uiState],
  )

  return <DynamicUIContext.Provider value={contextValue}>{children}</DynamicUIContext.Provider>
}
