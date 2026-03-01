export function ResourceTable({ assignments, loading }) {
  const rows = Array.isArray(assignments) ? assignments : []

  if (loading) {
    return (
      <div className="h-64 bg-[#0d1117] border border-[#21262d] rounded-lg overflow-hidden">
        <div className="p-4 border-b border-[#21262d]">
          <h3 className="text-sm font-semibold text-white">Deployments</h3>
        </div>
        <div className="p-4 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 bg-[#21262d] rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="h-64 bg-[#0d1117] border border-[#21262d] rounded-lg overflow-hidden flex flex-col">
      <div className="p-4 border-b border-[#21262d]">
        <h3 className="text-sm font-semibold text-white">Deployments</h3>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[#8b949e] border-b border-[#21262d]">
              <th className="px-4 py-2 font-medium">Resource Name</th>
              <th className="px-4 py-2 font-medium">Intersection Name</th>
              <th className="px-4 py-2 font-medium">Action</th>
              <th className="px-4 py-2 font-medium">Deploy By</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[#8b949e]">
                  No assignments
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={i} className="border-b border-[#21262d] last:border-0">
                  <td className="px-4 py-2 text-[#e6edf3]">
                    {row.resource_name ?? row.resource_id ?? '—'}
                  </td>
                  <td className="px-4 py-2 text-[#e6edf3]">
                    {row.intersection_name ?? row.intersection_id ?? '—'}
                  </td>
                  <td className="px-4 py-2 text-[#e6edf3] max-w-[180px] truncate" title={row.action}>
                    {row.action ?? '—'}
                  </td>
                  <td className="px-4 py-2 text-[#e6edf3]">
                    {row.deploy_by ?? '—'}
                  </td>
                  <td className="px-4 py-2">
                    <span className="text-[#34d399]">{row.status ?? 'Active'}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
