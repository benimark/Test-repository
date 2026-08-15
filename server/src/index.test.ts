import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

/** The bootstrap is run the way `npm start` runs it, because that is where it can fail. */
const TSX = fileURLToPath(new URL('../../node_modules/.bin/tsx', import.meta.url))
const BOOTSTRAP = fileURLToPath(new URL('./index.ts', import.meta.url))

interface PackageManifest {
  scripts: Record<string, string>
  dependencies: Record<string, string>
}

const manifest: PackageManifest = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../package.json', import.meta.url)), 'utf8'),
)

/** Binaries the Node installation itself provides, which therefore need no package. */
const PROVIDED_BY_NODE = ['node', 'npm', 'npx']

/** The executable a script invokes, with any leading `NAME=value` assignments dropped. */
function scriptBinary(script: string): string {
  return script.split(/\s+/).find((token) => !/^\w+=/.test(token)) ?? ''
}

interface Bootstrap {
  output: () => string
  exited: Promise<number | null>
  kill: () => void
}

function startBootstrap(port: number): Bootstrap {
  const child = spawn(TSX, [BOOTSTRAP], {
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  // Both streams are collected: a start that fails has to say so somewhere, and which of
  // the two it picks is not what these tests are about.
  let output = ''
  child.stdout.on('data', (chunk: Buffer) => (output += chunk))
  child.stderr.on('data', (chunk: Buffer) => (output += chunk))

  return {
    output: () => output,
    exited: new Promise((resolve) => child.on('exit', resolve)),
    kill: () => child.kill(),
  }
}

/** Holds a port open so the bootstrap started against it cannot have it. */
function occupyPort(): Promise<{ port: number; release: () => void }> {
  return new Promise((resolve) => {
    const blocker = createServer()
    blocker.listen(0, () => {
      const address = blocker.address()
      const port = typeof address === 'object' && address !== null ? address.port : 0
      resolve({ port, release: () => blocker.close() })
    })
  })
}

async function waitFor(condition: () => boolean, timeoutMs = 20_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (condition()) {
      return true
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  return false
}

const running: Bootstrap[] = []

afterEach(() => {
  for (const bootstrap of running.splice(0)) {
    bootstrap.kill()
  }
})

describe('the server bootstrap', () => {
  it('announces the port it really got', async () => {
    const { port, release } = await occupyPort()
    release()

    const bootstrap = startBootstrap(port)
    running.push(bootstrap)

    expect(await waitFor(() => bootstrap.output().includes('API listening'))).toBe(true)
    expect(bootstrap.output()).toContain(`http://localhost:${port}`)
  }, 30_000)

  // The callback `listen(port, cb)` takes is not evidence that the port was taken: on
  // EADDRINUSE it still runs, before the `error` event and while `address()` is null. A
  // bootstrap that announces from there prints "API listening on http://localhost:3001"
  // and then serves nothing — and with no `error` handler the process leaves quietly on
  // status 0, so the reason never reaches the log and a supervisor set to restart on
  // failure reads the failed start as a clean shutdown.
  it('stays quiet and fails loudly when the port is already taken', async () => {
    const { port, release } = await occupyPort()

    try {
      const bootstrap = startBootstrap(port)
      running.push(bootstrap)
      const code = await bootstrap.exited

      expect(bootstrap.output()).not.toContain('API listening')
      expect(bootstrap.output()).toContain('EADDRINUSE')
      expect(code).not.toBe(0)
    } finally {
      release()
    }
  }, 30_000)
})

// Nothing compiles `server/src` — `tsconfig.server.json` is `noEmit` and there is no build
// step for the server — so `npm start` runs the TypeScript itself through a runner. That
// runner is as much a part of production as Express is, and `npm ci --omit=dev` installs
// `dependencies` only: declared as a devDependency it is simply absent on the server, and
// the documented start command dies with `sh: tsx: command not found` (status 127) before
// a single request is served. Reproduced against a real `--omit=dev` install.
describe('the production start command', () => {
  it('invokes a binary that a production install still ships', () => {
    const binary = scriptBinary(manifest.scripts.start)

    expect(binary).not.toBe('')
    expect([...PROVIDED_BY_NODE, ...Object.keys(manifest.dependencies)]).toContain(binary)
  })
})
