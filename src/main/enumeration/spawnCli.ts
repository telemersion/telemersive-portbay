import { spawn, type SpawnOptions } from 'child_process'
import { existsSync } from 'fs'
import { resolve } from 'path'
import { loadSettings } from '../persistence/settings'

export interface SpawnCliResult {
  stdout: string
  stderr: string
  exitCode: number | null
}

export interface SpawnCliOptions {
  timeoutMs?: number
  env?: NodeJS.ProcessEnv
}

export class SpawnCliError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message)
    this.name = 'SpawnCliError'
  }
}

const DEFAULT_TIMEOUT_MS = 5000

const SKIP_VENDORED = process.env.NG_SKIP_VENDORED_UG === '1'

export function resolveUgPath(): string | null {
  try {
    const userPath = loadSettings().ugPath
    if (userPath && existsSync(userPath)) return userPath
  } catch {}
  if (process.env.UG_PATH) {
    return existsSync(process.env.UG_PATH) ? process.env.UG_PATH : null
  }
  if (process.platform === 'darwin') {
    if (!SKIP_VENDORED) {
      const vendored = resolve(process.cwd(), 'vendor/ultragrid/active/uv-qt.app/Contents/MacOS/uv')
      if (existsSync(vendored)) return vendored
    }
    const system = '/Applications/uv-qt.app/Contents/MacOS/uv'
    return existsSync(system) ? system : null
  }
  if (process.platform === 'linux') {
    const linux = '/usr/local/bin/uv'
    return existsSync(linux) ? linux : null
  }
  if (process.platform === 'win32') {
    return null
  }
  return null
}

export function spawnCli(
  binary: string,
  args: string[],
  options: SpawnCliOptions = {}
): Promise<SpawnCliResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  return new Promise((resolve, reject) => {
    if (!existsSync(binary)) {
      reject(new SpawnCliError(`binary not found: ${binary}`))
      return
    }

    const spawnOpts: SpawnOptions = { env: options.env ?? process.env }
    let child
    try {
      child = spawn(binary, args, spawnOpts)
    } catch (err) {
      reject(new SpawnCliError(`spawn failed: ${binary}`, err))
      return
    }

    let stdout = ''
    let stderr = ''
    let timedOut = false

    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGTERM')
    }, timeoutMs)

    child.stdout?.on('data', (chunk) => { stdout += chunk.toString() })
    child.stderr?.on('data', (chunk) => { stderr += chunk.toString() })

    child.on('error', (err) => {
      clearTimeout(timer)
      reject(new SpawnCliError(`process error: ${binary}`, err))
    })

    child.on('close', (code) => {
      clearTimeout(timer)
      if (timedOut) {
        reject(new SpawnCliError(`timeout after ${timeoutMs}ms: ${binary} ${args.join(' ')}`))
        return
      }
      resolve({ stdout, stderr, exitCode: code })
    })
  })
}
