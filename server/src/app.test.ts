import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp, errorStatus, servesSpaShell } from './app.ts'

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

// A body the server cannot parse is the caller's mistake, and `express.json()` already says
// so: it rejects with an error naming a 4xx status. Answering those with 500 tells the caller
// to retry a request that can never succeed, and files every junk request under "the server
// is broken" in the logs and in whatever watches them.
describe('a request the server refuses to parse', () => {
  it('answers malformed JSON with the 400 the parser named', async () => {
    const response = await request(createApp())
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{bad json')

    expect(response.status).toBe(400)
    expect(response.body).toEqual({ error: 'Bad Request' })
  })

  it('answers a body over the size limit with 413', async () => {
    const response = await request(createApp())
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify('a'.repeat(200_000)))

    expect(response.status).toBe(413)
    expect(response.body).toEqual({ error: 'Payload Too Large' })
  })
})

describe('errorStatus', () => {
  it.each([
    ['a parse failure', { status: 400 }, 400],
    ['an oversized body', { status: 413, statusCode: 413 }, 413],
    ['a status carried only as statusCode', { statusCode: 415 }, 415],
    ['an upstream outage', { status: 503 }, 503],
  ])('reports %s with the status it names', (_case, error, expected) => {
    expect(errorStatus(error)).toBe(expected)
  })

  // Anything that does not name a plausible HTTP status is a genuine fault. A thrown value
  // must never be able to talk the server into answering 200 or some nonsense status.
  it.each([
    ['a bare Error', new Error('boom')],
    ['a non-object', 'boom'],
    ['nothing at all', null],
    ['a success status', { status: 200 }],
    ['an out-of-range status', { status: 42 }],
    ['a non-numeric status', { status: '400' }],
  ])('falls back to 500 for %s', (_case, error) => {
    expect(errorStatus(error)).toBe(500)
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
