import type { AddressInfo } from 'node:net'
import { createApp, resolvePort } from './app.ts'

/** What `vite.config.ts` proxies `/api` to in dev, and what the README documents. */
const DEFAULT_PORT = 3001

let port: number
try {
  port = resolvePort(process.env.PORT, DEFAULT_PORT)
} catch (error) {
  // A port that cannot be bound is a start that cannot be finished, and the message says
  // which variable to edit — which the RangeError from inside `listen` does not.
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}

const server = createApp().listen(port)

// Announced from `listening` rather than from the callback `listen(port, cb)` takes: that
// callback runs even when the bind fails, before the `error` event and while `address()`
// is still null, so it would announce a port the server never got. `listening` waits for
// the port to actually be ours, and carries the one the OS handed out — the number worth
// printing when `PORT=0` asks for any free port.
server.on('listening', () => {
  const { port: boundPort } = server.address() as AddressInfo
  console.log(`API listening on http://localhost:${boundPort}`)
})

// Without this the process leaves quietly on status 0: nothing says why the server never
// came up, and a supervisor set to restart on failure reads the failed start as a clean
// shutdown and leaves the port unserved.
server.on('error', (error) => {
  console.error(`API failed to listen on port ${port}:`, error)
  process.exitCode = 1
})
