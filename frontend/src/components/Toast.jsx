import { useEffect } from 'react'

export function Toast({ message, visible, onDismiss }) {
  useEffect(() => {
    if (!visible || !onDismiss) return
    const t = setTimeout(onDismiss, 4000)
    return () => clearTimeout(t)
  }, [visible, onDismiss])

  if (!visible || !message) return null
  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-lg bg-[#0d1117] border border-emerald-500/40 text-emerald-400 text-sm shadow-lg flex items-center gap-2"
      role="status"
    >
      {message}
    </div>
  )
}
