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
 * What to say when the server comes up without the SPA it is supposed to ship, or `null`
 * when that is nothing to write home about.
 *
 * Serving no client is the normal state in dev — Vite serves it, and this process is only
 * the API. Under `npm start`, which sets `NODE_ENV=production`, it means `npm run build`
 * never ran. Nothing else reports that: the bootstrap still announces its port, `/api`
 * still answers, and the only symptom is that every navigation falls through to Express's
 * own `Cannot GET /`, which names no cause. A start that serves no site has to say so
 * while somebody is still reading the output.
 */
export function missingClientBuildWarning(
  hasClientBuild: boolean,
  nodeEnv: string | undefined,
): string | null {
  if (hasClientBuild || nodeEnv !== 'production') {
    return null
  }

  return `No client build at ${CLIENT_DIST} — serving the API only, so every page request will 404. Run \`npm run build\` before \`npm start\`.`
}

/** The largest port number `listen` will take. */
const MAX_PORT = 65535

/**
 * The port to bind, from the raw `PORT` environment variable.
 *
 * `listen` accepts far less than an environment variable can hold, and it is worth one
 * check here because of what it does with the difference. An empty `PORT` — the state the
 * variable is in whenever whatever was meant to fill it did not, as with `docker run -e
 * PORT` or a compose file interpolating an unset variable — reaches it as `0`, which is
 * the documented way to ask for *any* free port. So the least deliberate value there is
 * starts a server on an unpredictable port and announces it in the same words a healthy
 * start uses, while the reverse proxy, the health check and the Vite dev proxy all keep
 * going to the default. Nothing chose that port, so it is the default that was meant.
 *
 * Anything else `listen` rejects itself, but from inside `node:net` and synchronously —
 * before the bootstrap has registered the `error` handler that would explain it — so the
 * operator gets a RangeError about `options.port` rather than the name of the variable to
 * edit. Naming it here costs one throw.
 */
export function resolvePort(raw: string | undefined, fallback: number): number {
  const value = raw?.trim() ?? ''

  if (value === '') {
    return fallback
  }

  // Deliberately stricter than `Number`, which also takes `0x1f90`, `1e3` and `Infinity`.
  // None of those is a port anybody typed, and each would bind a different one than it looks.
  const port = /^\d+$/.test(value) ? Number(value) : Number.NaN

  if (Number.isNaN(port) || port > MAX_PORT) {
    throw new Error(
      `PORT must be a whole number between 0 and ${MAX_PORT}, but it is "${raw}". ` +
        'Leave it unset to use the default.',
    )
  }

  return port
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
  const hasClientBuild = existsSync(clientEntry)

  const warning = missingClientBuildWarning(hasClientBuild, process.env.NODE_ENV)
  if (warning !== null) {
    console.warn(warning)
  }

  if (hasClientBuild) {
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
