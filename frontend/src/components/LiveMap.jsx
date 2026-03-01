import { useState, useCallback, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import Map, { Marker, Popup } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'
import { LEVEL_COLORS, STATUS_MESSAGES, NYC_CENTER } from '../constants.js'
import { postPredict } from '../api/flows.js'

const GEOCODE_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places'
const NYC_BBOX = '-74.3,40.4,-73.6,40.95'
const DEBOUNCE_MS = 300
const MAX_SUGGESTIONS = 5
const FLY_ZOOM = 14

function getCoords(intersection, index) {
  if (intersection.lat != null && intersection.lng != null)
    return { lat: intersection.lat, lng: intersection.lng }
  const offset = 0.015 * (index % 9)
  const angle = (index * 0.7) % (2 * Math.PI)
  return {
    lat: NYC_CENTER.latitude + offset * Math.cos(angle),
    lng: NYC_CENTER.longitude + offset * Math.sin(angle),
  }
}

function getLevelFromScore(score) {
  if (score == null || Number.isNaN(score)) return 'NORMAL'
  if (score > 80) return 'CRITICAL'
  if (score > 60) return 'HIGH'
  if (score > 35) return 'NORMAL'
  return 'LOW'
}

function distance(lat1, lng1, lat2, lng2) {
  const R = 6371e3
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export const LiveMap = forwardRef(function LiveMap({ intersections, onSelectIntersection, selectedId, loading }, ref) {
  const mapRef = useRef(null)
  const [popupInfo, setPopupInfo] = useState(null)
  const [forecast, setForecast] = useState(null)
  const [loadingForecast, setLoadingForecast] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [highlightedId, setHighlightedId] = useState(null)
  const debounceRef = useRef(null)
  const highlightTimeoutRef = useRef(null)
  const searchContainerRef = useRef(null)

  const token = import.meta.env.VITE_MAPBOX_TOKEN || ''

  useEffect(() => () => {
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
  }, [])

  useEffect(() => {
    if (!showSuggestions) return
    const onDocClick = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [showSuggestions])

  const flyTo = useCallback((lng, lat) => {
    const map = mapRef.current?.getMap?.()
    if (map) {
      map.flyTo({ center: [lng, lat], zoom: FLY_ZOOM, duration: 2000 })
      const nearest = intersections.reduce((best, int, i) => {
        const { lat: ilat, lng: ilng } = getCoords(int, i)
        const d = distance(lat, lng, ilat, ilng)
        return !best || d < best.dist ? { id: int.id ?? int.intersection_id, dist: d } : best
      }, null)
      if (nearest?.id) {
        setHighlightedId(nearest.id)
        if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
        highlightTimeoutRef.current = setTimeout(() => setHighlightedId(null), 5000)
      }
    }
  }, [intersections])

  useImperativeHandle(ref, () => ({ flyTo }), [flyTo])

  const fetchSuggestions = useCallback(async (q) => {
    if (!q.trim() || !token) {
      setSuggestions([])
      return
    }
    setLoadingSearch(true)
    try {
      const encoded = encodeURIComponent(q.trim())
      const url = `${GEOCODE_URL}/${encoded}.json?access_token=${token}&bbox=${NYC_BBOX}&limit=${MAX_SUGGESTIONS}`
      const res = await fetch(url)
      const data = await res.json()
      setSuggestions(data.features || [])
    } catch {
      setSuggestions([])
    } finally {
      setLoadingSearch(false)
    }
  }, [token])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!searchQuery.trim()) {
      setSuggestions([])
      return
    }
    debounceRef.current = setTimeout(() => fetchSuggestions(searchQuery), DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchQuery, fetchSuggestions])

  const handleSearchSubmit = useCallback(() => {
    const q = searchQuery.trim()
    if (!q || !token) return
    setLoadingSearch(true)
    fetch(
      `${GEOCODE_URL}/${encodeURIComponent(q)}.json?access_token=${token}&bbox=${NYC_BBOX}&limit=1`
    )
      .then((r) => r.json())
      .then((data) => {
        const feature = data.features?.[0]
        if (feature?.center?.length >= 2) {
          const [lng, lat] = feature.center
          flyTo(lng, lat)
          setShowSuggestions(false)
        }
      })
      .finally(() => setLoadingSearch(false))
  }, [searchQuery, token, flyTo])

  const handleSuggestionClick = useCallback(
    (feature) => {
      const [lng, lat] = feature.center || []
      if (lng != null && lat != null) {
        flyTo(lng, lat)
        setSearchQuery(feature.place_name || '')
        setShowSuggestions(false)
      }
    },
    [flyTo]
  )

  const handleMarkerClick = useCallback(
    async (intersection, index) => {
      const id = intersection.id ?? intersection.intersection_id
      setPopupInfo({ ...intersection, ...getCoords(intersection, index) })
      onSelectIntersection?.(intersection)
      setForecast(null)
      setHighlightedId(null)
      if (!id) return
      setLoadingForecast(true)
      try {
        const data = await postPredict(id, 3)
        const arr = Array.isArray(data) ? data : (data && Array.isArray(data.forecast) ? data.forecast : [])
        setForecast(arr)
      } catch {
        setForecast([])
      } finally {
        setLoadingForecast(false)
      }
    },
    [onSelectIntersection]
  )

  if (!token) {
    return (
      <div className="w-full h-full bg-[#0d1117] border border-[#21262d] rounded-lg flex items-center justify-center text-[#8b949e]">
        Set VITE_MAPBOX_TOKEN in .env to enable the map.
      </div>
    )
  }

  return (
    <div className="w-full h-full rounded-lg overflow-hidden border border-[#21262d] relative flex flex-col">
      <div className="shrink-0 relative z-20 p-2" ref={searchContainerRef}>
        <div className="flex items-center gap-2 bg-[#0d1117] border border-[#21262d] rounded-lg px-3 py-2">
          <span className="text-[#8b949e]" aria-hidden>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setShowSuggestions(true)
            }}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearchSubmit()
            }}
            placeholder="Search any NYC location..."
            className="flex-1 min-w-0 bg-transparent text-[#e6edf3] placeholder-[#8b949e] text-sm outline-none"
            aria-label="Search NYC location"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                setSuggestions([])
                setShowSuggestions(false)
              }}
              className="text-[#8b949e] hover:text-[#e6edf3] p-0.5 rounded"
              aria-label="Clear search"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {showSuggestions && suggestions.length > 0 && (
          <ul
            className="absolute left-2 right-2 mt-1 bg-[#0d1117] border border-[#21262d] rounded-lg shadow-lg overflow-hidden z-30"
            role="listbox"
          >
            {suggestions.map((feature, i) => (
              <li key={feature.id ?? i}>
                <button
                  type="button"
                  onClick={() => handleSuggestionClick(feature)}
                  className="w-full text-left px-3 py-2 text-sm text-[#e6edf3] hover:bg-[#21262d] truncate"
                  role="option"
                >
                  {feature.place_name ?? feature.text ?? 'Location'}
                </button>
              </li>
            ))}
          </ul>
        )}
        {loadingSearch && (
          <div className="absolute right-10 top-1/2 -translate-y-1/2 text-[#8b949e]">
            <span className="inline-block w-4 h-4 border-2 border-[#21262d] border-t-[#38bdf8] rounded-full animate-spin" />
          </div>
        )}
      </div>
      <div className="flex-1 min-h-0 relative">
        {loading && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#060810]/80 rounded-lg"
            aria-busy="true"
            aria-label="Loading map data"
          >
            <div
              className="w-10 h-10 border-2 border-[#21262d] border-t-[#38bdf8] rounded-full animate-spin"
              aria-hidden
            />
            <p className="mt-3 text-sm text-[#8b949e]">Loading intersections…</p>
          </div>
        )}
        <Map
          ref={mapRef}
          mapboxAccessToken={token}
          initialViewState={NYC_CENTER}
          style={{ width: '100%', height: '100%' }}
          mapStyle="mapbox://styles/mapbox/dark-v11"
        >
          {intersections.map((int, i) => {
            const { lat, lng } = getCoords(int, i)
            const score = int.congestion_score ?? int.current_score ?? int.score
            const rawLevel = int.level ?? int.current_level
            const level = rawLevel ? String(rawLevel).toUpperCase() : getLevelFromScore(score)
            const color = (LEVEL_COLORS[level] ?? LEVEL_COLORS.NORMAL)
            const isCritical = level === 'CRITICAL'
            const id = int.id ?? int.intersection_id
            const isHighlighted = highlightedId === id
            const onMarkerClick = (e) => {
              if (e?.originalEvent) {
                e.originalEvent.preventDefault()
                e.originalEvent.stopPropagation()
              }
              handleMarkerClick(int, i)
            }
            return (
              <Marker
                key={id ?? i}
                longitude={lng}
                latitude={lat}
                anchor="bottom"
                onClick={onMarkerClick}
              >
                <div
                  role="button"
                  tabIndex={0}
                  className={`relative w-4 h-4 rounded-full border-2 border-white shadow-lg cursor-pointer ${
                    isCritical ? 'pulse-critical' : ''
                  } ${isHighlighted ? 'ring-2 ring-cyan-400 shadow-[0_0_12px_2px_rgba(34,211,238,0.8)]' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleMarkerClick(int, i)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      e.stopPropagation()
                      handleMarkerClick(int, i)
                    }
                  }}
                />
              </Marker>
            )
          })}
          {popupInfo && (
            <Popup
              longitude={popupInfo.lng}
              latitude={popupInfo.lat}
              onClose={() => setPopupInfo(null)}
              closeButton
              closeOnClick={false}
              className="flowiq-popup"
            >
              <div className="text-sm text-left min-w-[200px]">
                <p className="font-semibold text-[#e6edf3]">
                  {popupInfo.name ?? popupInfo.id ?? popupInfo.intersection_id ?? 'Intersection'}
                </p>
                <p className="text-[#8b949e]">
                  Score: {popupInfo.congestion_score ?? popupInfo.current_score ?? popupInfo.score ?? '—'}
                </p>
                {(popupInfo.current_speed_mph != null || popupInfo.speed != null) && (
                  <p className="text-[#8b949e]">
                    Speed: {Number(popupInfo.current_speed_mph ?? popupInfo.speed).toFixed(0)} mph
                  </p>
                )}
                {(() => {
                  const rawLevel = popupInfo.level ?? popupInfo.current_level
                  const level = rawLevel
                    ? String(rawLevel).toUpperCase()
                    : getLevelFromScore(popupInfo.congestion_score ?? popupInfo.current_score ?? popupInfo.score)
                  const msg = STATUS_MESSAGES[level] ?? STATUS_MESSAGES.NORMAL
                  return <p className="mt-1 font-medium text-[#e6edf3]">{msg}</p>
                })()}
                {loadingForecast && <p className="text-[#8b949e] mt-1">Loading forecast…</p>}
                {!loadingForecast && forecast && forecast.length > 0 && (
                  <p className="text-[#38bdf8] mt-1">
                    Next 3h: {forecast.slice(0, 5).map((s) => s.congestion_score ?? s.value ?? s).join(' → ')}
                    {forecast.length > 5 ? '…' : ''}
                  </p>
                )}
              </div>
            </Popup>
          )}
        </Map>
      </div>
    </div>
  )
})
