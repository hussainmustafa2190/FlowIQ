import { useState, useEffect } from 'react'
import { getHealth } from '../api/client.js'

const POLL_MS = 10000

export function useApiHealth() {
  const [ok, setOk] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function check() {
      const result = await getHealth()
      if (!cancelled) setOk(result.ok)
    }
    check()
    const id = setInterval(check, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  return ok
}
