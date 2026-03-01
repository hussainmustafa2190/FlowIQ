import { useState, useCallback } from 'react'
import Map, { Marker, Popup } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'
import { LEVEL_COLORS, NYC_CENTER } from '../constants.js'
import { postPredict } from '../api/flows.js'

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

export function LiveMap({ intersections, onSelectIntersection, selectedId, loading }) {
  const [popupInfo, setPopupInfo] = useState(null)
  const [forecast, setForecast] = useState(null)
  const [loadingForecast, setLoadingForecast] = useState(false)

  const handleMarkerClick = useCallback(
    async (intersection, index) => {
      const id = intersection.id ?? intersection.intersection_id
      setPopupInfo({ ...intersection, ...getCoords(intersection, index) })
      onSelectIntersection?.(intersection)
      setForecast(null)
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

  const token = import.meta.env.VITE_MAPBOX_TOKEN || ''

  if (!token) {
    return (
      <div className="w-full h-full bg-[#0d1117] border border-[#21262d] rounded-lg flex items-center justify-center text-[#8b949e]">
        Set VITE_MAPBOX_TOKEN in .env to enable the map.
      </div>
    )
  }

  return (
    <div className="w-full h-full rounded-lg overflow-hidden border border-[#21262d] relative">
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
        mapboxAccessToken={token}
        initialViewState={NYC_CENTER}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
      >
        {intersections.map((int, i) => {
          const { lat, lng } = getCoords(int, i)
          const level = (int.level || int.current_level || 'NORMAL').toUpperCase()
          const color = LEVEL_COLORS[level] || LEVEL_COLORS.NORMAL
          const isCritical = level === 'CRITICAL'
          const onMarkerClick = (e) => {
            if (e && e.originalEvent) {
              e.originalEvent.preventDefault()
              e.originalEvent.stopPropagation()
            }
            handleMarkerClick(int, i)
          }
          return (
            <Marker
              key={int.id ?? int.intersection_id ?? i}
              longitude={lng}
              latitude={lat}
              anchor="bottom"
              onClick={onMarkerClick}
            >
              <div
                role="button"
                tabIndex={0}
                className={`relative w-4 h-4 rounded-full border-2 border-white shadow-lg cursor-pointer ${isCritical ? 'pulse-critical' : ''}`}
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
            <div className="text-sm text-left min-w-[160px]">
              <p className="font-semibold text-[#e6edf3]">
                {popupInfo.name ?? popupInfo.id ?? popupInfo.intersection_id ?? 'Intersection'}
              </p>
              <p className="text-[#8b949e]">
                Score: {popupInfo.congestion_score ?? popupInfo.current_score ?? popupInfo.score ?? '—'}
              </p>
              {loadingForecast && <p className="text-[#8b949e]">Loading forecast…</p>}
              {forecast && forecast.length > 0 && (
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
  )
}
