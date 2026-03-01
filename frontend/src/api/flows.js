import { api } from './client.js'

export async function getIntersections() {
  const { data } = await api.get('/intersections')
  return data
}

export async function getHotspots() {
  const { data } = await api.get('/hotspots')
  return data
}

export async function getResources() {
  const { data } = await api.get('/resources')
  return data
}

export async function postOptimize() {
  const { data } = await api.post('/optimize', {})
  return data
}

export async function getWeather() {
  const { data } = await api.get('/weather')
  return data
}

export async function postPredict(intersectionId, hoursAhead = 3) {
  const { data } = await api.post('/predict', {
    intersection_id: intersectionId,
    hours_ahead: hoursAhead,
  })
  return data
}

export async function getBoroughStats() {
  const { data } = await api.get('/borough-stats')
  return data
}
