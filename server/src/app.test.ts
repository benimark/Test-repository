import { join } from 'node:path'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import {
  cacheControlFor,
  createApp,
  errorStatus,
  missingClientBuildWarning,
  resolvePort,
  servesSpaShell,
} from './app.ts'

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

// Same reason as above: the build is git-ignored, so the policy is tested as a function
// rather than through a request that would quietly cover nothing on a fresh checkout.
describe('cacheControlFor', () => {
  // A rebuild writes a different hash into the name, so the bytes behind one of these URLs
  // can never change. Without saying so the fingerprint buys nothing: the browser still
  // asks about every asset on every visit, only to be told each one is unchanged.
  it.each([
    join('assets', 'index-C0FFEE.js'),
    join('assets', 'index-C0FFEE.css'),
    join('assets', 'logo-D3ADB33F.svg'),
  ])('lets the browser keep the fingerprinted %s', (path) => {
    expect(cacheControlFor(path)).toBe('public, max-age=31536000, immutable')
  })

  // `index.html` keeps its name across every deploy while its contents name the current
  // build, so a cached copy is how a browser ends up asking for assets that no longer
  // exist — the blank page `servesSpaShell` exists to turn back into a legible 404.
  it.each(['index.html', 'robots.txt', join('img', 'og-card.png')])(
    'makes the unfingerprinted %s revalidate',
    (path) => {
      expect(cacheControlFor(path)).toBe('no-cache')
    },
  )
})

// A server that never got a build looks exactly like a healthy one from the outside: the
// bootstrap announces its port, `/api` answers, and only a navigation gives it away — as
// Express's own `Cannot GET /`, which names nothing that would explain it. Serving no SPA
// is the normal state in dev, where Vite serves the client instead. Under `npm start`,
// which sets `NODE_ENV=production`, it means `npm run build` never ran, and the one moment
// anybody is watching the output is the start it stays silent through.
describe('missingClientBuildWarning', () => {
  it('names the command a production start without a build is missing', () => {
    const warning = missingClientBuildWarning(false, 'production')

    expect(warning).toContain('npm run build')
  })

  // Warning outside that one case would be crying wolf: every dev run and every test that
  // builds the app would print it, which is how a real warning stops being read.
  it.each([
    ['the build is there', true, 'production'],
    ['Vite serves the client in dev', false, 'development'],
    ['a test drives the app directly', false, 'test'],
    ['nothing named an environment', false, undefined],
  ])('stays quiet when %s', (_case, hasClientBuild, nodeEnv) => {
    expect(missingClientBuildWarning(hasClientBuild, nodeEnv)).toBeNull()
  })
})

// `listen` accepts far less than an environment variable can hold, and what it does with
// the difference is never what was meant: `''` reaches it as `0`, which is the documented
// way to ask for *any* free port, so an unset variable turns into a server on a port
// nobody can predict — announced exactly like a healthy start. Everything else it rejects
// from inside `node:net`, as a RangeError naming `options.port`, thrown before the
// bootstrap's own `error` handler exists to say which variable was wrong.
describe('resolvePort', () => {
  const DEFAULT = 3001

  it.each([
    ['a plain port', '8080', 8080],
    ['surrounding whitespace, as a shell or .env file leaves it', ' 8080 ', 8080],
    ['0, the documented request for any free port', '0', 0],
    ['the top of the range', '65535', 65535],
  ])('takes %s', (_case, raw, expected) => {
    expect(resolvePort(raw, DEFAULT)).toBe(expected)
  })

  // `PORT=` with nothing after it is how a variable arrives when whatever was meant to
  // fill it did not: `docker run -e PORT`, a compose file interpolating an unset variable,
  // an empty ConfigMap value. It says "nobody chose a port", which is what the default is
  // for — and is the one bad value that would otherwise start a server successfully.
  it.each([
    ['the variable is absent', undefined],
    ['the variable is empty', ''],
    ['the variable holds only whitespace', '   '],
  ])('falls back to the default when %s', (_case, raw) => {
    expect(resolvePort(raw, DEFAULT)).toBe(DEFAULT)
  })

  // Refusing here rather than at `listen` is the difference between a message naming the
  // variable and a stack trace through node internals. Both stop the process; only one
  // tells the operator what to edit.
  it.each([
    ['not a number', 'abc'],
    ['a number with a suffix', '8080abc'],
    ['fractional', '3001.5'],
    ['negative', '-1'],
    ['above the range', '99999'],
    ['hex, which `Number` would happily take', '0x1f90'],
  ])('refuses a port that is %s, naming PORT and the value', (_case, raw) => {
    expect(() => resolvePort(raw, DEFAULT)).toThrow(/PORT/)
    expect(() => resolvePort(raw, DEFAULT)).toThrow(new RegExp(raw.trim()))
  })
})
