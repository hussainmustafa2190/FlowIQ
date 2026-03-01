import { useState, useEffect } from 'react'
import { useApiHealth } from '../hooks/useApiHealth.js'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'hotspots', label: 'Hotspots' },
  { id: 'resources', label: 'Resources' },
  { id: 'analytics', label: 'Analytics' },
]

export function Sidebar({ simulationMode, currentView, onNavigate }) {
  const [time, setTime] = useState(new Date())
  const apiOk = useApiHealth()

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <aside className="w-60 shrink-0 bg-[#0d1117] border-r border-[#21262d] flex flex-col min-h-screen">
      <div className="p-5 border-b border-[#21262d]">
        <h1 className="text-xl font-bold text-white tracking-tight">FlowQ</h1>
        <p className="text-xs text-[#8b949e] mt-0.5">Predict. Optimize. Act.</p>
      </div>
      <nav className="flex-1 p-3">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate?.(item.id)}
            className={`w-full text-left flex items-center px-3 py-2 rounded-lg text-sm mb-1 transition-colors ${
              currentView === item.id ? 'bg-[#21262d] text-white' : 'text-[#e6edf3] hover:bg-[#21262d]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="p-4 border-t border-[#21262d] space-y-3">
        <div className="flex items-center gap-2 text-sm text-[#8b949e]">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: apiOk === true ? '#34d399' : apiOk === false ? '#fb7185' : '#6b7280' }}
          />
          {apiOk === true ? 'API connected' : apiOk === false ? 'API offline' : 'Checking…'}
        </div>
        <div className="text-sm font-mono text-[#8b949e]">
          {time.toLocaleTimeString()}
        </div>
        {simulationMode && (
          <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
            Simulation Mode
          </span>
        )}
      </div>
    </aside>
  )
}
