import { spawn, type ChildProcess, type SpawnOptions } from 'child_process'

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

  private spawnOptions(): SpawnOptions {
    const env = this.opts.env ?? process.env
    // stdout/stderr are piped so the monitor log keeps receiving UV output.
    const stdio: SpawnOptions['stdio'] = ['ignore', 'pipe', 'pipe']

    if (process.platform === 'win32') {
      // windowsHide maps to CREATE_NO_WINDOW: UV (a console app launched from
      // Electron's GUI subsystem) gets its OWN hidden console. Because it has a
      // console, SpoutLibrary's AllocConsole() is a no-op, so no visible
      // SpoutLibrary.log window appears (closing that window would kill UV).
      // We must NOT pass detached on Windows — that maps to DETACHED_PROCESS,
      // which gives the child no console, letting AllocConsole succeed and open
      // the log window. Process-group teardown isn't needed here; stop() calls
      // child.kill() (TerminateProcess) directly on Windows.
      return { env, stdio, windowsHide: true }
    }

    // POSIX: detached puts the child in a new process group so stop() can signal
    // the whole group — catches helper subprocesses UV may fork.
    return { env, stdio, detached: true }
  }

  start(): void {
    if (this.child) return

    this.stopRequested = false
    this.stdoutBuf = ''
    this.stderrBuf = ''
    this.spawnedAt = Date.now()

    let child: ChildProcess
    try {
      child = spawn(this.opts.binary, this.opts.args, this.spawnOptions())
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
    if (process.platform === 'win32') {
      // Windows does not support POSIX process groups or signal names.
      // child.kill() calls TerminateProcess under the hood, which is equivalent
      // to SIGKILL — no graceful shutdown, which is what we want anyway.
      try { child.kill() } catch { /* already dead */ }
      return
    }
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
