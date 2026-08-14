import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import App from '@/App'
import { HEALTH_TIMEOUT_MS } from '@/hooks/use-health'

/** Minimal stand-in for the parts of `Response` that `useHealth` touches. */
function jsonResponse(payload: unknown): Response {
  return { ok: true, status: 200, json: async () => payload } as Response
}

function stubFetch(respond: (input: string, init?: RequestInit) => Promise<Response>) {
  const fetchMock = vi.fn(respond)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('App', () => {
  it('greets the visitor', () => {
    stubFetch(async () => jsonResponse({ status: 'ok', uptime: 12, timestamp: '' }))

    render(<App />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Üdvözlünk az eseményhorizonton',
    )
  })

  it('reports the backend as online once the health check answers', async () => {
    const fetchMock = stubFetch(async () =>
      jsonResponse({ status: 'ok', uptime: 90, timestamp: '2026-08-13T12:00:00.000Z' }),
    )

    render(<App />)

    expect(await screen.findByText('Online')).toBeInTheDocument()
    expect(screen.getByText('1 perc')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/health', expect.anything())
  })

  it('reports the backend as unreachable when the health check fails', async () => {
    stubFetch(async () => {
      throw new Error('network down')
    })

    render(<App />)

    expect(await screen.findByText('Nem érhető el')).toBeInTheDocument()
  })

  // A refused connection is not the only way to be unreachable, and it is not the common
  // one: a backend that accepts the request and then never answers leaves the tile on
  // "Kapcsolódás…" for as long as the tab stays open, because nothing else ever settles
  // the request. The panel exists to say whether the API answers, so silence has to
  // become an answer — and only a state change reaches `role="status"`.
  it('reports the backend as unreachable when the health check never answers', async () => {
    vi.useFakeTimers()
    stubFetch(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'))
          })
        }),
    )

    render(<App />)

    expect(screen.getByText('Kapcsolódás…')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(HEALTH_TIMEOUT_MS)
    })

    expect(screen.getByText('Nem érhető el')).toBeInTheDocument()
  })

  // The repository link is the only control that leaves the page for a new tab. Screen
  // readers do not announce `target="_blank"`, so the warning has to be part of the
  // accessible name — otherwise the user is moved somewhere Back no longer returns them
  // from, with no notice that it happened.
  it('warns that the repository link opens a new tab', () => {
    stubFetch(async () => jsonResponse({ status: 'ok', uptime: 12, timestamp: '' }))

    render(<App />)

    const link = screen.getByRole('link', { name: /Forráskód/ })

    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAccessibleName('Forráskód (új lapon nyílik meg)')
  })
})
