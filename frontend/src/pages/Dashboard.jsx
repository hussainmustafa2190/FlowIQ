import { useState, useEffect, useCallback, useMemo } from 'react'
import { useFlowDataContext } from '../context/FlowDataContext.jsx'
import { StatsRow } from '../components/StatsRow.jsx'
import { LiveMap } from '../components/LiveMap.jsx'
import { HotspotList } from '../components/HotspotList.jsx'
import { ForecastChart } from '../components/ForecastChart.jsx'
import { ResourceTable } from '../components/ResourceTable.jsx'
import { ErrorBoundary } from '../components/ErrorBoundary.jsx'
import { WeatherWidget } from '../components/WeatherWidget.jsx'
import { postPredict } from '../api/flows.js'

export function Dashboard({ setToast }) {
  const {
    loading,
    error,
    intersections,
    hotspots,
    assignments,
    refetch,
    simulationMode,
  } = useFlowDataContext()

  const [selectedIntersection, setSelectedIntersection] = useState(null)
  const [forecastResult, setForecastResult] = useState(null)
  const [forecastLoading, setForecastLoading] = useState(false)
  const [forecastError, setForecastError] = useState(false)
  const [assignmentsLocal, setAssignmentsLocal] = useState(assignments)

  useEffect(() => {
    setAssignmentsLocal(assignments)
  }, [assignments])

  const fetchForecast = useCallback(async (intersection) => {
    const id = intersection?.id ?? intersection?.intersection_id
    if (!id) return
    setForecastLoading(true)
    setForecastError(false)
    try {
      const data = await postPredict(id, 3)
      const forecast = Array.isArray(data) ? data : data?.forecast ?? []
      const peak_score = data?.peak_score
      const peak_at_minutes = data?.peak_at_minutes
      const risk_score = data?.risk_score
      const risk_details = data?.risk_details
      setForecastResult({
        forecast,
        peak_score,
        peak_at_minutes,
        risk_score,
        risk_details,
      })
      setForecastError(false)
    } catch {
      setForecastResult(null)
      setForecastError(true)
    } finally {
      setForecastLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedIntersection) {
      fetchForecast(selectedIntersection)
    } else {
      setForecastResult(null)
    }
  }, [selectedIntersection, fetchForecast])

  function handleDeployResult(result, hotspot) {
    if (result?.error) return
    const next = Array.isArray(result) ? result : result?.assignments ?? result?.deployments ?? []
    setAssignmentsLocal(next)
    refetch()
    const name = result?.assignments?.[0]?.intersection_name ?? hotspot?.name ?? hotspot?.intersection_id ?? 'location'
    setToast?.(`✅ Resource deployed to ${name}`)
  }

  const maxCongestion =
    intersections.length > 0
      ? Math.max(...intersections.map((i) => i.congestion_score ?? i.current_score ?? i.score ?? 0))
      : null

  const mapIntersections = useMemo(() => {
    const byId = new Map()
    intersections.forEach((i) => {
      const id = i.id ?? i.intersection_id
      if (id != null) byId.set(id, i)
    })
    hotspots.forEach((h) => {
      const id = h.id ?? h.intersection_id
      if (id != null && !byId.has(id)) byId.set(id, { ...h })
    })
    return byId.size > 0 ? Array.from(byId.values()) : intersections
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
            deployedCount={assignmentsLocal?.length ?? 0}
            avgResponseTime="2.4 min"
            intersectionsCount={intersections?.length ?? 0}
            live={simulationMode === false}
          />
        </div>
        <div className="shrink-0 sm:pt-4">
          <WeatherWidget />
        </div>
      </div>
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[60%_40%] gap-4 p-4 min-h-0">
        <div className="min-h-[320px] lg:min-h-[400px] relative">
          <LiveMap
            intersections={mapIntersections}
            onSelectIntersection={setSelectedIntersection}
            selectedId={selectedIntersection?.id ?? selectedIntersection?.intersection_id}
            loading={loading}
          />
        </div>
        <div className="min-h-[240px] lg:min-h-[400px]">
          <HotspotList
            hotspots={hotspots}
            onDeployResult={handleDeployResult}
            deployedIntersectionIds={assignmentsLocal?.map((a) => a.intersection_id) ?? []}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
        <ErrorBoundary
          fallback={
            <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-4 flex items-center justify-center min-h-[200px] text-[#8b949e] text-sm">
              Unable to load forecast — please try again
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
        <ResourceTable assignments={assignmentsLocal} loading={loading} />
      </div>
    </div>
  )
}
