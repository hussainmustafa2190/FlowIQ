function StatCard({ label, value, loading, badge }) {
  return (
    <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-4 min-w-0">
      {loading ? (
        <div className="h-10 bg-[#21262d] rounded animate-pulse" />
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-2xl font-semibold text-white tabular-nums">{value}</p>
          {badge && (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                badge.variant === 'green'
                  ? 'bg-emerald-500/25 text-emerald-400 border border-emerald-500/40'
                  : 'bg-amber-500/25 text-amber-400 border border-amber-500/40'
              }`}
            >
              {badge.text}
            </span>
          )}
        </div>
      )}
      <p className="text-xs text-[#8b949e] mt-1">{label}</p>
    </div>
  )
}

export function StatsRow({ loading, hotspotsCount, maxCongestion, deployedCount, avgResponseTime, intersectionsCount, live }) {
  const monitoringBadge =
    live === true ? { text: 'Live Data', variant: 'green' } : live === false ? { text: 'Simulated', variant: 'yellow' } : null
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      <StatCard
        label="Monitoring"
        value={intersectionsCount != null ? `${intersectionsCount} intersections` : '—'}
        loading={loading}
        badge={monitoringBadge}
      />
      <StatCard label="Active Hotspots" value={hotspotsCount ?? 0} loading={loading} />
      <StatCard label="Highest Congestion" value={maxCongestion != null ? `${maxCongestion}` : '—'} loading={loading} />
      <StatCard label="Resources Deployed" value={deployedCount ?? 0} loading={loading} />
      <StatCard label="Avg Response Time" value={avgResponseTime ?? '2.4 min'} loading={false} />
    </div>
  )
}
