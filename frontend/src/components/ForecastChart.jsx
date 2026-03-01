import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from 'recharts'

const LINE_COLORS = {
  critical: '#ef4444',
  high: '#f97316',
  normal: '#34d399',
}

function formatMinutesAhead(value) {
  if (value < 60) return value + 'min'
  const hours = Math.floor(value / 60)
  const mins = value % 60
  return mins === 0 ? hours + 'hr' : hours + 'hr ' + mins + 'm'
}

function getLevel(score) {
  if (score > 75) return 'CRITICAL'
  if (score > 50) return 'HIGH'
  if (score > 25) return 'NORMAL'
  return 'LOW'
}

function getLineColor(forecast) {
  if (!Array.isArray(forecast) || !forecast.length) return LINE_COLORS.normal
  const scores = forecast.map((d) =>
    typeof d === 'number' ? d : (d.congestion_score ?? d.value ?? 0)
  )
  const maxScore = Math.max(...scores)
  if (maxScore > 75) return LINE_COLORS.critical
  if (maxScore > 50) return LINE_COLORS.high
  return LINE_COLORS.normal
}

function getPeakBadgeStyle(peakScore) {
  if (peakScore == null) return { bg: 'bg-[#21262d]', text: 'text-[#8b949e]' }
  if (peakScore > 75) return { bg: 'bg-red-500/25', text: 'text-red-400' }
  if (peakScore > 50) return { bg: 'bg-orange-500/25', text: 'text-orange-400' }
  return { bg: 'bg-emerald-500/25', text: 'text-emerald-400' }
}

function hasValidForecastItem(d, i) {
  if (d == null) return false
  if (typeof d === 'number') return !Number.isNaN(d)
  if (typeof d !== 'object') return false
  const score = d.congestion_score ?? d.value
  const minutes = d.minutes_ahead ?? (i + 1) * 15
  const hasScore = typeof score === 'number' && !Number.isNaN(score)
  const hasMinutes = typeof minutes === 'number' && !Number.isNaN(minutes)
  return hasScore && hasMinutes
}

function isValidForecastData(forecast) {
  if (!forecast || !Array.isArray(forecast) || forecast.length === 0) return false
  return forecast.every((d, i) => hasValidForecastItem(d, i))
}

function normalizeChartData(forecast) {
  if (!Array.isArray(forecast) || !forecast.length) return []
  try {
    return forecast.map((d, i) => {
      if (typeof d === 'number') {
        const minutes_ahead = (i + 1) * 15
        return {
          minutes_ahead,
          congestion_score: d,
          level: getLevel(d),
          label: formatMinutesAhead(minutes_ahead),
        }
      }
      const minutes_ahead = d.minutes_ahead ?? (i + 1) * 15
      const congestion_score = d.congestion_score ?? d.value ?? 0
      return {
        minutes_ahead: Number(minutes_ahead),
        congestion_score: Number(congestion_score),
        level: d.level ?? getLevel(congestion_score),
        label: formatMinutesAhead(minutes_ahead),
      }
    })
  } catch {
    return []
  }
}

function SummaryText({ peakScore }) {
  if (peakScore == null) return null
  if (peakScore > 75) {
    return (
      <p className="text-xs text-red-400 mt-2">
        ⚠️ CRITICAL congestion predicted — resource deployment recommended
      </p>
    )
  }
  if (peakScore > 50) {
    return (
      <p className="text-xs text-orange-400 mt-2">
        ⚡ HIGH congestion predicted — monitor closely
      </p>
    )
  }
  return (
    <p className="text-xs text-emerald-400 mt-2">
      ✅ Traffic flowing normally
    </p>
  )
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  if (!d || typeof d.congestion_score === 'undefined') return null
  const score = d.congestion_score ?? 0
  const level = d.level ?? getLevel(score)
  return (
    <div className="bg-[#0d1117] border border-[#21262d] rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="text-[#e6edf3]">Time: {d.minutes_ahead} min ahead</p>
      <p className="text-[#e6edf3]">Congestion: {Number(score).toFixed(1)} / 100</p>
      <p className="text-[#8b949e]">Level: {level}</p>
    </div>
  )
}

function LoadingSpinner() {
  return (
    <div className="h-64 bg-[#0d1117] border border-[#21262d] rounded-lg flex flex-col items-center justify-center gap-3">
      <div
        className="w-8 h-8 border-2 border-[#21262d] border-t-[#38bdf8] rounded-full animate-spin"
        aria-hidden
      />
      <p className="text-sm text-[#8b949e]">Loading forecast…</p>
    </div>
  )
}

function FriendlyErrorMessage() {
  return (
    <div className="h-64 bg-[#0d1117] border border-[#21262d] rounded-lg flex items-center justify-center p-4 text-center">
      <p className="text-sm text-[#8b949e]">Unable to load forecast — please try again</p>
    </div>
  )
}

export function ForecastChart({ forecastResult, selectedIntersection, loading, forecastError }) {
  const showFriendlyError = forecastError || (selectedIntersection && !loading && !isValidForecastData(forecastResult?.forecast))
  const forecast = forecastResult?.forecast
  let data = []
  try {
    data = Array.isArray(forecast) && forecast.length > 0 ? normalizeChartData(forecast) : []
  } catch {
    data = []
  }
  const dataValid = data.length > 0 && data.every((row) => row != null && typeof row.minutes_ahead === 'number' && typeof row.congestion_score === 'number')
  const lineColor = getLineColor(forecast)
  const peakScore = forecastResult?.peak_score
  const peakAtMinutes = forecastResult?.peak_at_minutes
  const intersectionName =
    selectedIntersection?.name ??
    selectedIntersection?.id ??
    selectedIntersection?.intersection_id ??
    'Intersection'
  const peakBadgeStyle = getPeakBadgeStyle(peakScore)

  if (loading) {
    return <LoadingSpinner />
  }

  if (showFriendlyError) {
    return <FriendlyErrorMessage />
  }

  if (!selectedIntersection) {
    return (
      <div className="h-64 bg-[#0d1117] border border-[#21262d] rounded-lg flex items-center justify-center text-[#8b949e] text-sm">
        Select an intersection on the map for forecast
      </div>
    )
  }

  if (!dataValid) {
    return <FriendlyErrorMessage />
  }

  return (
    <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-4">
      <h3 className="text-sm font-semibold text-white mb-2">
        {intersectionName} — 3hr Forecast
      </h3>
      <div className="flex flex-wrap gap-2 mb-3">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${peakBadgeStyle.bg} ${peakBadgeStyle.text}`}
        >
          Peak: {peakScore != null ? Number(peakScore).toFixed(1) : '—'}
        </span>
        {peakAtMinutes != null && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#21262d] text-[#8b949e]">
            Hits peak at: {peakAtMinutes} min
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
          <ReferenceArea y1={75} y2={100} fill="#ef4444" fillOpacity={0.15} />
          <ReferenceArea y1={50} y2={75} fill="#f97316" fillOpacity={0.15} />
          <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
          <XAxis
            dataKey="minutes_ahead"
            tick={{ fill: '#8b949e', fontSize: 10 }}
            stroke="#21262d"
            angle={-45}
            textAnchor="end"
            height={60}
            tickFormatter={(value) => {
              if (value < 60) return value + 'min'
              const hours = Math.floor(value / 60)
              const mins = value % 60
              return mins === 0 ? hours + 'hr' : hours + 'hr ' + mins + 'm'
            }}
          />
          <YAxis
            label={{ value: 'Congestion Score', angle: -90, position: 'insideLeft', style: { fill: '#8b949e', fontSize: 10 } }}
            tick={{ fill: '#8b949e', fontSize: 10 }}
            stroke="#21262d"
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={75} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.6} />
          <Line
            type="monotone"
            dataKey="congestion_score"
            stroke={lineColor}
            strokeWidth={2}
            dot={{ fill: lineColor, r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <SummaryText peakScore={peakScore} />
    </div>
  )
}
