import {
  ComposedChart,
  Line,
  Area,
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

const STATUS_MESSAGES = {
  CRITICAL: '⚠️ Immediate action required',
  HIGH: '⚡ Monitor closely',
  NORMAL: '✅ Traffic flowing normally',
  LOW: '✅ Clear — no action needed',
}

function formatMinutesAhead(value) {
  if (value < 60) return value + 'min'
  const hours = Math.floor(value / 60)
  const mins = value % 60
  return mins === 0 ? hours + 'hr' : hours + 'hr ' + mins + 'm'
}

function getLevel(score) {
  if (score == null || Number.isNaN(score)) return 'NORMAL'
  if (score > 80) return 'CRITICAL'
  if (score > 60) return 'HIGH'
  if (score > 35) return 'NORMAL'
  return 'LOW'
}

function getLevelFromIntersection(int, peakScore) {
  const level = (int?.level ?? int?.current_level ?? '').toUpperCase()
  if (level === 'CRITICAL' || level === 'HIGH' || level === 'NORMAL' || level === 'LOW') return level
  return getLevel(peakScore ?? int?.congestion_score ?? int?.current_score ?? int?.score ?? 50)
}

const FILL_COLORS = { critical: '#ef4444', high: '#f97316', normal: '#34d399' }

function getLineColor(forecast) {
  if (!Array.isArray(forecast) || !forecast.length) return LINE_COLORS.normal
  const scores = forecast.map((d) =>
    typeof d === 'number' ? d : (d.congestion_score ?? d.value ?? 0)
  )
  const maxScore = Math.max(...scores)
  if (maxScore > 80) return LINE_COLORS.critical
  if (maxScore > 60) return LINE_COLORS.high
  return LINE_COLORS.normal
}

function getFillColor(peakScore) {
  if (peakScore == null) return FILL_COLORS.normal
  if (peakScore > 80) return FILL_COLORS.critical
  if (peakScore > 60) return FILL_COLORS.high
  return FILL_COLORS.normal
}

function getPeakBadgeStyle(peakScore) {
  if (peakScore == null) return { bg: 'bg-[#21262d]', text: 'text-[#8b949e]' }
  if (peakScore > 80) return { bg: 'bg-red-500/25', text: 'text-red-400' }
  if (peakScore > 60) return { bg: 'bg-orange-500/25', text: 'text-orange-400' }
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

function StatusMessage({ level }) {
  const msg = STATUS_MESSAGES[level] ?? STATUS_MESSAGES.NORMAL
  const isCritical = level === 'CRITICAL'
  const isHigh = level === 'HIGH'
  const isLow = level === 'LOW'
  const cls = isCritical
    ? 'text-red-400'
    : isHigh
      ? 'text-orange-400'
      : isLow
        ? 'text-emerald-400'
        : 'text-emerald-400'
  return <p className={`text-sm font-medium ${cls} mb-2`}>{msg}</p>
}

function SummaryText({ peakScore }) {
  if (peakScore == null) return null
  if (peakScore > 80) {
    return (
      <p className="text-xs text-red-400 mt-2">
        ⚠️ CRITICAL congestion predicted — resource deployment recommended
      </p>
    )
  }
  if (peakScore > 60) {
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

function getRiskBadgeStyle(riskScore) {
  if (riskScore == null) return { bg: 'bg-[#21262d]', text: 'text-[#8b949e]', label: '—' }
  if (riskScore > 80) return { bg: 'bg-red-500/25', text: 'text-red-400', label: 'HIGH RISK' }
  if (riskScore > 60) return { bg: 'bg-orange-500/25', text: 'text-orange-400', label: 'MODERATE RISK' }
  return { bg: 'bg-emerald-500/25', text: 'text-emerald-400', label: 'LOW RISK' }
}

function getRiskRecommendation(riskScore) {
  if (riskScore == null) return null
  if (riskScore > 70) return '⚠️ Historically dangerous — preemptive deployment recommended'
  if (riskScore > 40) return '⚡ Moderate risk — monitor closely during peak hours'
  return '✅ Low historical risk — standard monitoring'
}

function RiskAnalysis({ riskScore, riskDetails }) {
  const badge = getRiskBadgeStyle(riskScore)
  const recommendation = getRiskRecommendation(riskScore)
  const accidentHistory = riskDetails?.accident_history
  const peakHourBoost = riskDetails?.peak_hour_boost
  const weatherImpact = riskDetails?.weather_impact
  return (
    <div className="mt-4 pt-4 border-t border-[#21262d]">
      <p className="text-xs text-[#8b949e] mb-2 font-medium">Risk Analysis</p>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded text-sm font-semibold ${badge.bg} ${badge.text}`}
        >
          {riskScore != null ? `${Number(riskScore).toFixed(0)} — ${badge.label}` : badge.label}
        </span>
      </div>
      <div className="flex flex-wrap gap-2 mb-2">
        <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-[#21262d] text-[#e6edf3]">
          Accident History: {accidentHistory != null ? accidentHistory : '—'} incidents
        </span>
        <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-[#21262d] text-[#e6edf3]">
          Peak Hour Risk: +{peakHourBoost != null ? peakHourBoost : '—'}%
        </span>
        <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-[#21262d] text-[#e6edf3]">
          Weather Impact: +{weatherImpact != null ? Number(weatherImpact).toFixed(0) : '—'} pts
        </span>
      </div>
      {recommendation && (
        <p className="text-xs text-[#8b949e]">
          {recommendation}
        </p>
      )}
    </div>
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
  const riskScore = forecastResult?.risk_score
  const riskDetails = forecastResult?.risk_details
  const intersectionName =
    selectedIntersection?.name ??
    selectedIntersection?.id ??
    selectedIntersection?.intersection_id ??
    'Intersection'
  const peakBadgeStyle = getPeakBadgeStyle(peakScore)
  const level = getLevelFromIntersection(selectedIntersection, peakScore)
  const currentSpeed = selectedIntersection?.current_speed_mph ?? selectedIntersection?.speed ?? selectedIntersection?.speed_mph

  if (loading) {
    return <LoadingSpinner />
  }

  if (!selectedIntersection) {
    return (
      <div className="h-64 bg-[#0d1117] border border-[#21262d] rounded-lg flex items-center justify-center text-[#8b949e] text-sm">
        Select an intersection on the map for forecast
      </div>
    )
  }

  if (forecastError && !forecastResult) {
    return <FriendlyErrorMessage />
  }

  return (
    <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-4">
      <h3 className="text-sm font-semibold text-white mb-2">
        {intersectionName} — 3hr Forecast
      </h3>
      <StatusMessage level={level} />
      {currentSpeed != null && (
        <p className="text-sm text-[#8b949e] mb-2">
          Current speed: {Number(currentSpeed).toFixed(0)} mph
        </p>
      )}
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
      {dataValid ? (
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
            <defs>
              <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={getFillColor(peakScore)} stopOpacity={0.5} />
                <stop offset="100%" stopColor={getFillColor(peakScore)} stopOpacity={0} />
              </linearGradient>
            </defs>
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
            <ReferenceArea y1={80} y2={100} fill="#ef4444" fillOpacity={0.08} />
            <ReferenceArea y1={60} y2={80} fill="#f97316" fillOpacity={0.08} />
            <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.6} />
            <Area type="monotone" dataKey="congestion_score" stroke="none" fill="url(#forecastGradient)" />
            <Line
              type="monotone"
              dataKey="congestion_score"
              stroke={lineColor}
              strokeWidth={2}
              dot={{ fill: lineColor, r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[200px] rounded bg-[#161b22] border border-[#21262d] flex items-center justify-center text-[#8b949e] text-sm">
          No forecast data
        </div>
      )}
      <SummaryText peakScore={peakScore} />
      <RiskAnalysis riskScore={riskScore} riskDetails={riskDetails} />
    </div>
  )
}
