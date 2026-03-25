import { createContext, useContext } from 'react'

export const DynamicUIContext = createContext(null)

export function useDynamicUI() {
  const value = useContext(DynamicUIContext)
  if (!value) {
    throw new Error('useDynamicUI must be used within <DynamicUIProvider>')
  }
  return value
}

