import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { useFlowDataContext } from '../context/FlowDataContext.jsx'
import { StatsRow } from '../components/StatsRow.jsx'
import { LiveMap } from '../components/LiveMap.jsx'
import { ForecastChart } from '../components/ForecastChart.jsx'
import { ErrorBoundary } from '../components/ErrorBoundary.jsx'
import { LEVEL_COLORS } from '../constants.js'
import { postPredict } from '../api/flows.js'

function levelFromScore(score) {
  if (score == null) return 'NORMAL'
  if (score > 75) return 'CRITICAL'
  if (score > 50) return 'HIGH'
  if (score > 25) return 'NORMAL'
  return 'LOW'
}

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'CRITICAL', label: 'CRITICAL' },
  { id: 'HIGH', label: 'HIGH' },
]

export function HotspotsPage() {
  const mapRef = useRef(null)
  const { loading, error, hotspots, intersections, simulationMode } = useFlowDataContext()
  const [filter, setFilter] = useState('all')
  const [selectedIntersection, setSelectedIntersection] = useState(null)
  const [forecastResult, setForecastResult] = useState(null)
  const [forecastLoading, setForecastLoading] = useState(false)
  const [forecastError, setForecastError] = useState(false)

  const sorted = useMemo(() => {
    const list = (intersections ?? []).map((i) => ({
      ...i,
      _level: levelFromScore(i.congestion_score ?? i.current_score ?? i.score ?? 0),
    }))
    const levelOrder = { CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3 }
    return list.sort((a, b) => {
      const orderA = levelOrder[a._level] ?? 4
      const orderB = levelOrder[b._level] ?? 4
      if (orderA !== orderB) return orderA - orderB
      return (b.congestion_score ?? b.current_score ?? b.score ?? 0) - (a.congestion_score ?? a.current_score ?? a.score ?? 0)
    })
  }, [intersections])

  const filtered = useMemo(() => {
    if (filter === 'all') return sorted
    return sorted.filter((h) => h._level === filter)
  }, [sorted, filter])

  const criticalCount = sorted.filter((h) => h._level === 'CRITICAL').length
  const highCount = sorted.filter((h) => h._level === 'HIGH').length

  const fetchForecast = useCallback(async (intersection) => {
    const id = intersection?.id ?? intersection?.intersection_id
    if (!id) return
    setForecastLoading(true)
    setForecastError(false)
    try {
      const data = await postPredict(id, 3)
      const forecast = Array.isArray(data) ? data : data?.forecast ?? []
      setForecastResult({
        forecast,
        peak_score: data?.peak_score,
        peak_at_minutes: data?.peak_at_minutes,
        risk_score: data?.risk_score,
        risk_details: data?.risk_details,
      })
    } catch {
      setForecastResult(null)
      setForecastError(true)
    } finally {
      setForecastLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedIntersection) fetchForecast(selectedIntersection)
    else setForecastResult(null)
  }, [selectedIntersection, fetchForecast])

  const handleHotspotClick = useCallback(
    (hotspot) => {
      setSelectedIntersection(hotspot)
      let lng = hotspot.lng ?? hotspot.longitude
      let lat = hotspot.lat ?? hotspot.latitude
      if (lat == null || lng == null) {
        const id = hotspot.intersection_id ?? hotspot.id
        const match = (intersections ?? []).find(
          (i) => (i.intersection_id ?? i.id) === id
        )
        if (match) {
          lng = match.lng ?? match.longitude
          lat = match.lat ?? match.latitude
        }
      }
      if (lat != null && lng != null && mapRef.current?.flyTo) {
        mapRef.current.flyTo(lng, lat)
      }
    },
    [intersections]
  )

  const maxCongestion =
    intersections?.length > 0
      ? Math.max(...intersections.map((i) => i.congestion_score ?? i.current_score ?? i.score ?? 0))
      : null

  const mapIntersections = useMemo(() => {
    const byId = new Map()
    ;(intersections ?? []).forEach((i) => {
      const id = i.id ?? i.intersection_id
      if (id != null) byId.set(id, i)
    })
    ;(hotspots ?? []).forEach((h) => {
      const id = h.id ?? h.intersection_id
      if (id != null && !byId.has(id)) byId.set(id, { ...h })
    })
    return byId.size > 0 ? Array.from(byId.values()) : (intersections ?? [])
  }, [intersections, hotspots])

  return (
    <div className="flex flex-col min-h-full">
      {error && (
        <div className="mx-4 mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 p-4">
        <div className="flex-1 min-w-0">
          <StatsRow
            loading={loading}
            hotspotsCount={hotspots?.length ?? 0}
            maxCongestion={maxCongestion}
            deployedCount={0}
            avgResponseTime="2.4 min"
            intersectionsCount={intersections?.length ?? 0}
            live={simulationMode === false}
          />
        </div>
      </div>
      <div className="px-4 pb-4">
        <div className="h-[280px] rounded-lg overflow-hidden border border-[#21262d]">
          <LiveMap
            ref={mapRef}
            intersections={mapIntersections}
            onSelectIntersection={setSelectedIntersection}
            selectedId={selectedIntersection?.id ?? selectedIntersection?.intersection_id}
            loading={loading}
          />
        </div>
      </div>
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-4 p-4 min-h-0">
        <div className="bg-[#0d1117] border border-[#21262d] rounded-lg overflow-hidden flex flex-col min-h-[300px]">
          <div className="px-4 py-3 border-b border-[#21262d]">
            <h2 className="text-sm font-semibold text-white">All Hotspots</h2>
            <p className="text-xs text-[#8b949e] mt-1">
              {sorted.length} intersections — {criticalCount} CRITICAL, {highCount} HIGH
            </p>
          </div>
          <div className="px-4 py-2 border-b border-[#21262d] flex gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 rounded text-xs font-medium ${
                  filter === f.id
                    ? f.id === 'CRITICAL'
                      ? 'bg-red-500/25 text-red-400 border border-red-500/40'
                      : f.id === 'HIGH'
                        ? 'bg-orange-500/25 text-orange-400 border border-orange-500/40'
                        : 'bg-[#21262d] text-[#e6edf3] border border-[#30363d]'
                    : 'bg-transparent text-[#8b949e] border border-transparent hover:text-[#e6edf3]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-auto p-4 grid gap-3">
            {filtered.length === 0 ? (
              <p className="text-sm text-[#8b949e]">No hotspots</p>
            ) : (
              filtered.map((h) => {
                const name = h.name ?? h.intersection_id ?? h.id ?? '—'
                const score = h.peak_score ?? h.congestion_score ?? h.score ?? 0
                const level = (h._level ?? h.level ?? h.congestion_level ?? 'NORMAL').toUpperCase()
                const color = LEVEL_COLORS[level] ?? LEVEL_COLORS.HIGH
                const speed = h.speed ?? h.current_speed_mph
                const riskScore = h.risk_score ?? '—'
                const isSelected = selectedIntersection && (selectedIntersection.id === h.id || selectedIntersection.intersection_id === h.intersection_id)
                return (
                  <button
                    key={h.id ?? h.intersection_id}
                    type="button"
                    onClick={() => handleHotspotClick(h)}
                    className={`w-full text-left p-4 rounded-lg border transition-colors ${
                      isSelected ? 'border-cyan-500/50 bg-cyan-500/10' : 'border-[#21262d] bg-[#0d1117] hover:bg-[#161b22]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[#e6edf3]">{name}</span>
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium text-white"
                        style={{ backgroundColor: color }}
                      >
                        {level}
                      </span>
                    </div>
                    <div className="mt-2 h-2 bg-[#21262d] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, score)}%`, backgroundColor: color }} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-[#8b949e]">
                      {speed != null && <span>Speed: {Number(speed).toFixed(0)} mph</span>}
                      <span>Risk: {typeof riskScore === 'number' ? riskScore.toFixed(0) : riskScore}</span>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
        <div className="min-h-[280px]">
          <ErrorBoundary
            fallback={
              <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-4 flex items-center justify-center min-h-[200px] text-[#8b949e] text-sm">
                Unable to load forecast
              </div>
            }
          >
            <ForecastChart
              forecastResult={forecastResult}
              selectedIntersection={selectedIntersection}
              loading={forecastLoading && !!selectedIntersection}
              forecastError={forecastError}
            />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  )
}
