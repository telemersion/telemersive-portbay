// Last line of defence for uncaught exceptions in the main process.
//
// Why this exists (issue #7): telemersive-bus' MQTT wrapper (lib/connect/MQTTBus.js)
// does `client.on('error', err => { throw err })`. mqtt.js emits every socket error
// that carries a `code` (EPIPE, ECONNRESET, ...) as a client 'error', so a broker or
// network that drops the TCP connection turns into an uncaught exception and
// Electron's "A JavaScript error occurred in the main process" dialog. The mqtt
// client reconnects on its own; the exception adds nothing but the dialog.
//
// Transient network errors are logged to the activity log and swallowed. Anything
// else still surfaces through `fatal`, which shows the same dialog Electron would.

const TRANSIENT_NETWORK_CODES: ReadonlySet<string> = new Set([
  'EPIPE',
  'ECONNRESET',
  'ECONNABORTED',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENETDOWN',
  'ENOTFOUND',
  'EAI_AGAIN'
])

export function isTransientNetworkError(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code
  return typeof code === 'string' && TRANSIENT_NETWORK_CODES.has(code)
}

export interface CrashGuardHandlers {
  onTransient: (err: Error) => void
  fatal: (err: Error) => void
}

export function handleUncaughtException(err: unknown, handlers: CrashGuardHandlers): void {
  const error = err instanceof Error ? err : new Error(String(err))
  if (isTransientNetworkError(error)) handlers.onTransient(error)
  else handlers.fatal(error)
}

export function installCrashGuard(handlers: CrashGuardHandlers): void {
  process.on('uncaughtException', (err) => handleUncaughtException(err, handlers))
}
