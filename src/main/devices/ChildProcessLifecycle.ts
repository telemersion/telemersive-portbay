import { spawn, type ChildProcess } from 'child_process'

export type ExitReason = 'spawn-failure' | 'crash' | 'killed'

export interface LifecycleOptions {
  binary: string
  args: string[]
  env?: NodeJS.ProcessEnv
  spawnGraceMs?: number
  zombieEscapeMs?: number
  onStdout?: (line: string) => void
  onStderr?: (line: string) => void
  onExit?: (reason: ExitReason, code: number | null) => void
}

const DEFAULT_SPAWN_GRACE_MS = 2000
const DEFAULT_ZOMBIE_ESCAPE_MS = 2000

export class ChildProcessLifecycle {
  private child: ChildProcess | null = null
  private spawnedAt = 0
  private stopRequested = false
  private escapeTimer: NodeJS.Timeout | null = null
  private stdoutBuf = ''
  private stderrBuf = ''

  constructor(private readonly opts: LifecycleOptions) {}

  start(): void {
    if (this.child) return

    this.stopRequested = false
    this.stdoutBuf = ''
    this.stderrBuf = ''
    this.spawnedAt = Date.now()

    let child: ChildProcess
    try {
      // detached: true puts the child in a new process group so we can signal
      // the entire group on stop — catches helper subprocesses UV may fork
      // (and works around PID-vs-group ambiguity with the shell-wrapped `uv`).
      child = spawn(this.opts.binary, this.opts.args, {
        env: this.opts.env ?? process.env,
        detached: true
      })
    } catch {
      this.opts.onExit?.('spawn-failure', null)
      return
    }
    this.child = child

    child.stdout?.on('data', (chunk) => {
      this.stdoutBuf = this.emitLines(this.stdoutBuf + chunk.toString(), this.opts.onStdout)
    })
    child.stderr?.on('data', (chunk) => {
      this.stderrBuf = this.emitLines(this.stderrBuf + chunk.toString(), this.opts.onStderr)
    })

    child.on('error', () => {
      this.finalize('spawn-failure', null)
    })

    child.on('exit', (code) => {
      if (this.stdoutBuf) { this.opts.onStdout?.(this.stdoutBuf); this.stdoutBuf = '' }
      if (this.stderrBuf) { this.opts.onStderr?.(this.stderrBuf); this.stderrBuf = '' }

      if (this.stopRequested) {
        this.finalize('killed', code)
      } else if (Date.now() - this.spawnedAt < (this.opts.spawnGraceMs ?? DEFAULT_SPAWN_GRACE_MS)) {
        this.finalize('spawn-failure', code)
      } else {
        this.finalize('crash', code)
      }
    })
  }

  stop(): void {
    if (!this.child || this.stopRequested) return
    this.stopRequested = true

    const child = this.child
    // Go straight to SIGKILL. SIGTERM would trigger UV's graceful teardown,
    // which calls vidcap_syphon_done and deadlocks against Syphon's dispatch
    // queue — leaving uninterruptible-wait zombies the kernel can never reap.
    // We don't need graceful socket close (UDP media is broker-independent),
    // so skipping user-space cleanup avoids the race entirely.
    this.signalGroup(child, 'SIGKILL')

    // Escape hatch: even SIGKILL cannot interrupt a process already stuck in
    // kernel-wait. If the exit event doesn't fire, move our own state forward
    // so the app isn't blocked waiting on a zombie.
    this.escapeTimer = setTimeout(() => {
      this.escapeTimer = null
      if (this.child === child) this.finalize('killed', null)
    }, this.opts.zombieEscapeMs ?? DEFAULT_ZOMBIE_ESCAPE_MS)
  }

  private signalGroup(child: ChildProcess, signal: NodeJS.Signals): void {
    if (typeof child.pid !== 'number') return
    try { process.kill(-child.pid, signal) } catch {
      // Group kill can fail if the leader already died; fall back to the PID.
      try { child.kill(signal) } catch { /* already dead */ }
    }
  }

  isRunning(): boolean {
    return this.child !== null && !this.stopRequested
  }

  private emitLines(buffer: string, emit?: (line: string) => void): string {
    if (!emit) return ''
    const parts = buffer.split(/\r?\n/)
    const remainder = parts.pop() ?? ''
    for (const line of parts) emit(line)
    return remainder
  }

  private finalize(reason: ExitReason, code: number | null): void {
    if (this.escapeTimer) { clearTimeout(this.escapeTimer); this.escapeTimer = null }
    this.child = null
    this.opts.onExit?.(reason, code)
  }
}
