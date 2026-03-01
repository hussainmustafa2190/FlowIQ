import { useState, useMemo } from 'react'
import { LEVEL_COLORS } from '../constants.js'
import { postOptimize } from '../api/flows.js'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'CRITICAL', label: 'CRITICAL' },
  { id: 'HIGH', label: 'HIGH' },
]

const VISIBLE_INITIAL = 5

export function HotspotList({ hotspots, onDeployResult, deployedIntersectionIds = [] }) {
  const [deployingId, setDeployingId] = useState(null)
  const [filter, setFilter] = useState('all')
  const [visibleCount, setVisibleCount] = useState(VISIBLE_INITIAL)
  const deployedSet = useMemo(() => new Set(deployedIntersectionIds ?? []), [deployedIntersectionIds])

  const sorted = useMemo(() => {
    const list = [...(hotspots || [])]
    const levelOrder = { CRITICAL: 0, HIGH: 1 }
    return list.sort((a, b) => {
      const levelA = (a.level ?? a.congestion_level ?? 'HIGH').toUpperCase()
      const levelB = (b.level ?? b.congestion_level ?? 'HIGH').toUpperCase()
      const orderA = levelOrder[levelA] ?? 2
      const orderB = levelOrder[levelB] ?? 2
      if (orderA !== orderB) return orderA - orderB
      return (b.peak_score ?? b.congestion_score ?? b.score ?? 0) - (a.peak_score ?? a.congestion_score ?? a.score ?? 0)
    })
  }, [hotspots])

  const filtered = useMemo(() => {
    if (filter === 'all') return sorted
    return sorted.filter((h) => (h.level ?? h.congestion_level ?? 'HIGH').toUpperCase() === filter)
  }, [sorted, filter])

  const visible = filtered.slice(0, visibleCount)
  const hasMore = visibleCount < filtered.length
  const criticalCount = sorted.filter((h) => (h.level ?? h.congestion_level ?? '').toUpperCase() === 'CRITICAL').length
  const highCount = sorted.filter((h) => (h.level ?? h.congestion_level ?? '').toUpperCase() === 'HIGH').length

  async function handleDeploy(hotspot) {
    const id = hotspot.intersection_id ?? hotspot.id
    setDeployingId(id)
    try {
      const result = await postOptimize()
      onDeployResult?.(result, hotspot)
    } catch (err) {
      onDeployResult?.({ error: err.message }, hotspot)
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
        <p className="text-xs text-[#8b949e] mt-1">
          ⚠️ {sorted.length} active hotspots — {criticalCount} CRITICAL, {highCount} HIGH
        </p>
      </div>
      <div className="px-4 py-2 border-b border-[#21262d] flex gap-1">
        {FILTERS.map((f) => {
          const isActive = filter === f.id
          const isCritical = f.id === 'CRITICAL'
          const isHigh = f.id === 'HIGH'
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setFilter(f.id)
                setVisibleCount(VISIBLE_INITIAL)
              }}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                isActive
                  ? isCritical
                    ? 'bg-red-500/25 text-red-400 border border-red-500/40'
                    : isHigh
                      ? 'bg-orange-500/25 text-orange-400 border border-orange-500/40'
                      : 'bg-[#21262d] text-[#e6edf3] border border-[#30363d]'
                  : 'bg-transparent text-[#8b949e] border border-transparent hover:text-[#e6edf3]'
              }`}
            >
              {f.label}
            </button>
          )
        })}
      </div>
      <div className="flex-1 overflow-auto">
        {visible.map((h) => {
          const name = h.name ?? h.intersection_id ?? h.id ?? '—'
          const score = h.peak_score ?? h.congestion_score ?? h.score ?? 0
          const level = (h.level ?? h.congestion_level ?? 'HIGH').toUpperCase()
          const color = LEVEL_COLORS[level] || LEVEL_COLORS.HIGH
          const id = h.intersection_id ?? h.id
          const isDeploying = deployingId === id
          const isDeployed = deployedSet.has(id)
          const speed = h.speed ?? h.current_speed_mph ?? h.speed_mph
          const isCritical = level === 'CRITICAL'
          return (
            <div
              key={id ?? name}
              className="px-4 py-3 border-b border-[#21262d] last:border-0"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-[#e6edf3] truncate">
                  {name}
                </span>
                <span
                  className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium text-white ${isCritical ? 'pulse-badge' : ''}`}
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
              {speed != null && (
                <p className="text-xs text-[#8b949e] mt-0.5">
                  Current speed: {Number(speed).toFixed(0)} mph
                </p>
              )}
              <button
                type="button"
                onClick={() => handleDeploy(h)}
                disabled={isDeploying || isDeployed}
                className={`mt-2 w-full py-1.5 rounded text-xs font-medium disabled:opacity-50 ${
                  isDeployed
                    ? 'bg-emerald-500/25 text-emerald-400 border border-emerald-500/40 cursor-default'
                    : 'bg-[#21262d] text-[#e6edf3] hover:bg-[#30363d]'
                }`}
              >
                {isDeployed ? '✅ Deployed' : isDeploying ? 'Deploying…' : 'Deploy Resource'}
              </button>
            </div>
          )
        })}
      </div>
      {hasMore && (
        <div className="p-3 border-t border-[#21262d]">
          <button
            type="button"
            onClick={() => setVisibleCount((c) => c + VISIBLE_INITIAL)}
            className="w-full py-2 rounded text-xs font-medium bg-[#21262d] text-[#8b949e] hover:bg-[#30363d] hover:text-[#e6edf3]"
          >
            Show More
          </button>
        </div>
      )}
    </div>
  )
}
