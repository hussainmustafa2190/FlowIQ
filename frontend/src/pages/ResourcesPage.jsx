import { useState, useEffect } from 'react'
import { useFlowDataContext } from '../context/FlowDataContext.jsx'
import { getResources, postOptimize } from '../api/flows.js'
import { ResourceTable } from '../components/ResourceTable.jsx'

export function ResourcesPage() {
  const { loading, error, refetch, assignments } = useFlowDataContext()
  const [resources, setResources] = useState([])
  const [optimizerLoading, setOptimizerLoading] = useState(false)
  const [lastAssignments, setLastAssignments] = useState(assignments ?? [])

  useEffect(() => {
    getResources().then((data) => {
      const list = Array.isArray(data) ? data : data?.resources ?? []
      setResources(list)
    }).catch(() => setResources([]))
  }, [])

  useEffect(() => {
    setLastAssignments((prev) => (assignments?.length ? assignments : prev))
  }, [assignments])

  const deployedResourceIds = new Set(
    (lastAssignments?.length ? lastAssignments : assignments ?? []).map(
      (a) => a.resource_id ?? a.resource_name ?? a.resourceId
    )
  )

  async function handleRunOptimizer() {
    setOptimizerLoading(true)
    try {
      const result = await postOptimize()
      const list = Array.isArray(result) ? result : result?.assignments ?? []
      setLastAssignments(list)
      refetch()
    } finally {
      setOptimizerLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-full p-4">
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-white">Resources</h1>
        <p className="text-sm text-[#8b949e] mt-1">
          All 8 resources — deploy via Run Optimizer to assign to hotspots.
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#0d1117] border border-[#21262d] rounded-lg overflow-hidden flex flex-col">
          <div className="p-4 border-b border-[#21262d] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Resource list</h2>
            <button
              type="button"
              onClick={handleRunOptimizer}
              disabled={optimizerLoading || loading}
              className="px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 text-sm font-medium hover:bg-cyan-500/30 disabled:opacity-50"
            >
              {optimizerLoading ? 'Running…' : 'Run Optimizer'}
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4 space-y-3">
            {resources.length === 0 && !loading ? (
              <p className="text-sm text-[#8b949e]">Loading resources…</p>
            ) : (
              resources.map((r) => {
                const id = r.id ?? r.resource_id ?? r.name
                const name = r.name ?? r.resource_name ?? id ?? '—'
                const type = r.type ?? r.resource_type ?? '—'
                const isDeployed = deployedResourceIds.has(id) || deployedResourceIds.has(name)
                return (
                  <div
                    key={id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-[#21262d] bg-[#161b22]"
                  >
                    <span
                      className={`w-3 h-3 rounded-full shrink-0 ${
                        isDeployed ? 'bg-red-500' : 'bg-emerald-500'
                      }`}
                      title={isDeployed ? 'Deployed' : 'Available'}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[#e6edf3] truncate">{name}</p>
                      <p className="text-xs text-[#8b949e]">{type}</p>
                    </div>
                    <span className="text-xs text-[#8b949e] shrink-0">
                      {isDeployed ? 'Deployed' : 'Available'}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>
        <div className="flex flex-col min-h-0">
          <ResourceTable
            assignments={lastAssignments?.length ? lastAssignments : assignments}
            loading={loading && !lastAssignments?.length}
          />
        </div>
      </div>
    </div>
  )
}
