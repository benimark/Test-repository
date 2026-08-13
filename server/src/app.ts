import { existsSync } from 'node:fs'
import { join } from 'node:path'
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
    app.use((_req, res) => {
      res.sendFile(clientEntry)
    })
  }

  const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
    console.error(error)
    res.status(500).json({ error: 'Internal Server Error' })
  }
  app.use(handleError)

  return app
}
