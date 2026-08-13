import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import App from '@/App'

/** Minimal stand-in for the parts of `Response` that `useHealth` touches. */
function jsonResponse(payload: unknown): Response {
  return { ok: true, status: 200, json: async () => payload } as Response
}

function stubFetch(respond: () => Promise<Response>) {
  const fetchMock = vi.fn(respond)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
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
})
