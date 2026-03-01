import { useState } from 'react'
import { Sidebar } from './Sidebar.jsx'
import { useFlowDataContext } from '../context/FlowDataContext.jsx'
import { Dashboard } from '../pages/Dashboard.jsx'
import { HotspotsPage } from '../pages/HotspotsPage.jsx'
import { ResourcesPage } from '../pages/ResourcesPage.jsx'
import { AnalyticsPage } from '../pages/AnalyticsPage.jsx'
import { Toast } from './Toast.jsx'

export function Layout() {
  const { simulationMode } = useFlowDataContext()
  const [currentView, setCurrentView] = useState('dashboard')
  const [toast, setToast] = useState({ message: '', visible: false })

  const showToast = (message) => setToast({ message, visible: true })
  const dismissToast = () => setToast((t) => ({ ...t, visible: false }))

  return (
    <div className="flex min-h-screen bg-[#060810]">
      <Sidebar
        simulationMode={simulationMode}
        currentView={currentView}
        onNavigate={setCurrentView}
      />
      <main className="flex-1 overflow-auto">
        {currentView === 'dashboard' && <Dashboard setToast={showToast} />}
        {currentView === 'hotspots' && <HotspotsPage />}
        {currentView === 'resources' && <ResourcesPage />}
        {currentView === 'analytics' && <AnalyticsPage />}
      </main>
      <Toast
        message={toast.message}
        visible={toast.visible}
        onDismiss={dismissToast}
      />
    </div>
  )
}
