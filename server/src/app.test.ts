import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp, servesSpaShell } from './app.ts'

describe('GET /api/health', () => {
  it('reports that the server is up', async () => {
    const response = await request(createApp()).get('/api/health')

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ status: 'ok' })
    expect(response.body.uptime).toBeGreaterThan(0)
    expect(Date.parse(response.body.timestamp)).not.toBeNaN()
  })
})

describe('unknown API routes', () => {
  it('answer with JSON instead of falling through to the SPA', async () => {
    const response = await request(createApp()).get('/api/nope')

    expect(response.status).toBe(404)
    expect(response.body).toEqual({ error: 'Not Found' })
  })
})

// Driven directly rather than through supertest because the fallback only registers when
// `dist/client` exists, and the build is git-ignored — a request-level test would silently
// stop covering anything on a fresh checkout.
describe('the SPA shell fallback', () => {
  it.each(['/', '/valami', '/egy/mely/link'])('answers the navigation %s', (path) => {
    expect(servesSpaShell('GET', path)).toBe(true)
  })

  // A request that names a file is not a navigation. Serving it the shell would hand the
  // browser HTML under a `.js` URL, which fails the module MIME check and blanks the page.
  it.each(['/assets/index-C0FFEE.js', '/assets/index-C0FFEE.css', '/favicon.ico'])(
    'leaves the missing file %s to 404',
    (path) => {
      expect(servesSpaShell('GET', path)).toBe(false)
    },
  )

  it.each(['POST', 'PUT', 'DELETE'])('does not answer a %s request with the shell', (method) => {
    expect(servesSpaShell(method, '/valami')).toBe(false)
  })
})
