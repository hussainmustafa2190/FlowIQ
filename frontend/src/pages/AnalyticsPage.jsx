import { useMemo, useState, useEffect } from 'react'
import { getBoroughStats } from '../api/flows.js'
import {
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  Legend,
  ComposedChart,
} from 'recharts'

const HERO_IMAGES = [
  {
    url: 'https://images.unsplash.com/photo-1534430480872-3498386e7856',
    text: 'Monitoring 25 intersections across 5 boroughs',
  },
  {
    url: 'https://images.unsplash.com/photo-1522083165195-3424ed129620',
    text: 'Powered by LSTM Neural Network + Random Forest Risk Model',
  },
  {
    url: 'https://images.unsplash.com/photo-1485871981521-5b1fd3805eee',
    text: 'Live data refreshed every 60 seconds',
  },
]

const STAT_CARDS = [
  { label: 'Total Incidents Prevented', value: '1,247', color: 'text-emerald-400', icon: '↑', iconBg: 'bg-emerald-500/20' },
  { label: 'Avg Response Time', value: '2.4 min', color: 'text-blue-400', icon: null, iconBg: '' },
  { label: 'Resources Utilization', value: '73%', color: 'text-orange-400', icon: null, iconBg: '' },
  { label: 'Congestion Reduced', value: '34%', color: 'text-emerald-400', icon: '↑', iconBg: 'bg-emerald-500/20' },
]

const CONGESTION_24H = [
  { hour: 0, label: '12AM', today: 28, yesterday: 32 },
  { hour: 2, label: '2AM', today: 22, yesterday: 25 },
  { hour: 4, label: '4AM', today: 18, yesterday: 20 },
  { hour: 6, label: '6AM', today: 35, yesterday: 38 },
  { hour: 8, label: '8AM', today: 82, yesterday: 78 },
  { hour: 10, label: '10AM', today: 71, yesterday: 68 },
  { hour: 12, label: '12PM', today: 65, yesterday: 62 },
  { hour: 14, label: '2PM', today: 58, yesterday: 55 },
  { hour: 16, label: '4PM', today: 68, yesterday: 72 },
  { hour: 18, label: '6PM', today: 79, yesterday: 75 },
  { hour: 20, label: '8PM', today: 52, yesterday: 48 },
  { hour: 22, label: '10PM', today: 38, yesterday: 42 },
  { hour: 24, label: '12AM', today: 30, yesterday: 28 },
]

const BOROUGH_COLORS = ['#ef4444', '#f97316', '#eab308', '#a855f7', '#38bdf8']
const BOROUGHS_FALLBACK = [
  { name: 'Manhattan', congestion: 78, fill: '#ef4444' },
  { name: 'Brooklyn', congestion: 65, fill: '#f97316' },
  { name: 'Queens', congestion: 58, fill: '#eab308' },
  { name: 'Bronx', congestion: 71, fill: '#a855f7' },
  { name: 'Staten Island', congestion: 42, fill: '#38bdf8' },
]

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function buildHeatmapData() {
  const rows = []
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      let v = 25 + Math.random() * 15
      if (h >= 7 && h <= 9) v += 45
      else if (h >= 16 && h <= 19) v += 40
      else if (h >= 10 && h <= 15) v += 20
      if (d >= 1 && d <= 5) v += 10
      rows.push({ day: d, dayLabel: WEEKDAYS[d], hour: h, value: Math.round(Math.min(100, v)) })
    }
  }
  return rows
}

const HEATMAP_DATA = buildHeatmapData()

const RISK_STREETS = [
  { street: 'Atlantic Ave', borough: 'Brooklyn', riskScore: 89, incidents: 24, trend: 'up' },
  { street: 'Grand Concourse', borough: 'Bronx', riskScore: 85, incidents: 19, trend: 'down' },
  { street: 'Queens Blvd', borough: 'Queens', riskScore: 82, incidents: 21, trend: 'up' },
  { street: 'Hylan Blvd', borough: 'Staten Island', riskScore: 76, incidents: 12, trend: 'down' },
  { street: 'Northern Blvd', borough: 'Queens', riskScore: 74, incidents: 18, trend: 'up' },
  { street: 'Flatbush Ave', borough: 'Brooklyn', riskScore: 71, incidents: 15, trend: 'down' },
  { street: 'Fordham Rd', borough: 'Bronx', riskScore: 68, incidents: 14, trend: 'up' },
  { street: '2nd Ave', borough: 'Manhattan', riskScore: 65, incidents: 11, trend: 'down' },
]

const DEPLOYMENT_DAYS = Array.from({ length: 14 }, (_, i) => {
  const d = new Date()
  d.setDate(d.getDate() - (13 - i))
  const day = d.getDate()
  const month = d.getMonth() + 1
  return {
    date: `${month}/${day}`,
    officers: 3 + Math.floor(Math.random() * 4) + (i > 8 ? 1 : 0),
    signalUnits: 1 + Math.floor(Math.random() * 2),
    vmsBoards: 0 + Math.floor(Math.random() * 2),
  }
})

function HeroCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {HERO_IMAGES.map((item, i) => (
        <div
          key={i}
          className={`relative h-32 md:h-36 rounded-xl overflow-hidden border border-[#21262d] group analytics-animate-in opacity-0 ${['analytics-animate-in-1', 'analytics-animate-in-2', 'analytics-animate-in-3'][i]}`}
        >
          <img
            src={item.url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-90 transition-opacity"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d1117]/95 via-[#0d1117/60] to-transparent" />
          <div className="absolute inset-0 flex items-end p-4">
            <p className="text-sm font-medium text-white drop-shadow-lg">{item.text}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function StatCard({ label, value, color, icon, iconBg }) {
  return (
    <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-5 flex flex-col justify-center analytics-animate-in opacity-0">
      <p className="text-[#8b949e] text-sm font-medium">{label}</p>
      <div className="flex items-center gap-2 mt-1">
        <span className={`text-2xl font-bold ${color}`}>{value}</span>
        {icon && (
          <span className={`inline-flex items-center justify-center w-6 h-6 rounded ${iconBg} ${color} text-xs font-bold`}>
            {icon}
          </span>
        )}
      </div>
    </div>
  )
}

function CongestionTrendChart() {
  const peakPoint = useMemo(() => {
    let max = 0
    let label = ''
    CONGESTION_24H.forEach((p) => {
      if (p.today > max) {
        max = p.today
        label = p.label
      }
    })
    return { max, label }
  }, [])

  return (
    <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-4 analytics-animate-in opacity-0 analytics-animate-in-5">
      <h3 className="text-sm font-semibold text-white mb-3">24-Hour Congestion Trend</h3>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={CONGESTION_24H} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
          <defs>
            <linearGradient id="todayArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f97316" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
          <XAxis dataKey="label" tick={{ fill: '#8b949e', fontSize: 10 }} stroke="#21262d" />
          <YAxis
            tick={{ fill: '#8b949e', fontSize: 10 }}
            stroke="#21262d"
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const p = payload[0].payload
              return (
                <div className="bg-[#0d1117] border border-[#21262d] rounded-lg px-3 py-2 text-sm shadow-xl">
                  <p className="text-[#e6edf3] font-medium">{p.label}</p>
                  <p className="text-orange-400">Today: {p.today}</p>
                  <p className="text-[#8b949e]">Yesterday: {p.yesterday}</p>
                </div>
              )
            }}
          />
          <ReferenceLine
            x={peakPoint.label}
            stroke="#ef4444"
            strokeDasharray="4 2"
            strokeOpacity={0.8}
            label={{ value: `Peak: ${peakPoint.label}`, fill: '#ef4444', fontSize: 11, position: 'top' }}
          />
          <Area type="monotone" dataKey="today" stroke="none" fill="url(#todayArea)" />
          <Line type="monotone" dataKey="today" stroke="#f97316" strokeWidth={2} dot={false} name="Today" />
          <Line type="monotone" dataKey="yesterday" stroke="#6e7681" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Yesterday" />
          <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => <span className="text-[#8b949e]">{v}</span>} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

function BoroughComparison() {
  const [boroughData, setBoroughData] = useState(BOROUGHS_FALLBACK)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getBoroughStats()
      .then((data) => {
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          const arr = Object.entries(data).map(([name, v], i) => ({
            name,
            congestion: Number(v?.avg_congestion ?? 0),
            fill: BOROUGH_COLORS[i % BOROUGH_COLORS.length],
            hotspots: v?.hotspots ?? 0,
            segments: v?.segments ?? 0,
          }))
          if (arr.length > 0) setBoroughData(arr)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-4 analytics-animate-in opacity-0 analytics-animate-in-6">
      <h3 className="text-sm font-semibold text-white mb-3">Congestion by Borough</h3>
      {loading ? (
        <div className="h-[260px] flex items-center justify-center text-[#8b949e] text-sm">Loading…</div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={boroughData} margin={{ top: 5, right: 10, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
            <XAxis dataKey="name" tick={{ fill: '#8b949e', fontSize: 10 }} stroke="#21262d" />
            <YAxis
              tick={{ fill: '#8b949e', fontSize: 10 }}
              stroke="#21262d"
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              label={{ value: 'Avg congestion score', angle: -90, position: 'insideLeft', style: { fill: '#8b949e', fontSize: 10 } }}
            />
            <Tooltip
              content={({ active, payload }) =>
                active && payload?.[0] ? (
                  <div className="bg-[#0d1117] border border-[#21262d] rounded px-3 py-2 text-sm">
                    <p className="text-[#e6edf3]">{payload[0].payload?.name}</p>
                    <p className="text-cyan-400">Congestion: {Number(payload[0].value).toFixed(0)}</p>
                    {payload[0].payload?.hotspots != null && (
                      <p className="text-[#8b949e] text-xs">Hotspots: {payload[0].payload.hotspots}</p>
                    )}
                  </div>
                ) : null
              }
            />
            <Bar dataKey="congestion" radius={[4, 4, 0, 0]} name="Congestion">
              {boroughData.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

function PeakHoursHeatmap() {
  const byDay = useMemo(() => WEEKDAYS.map((_, d) => HEATMAP_DATA.filter((r) => r.day === d)), [])
  const maxVal = useMemo(() => Math.max(...HEATMAP_DATA.map((r) => r.value), 1), [])

  return (
    <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-4 analytics-animate-in opacity-0 analytics-animate-in-6">
      <h3 className="text-sm font-semibold text-white mb-3">Weekly Congestion Heatmap</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-[#8b949e] font-medium p-1 w-12 sticky left-0 bg-[#0d1117]"></th>
              {Array.from({ length: 24 }, (_, h) => (
                <th key={h} className="text-[#8b949e] font-normal p-0.5 w-5 min-w-[20px]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {byDay.map((rows, d) => (
              <tr key={d}>
                <td className="text-[#8b949e] p-1 sticky left-0 bg-[#0d1117] font-medium">{WEEKDAYS[d]}</td>
                {rows.map((cell) => {
                  const pct = (cell.value / maxVal) * 100
                  const isPeak = (cell.hour >= 7 && cell.hour <= 9) || (cell.hour >= 16 && cell.hour <= 19)
                  const intensity = Math.min(1, pct / 85)
                  const r = Math.round(34 + intensity * 205)
                  const g = Math.round(197 - intensity * 197)
                  const b = Math.round(153 - intensity * 153)
                  return (
                    <td
                      key={`${d}-${cell.hour}`}
                      className="p-0.5 min-w-[20px]"
                      style={{
                        backgroundColor: `rgb(${r},${g},${b})`,
                        boxShadow: isPeak && intensity > 0.6 ? 'inset 0 0 0 1px rgba(239,68,68,0.5)' : undefined,
                      }}
                      title={`${WEEKDAYS[d]} ${cell.hour}:00 — ${cell.value}`}
                    />
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[#8b949e] text-xs mt-2">Green = low congestion · Red = high. Peak windows 7–9AM, 4–7PM.</p>
    </div>
  )
}

function riskBadgeClass(score) {
  if (score >= 80) return 'bg-red-500/25 text-red-400 border-red-500/40'
  if (score >= 65) return 'bg-orange-500/25 text-orange-400 border-orange-500/40'
  return 'bg-emerald-500/25 text-emerald-400 border-emerald-500/40'
}

function TopRiskStreets() {
  return (
    <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-4 analytics-animate-in opacity-0 analytics-animate-in-7">
      <h3 className="text-sm font-semibold text-white mb-3">Highest Risk Corridors</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[#8b949e] border-b border-[#21262d]">
              <th className="py-2 pr-2 font-medium">Street</th>
              <th className="py-2 pr-2 font-medium">Borough</th>
              <th className="py-2 pr-2 font-medium">Risk Score</th>
              <th className="py-2 pr-2 font-medium">Incidents</th>
              <th className="py-2 font-medium">Trend</th>
            </tr>
          </thead>
          <tbody>
            {RISK_STREETS.map((row, i) => (
              <tr key={i} className="border-b border-[#21262d] last:border-0">
                <td className="py-2 pr-2 text-[#e6edf3] font-medium">{row.street}</td>
                <td className="py-2 pr-2 text-[#8b949e]">{row.borough}</td>
                <td className="py-2 pr-2">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold border ${riskBadgeClass(row.riskScore)}`}>
                    {row.riskScore}
                  </span>
                </td>
                <td className="py-2 pr-2 text-[#e6edf3]">{row.incidents}</td>
                <td className="py-2">
                  {row.trend === 'up' ? (
                    <span className="text-red-400 font-medium" title="Increasing">↑</span>
                  ) : (
                    <span className="text-emerald-400 font-medium" title="Decreasing">↓</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ResourceDeploymentHistory() {
  return (
    <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-4 analytics-animate-in opacity-0 analytics-animate-in-7">
      <h3 className="text-sm font-semibold text-white mb-3">Resource Deployment History</h3>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={DEPLOYMENT_DAYS} margin={{ top: 5, right: 10, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
          <XAxis dataKey="date" tick={{ fill: '#8b949e', fontSize: 10 }} stroke="#21262d" />
          <YAxis tick={{ fill: '#8b949e', fontSize: 10 }} stroke="#21262d" allowDecimals={false} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const p = payload[0].payload
              return (
                <div className="bg-[#0d1117] border border-[#21262d] rounded-lg px-3 py-2 text-sm">
                  <p className="text-[#e6edf3] font-medium">{p.date}</p>
                  <p className="text-[#38bdf8]">Officers: {p.officers}</p>
                  <p className="text-[#a855f7]">Signal Units: {p.signalUnits}</p>
                  <p className="text-[#34d399]">VMS Boards: {p.vmsBoards}</p>
                </div>
              )
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => <span className="text-[#8b949e]">{v}</span>} />
          <Line type="monotone" dataKey="officers" stroke="#38bdf8" strokeWidth={2} dot={{ r: 3 }} name="Officers" />
          <Line type="monotone" dataKey="signalUnits" stroke="#a855f7" strokeWidth={2} dot={{ r: 3 }} name="Signal Units" />
          <Line type="monotone" dataKey="vmsBoards" stroke="#34d399" strokeWidth={2} dot={{ r: 3 }} name="VMS Boards" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function AnalyticsPage() {
  return (
    <div className="flex flex-col min-h-full p-4 overflow-auto">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-white">Analytics</h1>
        <p className="text-sm text-[#8b949e] mt-1">Traffic flow, risk, and deployment metrics.</p>
      </div>

      <HeroCards />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {STAT_CARDS.map((card, i) => (
          <StatCard key={i} {...card} delayClass={`analytics-animate-in-${i + 1}`} />
        ))}
      </div>

      <div className="mb-6">
        <CongestionTrendChart />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <BoroughComparison />
        <PeakHoursHeatmap />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <TopRiskStreets />
        <ResourceDeploymentHistory />
      </div>
    </div>
  )
}
