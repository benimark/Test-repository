import { existsSync } from 'node:fs'
import { STATUS_CODES } from 'node:http'
import { extname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import express, { type ErrorRequestHandler, type Express } from 'express'

/** Vite build output, as configured in `vite.config.ts`. */
const CLIENT_DIST = fileURLToPath(new URL('../../dist/client', import.meta.url))

/** Where Vite puts the files it fingerprints — `build.assetsDir`, which we leave at its default. */
const FINGERPRINTED_DIR = 'assets'

export interface HealthPayload {
  status: 'ok'
  uptime: number
  timestamp: string
}

/**
 * Whether the SPA shell is the right answer for a request that matched no static file.
 *
 * Only navigations qualify. A request naming a file — most often a hashed asset that a
 * cached `index.html` still points at after a redeploy — has to stay a 404: answering it
 * with the shell serves HTML under a `.js` URL, which the browser rejects on the module
 * MIME check, leaving a blank page instead of one missing-file error in the console.
 */
export function servesSpaShell(method: string, path: string): boolean {
  return (method === 'GET' || method === 'HEAD') && extname(path) === ''
}

/**
 * How long a built file may be reused, keyed by its path inside `dist/client`.
 *
 * Vite writes a content hash into every name under `assets/`, so a rebuild produces a new
 * URL rather than new bytes at the old one. Those can be kept forever, and saying so is the
 * whole point of the hash — otherwise the browser still asks about every asset on every
 * visit and is told each time that nothing changed.
 *
 * `index.html` is the opposite. Its name never changes while its contents name the current
 * build, so a cached copy is exactly how a browser comes to request assets a redeploy has
 * already deleted — the failure `servesSpaShell` exists to keep legible.
 */
export function cacheControlFor(pathInBuild: string): string {
  return pathInBuild.split(sep)[0] === FINGERPRINTED_DIR
    ? 'public, max-age=31536000, immutable'
    : 'no-cache'
}

/**
 * The status a failed request should be answered with.
 *
 * Middleware that rejects a request the caller got wrong — a body that is not JSON, one
 * over the size limit — throws an error that already names its own 4xx status. Answering
 * those with 500 tells the caller to retry something that can never succeed, and files
 * every junk request under "the server is broken" for whatever reads the logs.
 *
 * Only a plausible HTTP status is taken from the error; anything else means nobody
 * classified this failure, which makes it a genuine server fault.
 */
export function errorStatus(error: unknown): number {
  if (typeof error !== 'object' || error === null) {
    return 500
  }

  // http-errors defines both of these on the prototype rather than as own properties, so
  // this has to stay a plain read — an own-key check would miss them entirely.
  const { status, statusCode } = error as { status?: unknown; statusCode?: unknown }
  const named = typeof status === 'number' ? status : statusCode

  return typeof named === 'number' && Number.isInteger(named) && named >= 400 && named <= 599
    ? named
    : 500
}

/**
 * Builds the Express application without binding a port, so tests can drive it
 * directly and `index.ts` stays a thin bootstrap.
 */
export function createApp(): Express {
  const app = express()

  app.disable('x-powered-by')
  app.use(express.json())

  app.get('/api/health', (_req, res) => {
    const payload: HealthPayload = {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }
    res.json(payload)
  })

  // Unknown API routes must not fall through to the SPA fallback below.
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not Found' })
  })

  // In production this server also ships the built SPA. In dev the Vite server does
  // that job, so there is nothing to serve here yet.
  const clientEntry = join(CLIENT_DIST, 'index.html')
  if (existsSync(clientEntry)) {
    app.use(
      express.static(CLIENT_DIST, {
        setHeaders: (res, filePath) => {
          res.setHeader('Cache-Control', cacheControlFor(relative(CLIENT_DIST, filePath)))
        },
      }),
    )
    app.use((req, res, next) => {
      if (!servesSpaShell(req.method, req.path)) {
        next()
        return
      }
      // The shell reaches deep links through here rather than through the static handler
      // above, so it has to be told to revalidate on this path too.
      res.sendFile(clientEntry, { headers: { 'Cache-Control': cacheControlFor('index.html') } })
    })
  }

  const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
    const status = errorStatus(error)

    // A stack trace is what a server fault deserves. Printing one for every malformed
    // request lets any caller fill the log with noise that reads like our own failures.
    if (status >= 500) {
      console.error(error)
    }

    res.status(status).json({ error: STATUS_CODES[status] ?? 'Internal Server Error' })
  }
  app.use(handleError)

  return app
}
