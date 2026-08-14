import { existsSync } from 'node:fs'
import { STATUS_CODES } from 'node:http'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import express, { type ErrorRequestHandler, type Express } from 'express'

/** Vite build output, as configured in `vite.config.ts`. */
const CLIENT_DIST = fileURLToPath(new URL('../../dist/client', import.meta.url))

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
    app.use(express.static(CLIENT_DIST))
    app.use((req, res, next) => {
      if (!servesSpaShell(req.method, req.path)) {
        next()
        return
      }
      res.sendFile(clientEntry)
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
