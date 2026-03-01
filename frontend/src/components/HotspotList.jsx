import { useState } from 'react'
import { LEVEL_COLORS } from '../constants.js'
import { postOptimize } from '../api/flows.js'

export function HotspotList({ hotspots, onDeployResult }) {
  const [deployingId, setDeployingId] = useState(null)

  const sorted = [...(hotspots || [])].sort(
    (a, b) => (b.peak_score ?? b.score ?? 0) - (a.peak_score ?? a.score ?? 0)
  )

  async function handleDeploy(hotspot) {
    const id = hotspot.intersection_id ?? hotspot.id
    setDeployingId(id)
    try {
      const result = await postOptimize()
      onDeployResult?.(result)
    } catch (err) {
      onDeployResult?.({ error: err.message })
    } finally {
      setDeployingId(null)
    }
  }

  if (!sorted.length) {
    return (
      <div className="h-full bg-[#0d1117] border border-[#21262d] rounded-lg p-4 flex items-center justify-center text-[#8b949e] text-sm">
        No hotspots
      </div>
    )
  }

  return (
    <div className="h-full bg-[#0d1117] border border-[#21262d] rounded-lg overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-[#21262d]">
        <h3 className="text-sm font-semibold text-white">Hotspots</h3>
      </div>
      <div className="flex-1 overflow-auto">
        {sorted.map((h) => {
          const name = h.name ?? h.intersection_id ?? h.id ?? '—'
          const score = h.peak_score ?? h.score ?? 0
          const level = (h.level || 'HIGH').toUpperCase()
          const color = LEVEL_COLORS[level] || LEVEL_COLORS.HIGH
          const id = h.intersection_id ?? h.id
          const isDeploying = deployingId === id
          return (
            <div
              key={id ?? name}
              className="px-4 py-3 border-b border-[#21262d] last:border-0"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-[#e6edf3] truncate">
                  {name}
                </span>
                <span
                  className="shrink-0 px-2 py-0.5 rounded text-xs font-medium text-white"
                  style={{ backgroundColor: color }}
                >
                  {level}
                </span>
              </div>
              <div className="mt-1 h-1.5 bg-[#21262d] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, score)}%`, backgroundColor: color }}
                />
              </div>
              <button
                type="button"
                onClick={() => handleDeploy(h)}
                disabled={isDeploying}
                className="mt-2 w-full py-1.5 rounded text-xs font-medium bg-[#21262d] text-[#e6edf3] hover:bg-[#30363d] disabled:opacity-50"
              >
                {isDeploying ? 'Deploying…' : 'Deploy Resource'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
