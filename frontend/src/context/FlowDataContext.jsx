import { createContext, useContext } from 'react'
import { useFlowData } from '../hooks/useFlowData.js'

const FlowDataContext = createContext(null)

export function FlowDataProvider({ children }) {
  const value = useFlowData()
  return (
    <FlowDataContext.Provider value={value}>
      {children}
    </FlowDataContext.Provider>
  )
}

export function useFlowDataContext() {
  const ctx = useContext(FlowDataContext)
  if (!ctx) throw new Error('useFlowDataContext must be used within FlowDataProvider')
  return ctx
}
