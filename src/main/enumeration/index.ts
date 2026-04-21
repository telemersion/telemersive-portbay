import { resolveUgPath, spawnCli } from './spawnCli'
import {
  applicableBackends,
  backendFallback,
  backendFromRefreshTopic,
  backendTopic,
  ugEnableTopic,
  type Backend
} from './topics'

export type EnumeratePublish = (retained: 0 | 1, topic: string, value: string) => void

interface BackendSpec {
  args: string[]
  parse: (stdout: string) => { range: string; count: number }
}

type BackendRegistry = Partial<Record<Backend, BackendSpec>>

let registry: BackendRegistry = {}

export function registerBackend(backend: Backend, spec: BackendSpec): void {
  registry[backend] = spec
}

export function resetRegistry(): void {
  registry = {}
}

export interface EnumerateOptions {
  only?: Backend[]
}

export async function enumerate(
  peerId: string,
  publish: EnumeratePublish,
  options: EnumerateOptions = {}
): Promise<void> {
  if (!peerId) return

  const uvPath = resolveUgPath()
  const applicable = applicableBackends()
  const selected = options.only
    ? applicable.filter((b) => options.only!.includes(b))
    : applicable

  if (!uvPath) {
    publish(1, ugEnableTopic(peerId), '0')
    for (const backend of selected) {
      publish(1, backendTopic(peerId, backend), backendFallback(backend))
    }
    console.warn('[enumerate] UltraGrid binary not found; publishing fallback enumeration')
    return
  }

  publish(1, ugEnableTopic(peerId), '1')

  await Promise.allSettled(selected.map((b) => runBackend(b, uvPath, peerId, publish)))
}

export async function handleRefreshTrigger(
  peerId: string,
  topic: string,
  publish: EnumeratePublish
): Promise<boolean> {
  const backend = backendFromRefreshTopic(peerId, topic)
  if (!backend) return false
  await enumerate(peerId, publish, { only: [backend] })
  return true
}

async function runBackend(
  backend: Backend,
  uvPath: string,
  peerId: string,
  publish: EnumeratePublish
): Promise<void> {
  const spec = registry[backend]
  if (!spec) {
    publish(1, backendTopic(peerId, backend), backendFallback(backend))
    return
  }

  try {
    const result = await spawnCli(uvPath, spec.args, { env: sanitizedChildEnv() })
    const parsed = spec.parse(result.stdout)
    publish(1, backendTopic(peerId, backend), parsed.range)
  } catch (err: any) {
    publish(1, backendTopic(peerId, backend), backendFallback(backend))
    console.warn(`[enumerate] ${backend} failed: ${err?.message ?? err}`)
  }
}

function sanitizedChildEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  delete env.__CFBundleIdentifier
  delete env.MallocNanoZone
  return env
}
