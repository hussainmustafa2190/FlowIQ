import axios from 'axios'

const API_BASE = 'http://localhost:8000'

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

export async function getHealth() {
  try {
    const { data } = await api.get('/health')
    return { ok: true, data }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}
