import { useEffect, useState } from 'react'

/** Mirrors `HealthPayload` in `server/src/app.ts`. */
interface HealthResponse {
  status: 'ok'
  uptime: number
  timestamp: string
}

/**
 * How long the API may stay silent before the page calls it unreachable.
 *
 * `fetch` imposes no deadline of its own, so a backend that accepts the request and never
 * answers would otherwise leave the panel mid-sentence for as long as the tab is open.
 */
export const HEALTH_TIMEOUT_MS = 8000

export type HealthState =
  | { status: 'loading' }
  | { status: 'online'; uptime: number }
  | { status: 'offline' }

/** Asks the Express API once on mount so the page can show whether the backend answers. */
export function useHealth(): HealthState {
  const [state, setState] = useState<HealthState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    let unmounted = false

    // A backend that answers nothing at all is as unreachable as one that refuses the
    // connection, and the panel has to say so rather than stay on "Kapcsolódás…" — that
    // label is a promise of an answer, and `role="status"` only announces a change.
    const deadline = setTimeout(() => {
      controller.abort()
    }, HEALTH_TIMEOUT_MS)

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
        // Both the deadline and the cleanup below abort the same request, so the signal no
        // longer tells the two apart: only an unmount must leave the state alone.
        if (unmounted) {
          return
        }
        setState({ status: 'offline' })
      })
      .finally(() => {
        clearTimeout(deadline)
      })

    return () => {
      unmounted = true
      clearTimeout(deadline)
      controller.abort()
    }
  }, [])

  return state
}
