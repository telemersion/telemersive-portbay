import { spawn, type ChildProcess } from 'child_process'

export type ExitReason = 'spawn-failure' | 'crash' | 'killed'

export interface LifecycleOptions {
  binary: string
  args: string[]
  spawnGraceMs?: number
  terminationGraceMs?: number
  onStdout?: (line: string) => void
  onStderr?: (line: string) => void
  onExit?: (reason: ExitReason, code: number | null) => void
}

const DEFAULT_SPAWN_GRACE_MS = 2000
const DEFAULT_TERMINATION_GRACE_MS = 500

export class ChildProcessLifecycle {
  private child: ChildProcess | null = null
  private spawnedAt = 0
  private stopRequested = false
  private killTimer: NodeJS.Timeout | null = null
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
      child = spawn(this.opts.binary, this.opts.args)
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
    try { child.kill('SIGTERM') } catch { /* already dead */ }

    this.killTimer = setTimeout(() => {
      this.killTimer = null
      if (this.child === child) {
        try { child.kill('SIGKILL') } catch { /* already dead */ }
      }
    }, this.opts.terminationGraceMs ?? DEFAULT_TERMINATION_GRACE_MS)
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
    if (this.killTimer) { clearTimeout(this.killTimer); this.killTimer = null }
    this.child = null
    this.opts.onExit?.(reason, code)
  }
}
