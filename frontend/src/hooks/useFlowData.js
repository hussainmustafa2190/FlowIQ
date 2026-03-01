import { useState, useEffect, useCallback } from 'react'
import {
  getIntersections,
  getHotspots,
  getResources,
  postOptimize,
} from '../api/flows.js'

const REFRESH_MS = 30000

function normalizeList(res, key) {
  if (Array.isArray(res)) return res
  if (res && Array.isArray(res[key])) return res[key]
  return []
}

export function useFlowData() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [simulationMode, setSimulationMode] = useState(false)
  const [intersections, setIntersections] = useState([])
  const [hotspots, setHotspots] = useState([])
  const [resources, setResources] = useState([])
  const [assignments, setAssignments] = useState([])

  const fetchAll = useCallback(async () => {
    try {
      setError(null)
      const [intRes, hotRes, resRes, optRes] = await Promise.all([
        getIntersections(),
        getHotspots(),
        getResources(),
        postOptimize(),
      ])
      setIntersections(normalizeList(intRes, 'intersections'))
      setHotspots(normalizeList(hotRes, 'hotspots'))
      setResources(normalizeList(resRes, 'resources'))
      setAssignments(
        Array.isArray(optRes) ? optRes : normalizeList(optRes, 'assignments') || []
      )
      if (intRes?.simulated || hotRes?.simulated || optRes?.simulated)
        setSimulationMode(true)
    } catch (err) {
      setError(err.message)
      setIntersections([])
      setHotspots([])
      setResources([])
      setAssignments([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    const id = setInterval(fetchAll, REFRESH_MS)
    return () => clearInterval(id)
  }, [fetchAll])

  return {
    loading,
    error,
    simulationMode,
    intersections,
    hotspots,
    resources,
    assignments,
    refetch: fetchAll,
  }
}
