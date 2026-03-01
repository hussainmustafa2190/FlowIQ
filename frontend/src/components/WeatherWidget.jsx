import { useState, useEffect } from 'react'
import { getWeather } from '../api/flows.js'

function getWeatherIcon(description, rain) {
  if (rain > 0) return '🌧️'
  const d = (description || '').toLowerCase()
  if (d.includes('clear')) return '☀️'
  if (d.includes('cloud')) return '☁️'
  if (d.includes('rain') || d.includes('drizzle')) return '🌧️'
  if (d.includes('snow')) return '❄️'
  if (d.includes('thunder')) return '⛈️'
  if (d.includes('fog') || d.includes('mist')) return '🌫️'
  return '🌤️'
}

export function WeatherWidget() {
  const [weather, setWeather] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function fetchWeather() {
      try {
        const data = await getWeather()
        if (!cancelled) {
          setWeather(data)
          setError(false)
        }
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchWeather()
    const interval = setInterval(fetchWeather, 5 * 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  if (loading && !weather) {
    return (
      <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-4 min-w-[200px] flex items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#21262d] border-t-[#38bdf8] rounded-full animate-spin shrink-0" />
        <span className="text-sm text-[#8b949e]">Loading weather…</span>
      </div>
    )
  }

  if (error && !weather) {
    return (
      <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-4 min-w-[200px]">
        <span className="text-sm text-[#8b949e]">Weather unavailable</span>
      </div>
    )
  }

  const temp = weather?.temp ?? 65
  const description = weather?.description ?? '—'
  const rain = weather?.rain ?? 0
  const weatherScore = weather?.weather_score ?? 0
  const icon = getWeatherIcon(description, rain)

  return (
    <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-4 min-w-[200px]">
      <div className="flex items-center gap-3">
        <span className="text-2xl" aria-hidden>{icon}</span>
        <div>
          <p className="text-lg font-semibold text-white tabular-nums">{Math.round(temp)}°F</p>
          <p className="text-xs text-[#8b949e] capitalize">{description}</p>
        </div>
      </div>
      {rain > 0 && (
        <p className="text-xs text-amber-400 mt-2">
          Weather impact: +{weatherScore.toFixed(0)} congestion
        </p>
      )}
    </div>
  )
}
