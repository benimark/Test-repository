import { useEffect, useState } from 'react'

/** Mirrors `HealthPayload` in `server/src/app.ts`. */
interface HealthResponse {
  status: 'ok'
  uptime: number
  timestamp: string
}

export type HealthState =
  | { status: 'loading' }
  | { status: 'online'; uptime: number }
  | { status: 'offline' }

/** Asks the Express API once on mount so the page can show whether the backend answers. */
export function useHealth(): HealthState {
  const [state, setState] = useState<HealthState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()

    fetch('/api/health', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Health check failed with status ${response.status}`)
        }
        return response.json() as Promise<HealthResponse>
      })
      .then((payload) => {
        setState({ status: 'online', uptime: payload.uptime })
      })
      .catch(() => {
        if (controller.signal.aborted) {
          return
        }
        setState({ status: 'offline' })
      })

    return () => {
      controller.abort()
    }
  }, [])

  return state
}
