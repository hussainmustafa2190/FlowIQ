import { Sidebar } from './Sidebar.jsx'
import { useFlowDataContext } from '../context/FlowDataContext.jsx'
import { Dashboard } from '../pages/Dashboard.jsx'

export function Layout() {
  const { simulationMode } = useFlowDataContext()
  return (
    <div className="flex min-h-screen bg-[#060810]">
      <Sidebar simulationMode={simulationMode} />
      <main className="flex-1 overflow-auto">
        <Dashboard />
      </main>
    </div>
  )
}
