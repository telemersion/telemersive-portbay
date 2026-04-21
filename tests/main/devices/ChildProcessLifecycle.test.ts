import { describe, it, expect } from 'vitest'
import { ChildProcessLifecycle, type ExitReason } from '../../../src/main/devices/ChildProcessLifecycle'

const SH = '/bin/sh'

function waitForExit(timeoutMs = 5000): {
  promise: Promise<{ reason: ExitReason; code: number | null }>
  resolve: (v: { reason: ExitReason; code: number | null }) => void
} {
  let resolve!: (v: { reason: ExitReason; code: number | null }) => void
  const promise = new Promise<{ reason: ExitReason; code: number | null }>((res, rej) => {
    resolve = res
    setTimeout(() => rej(new Error(`exit did not fire within ${timeoutMs}ms`)), timeoutMs)
  })
  return { promise, resolve }
}

describe('ChildProcessLifecycle', () => {
  it('classifies early exit as spawn-failure', async () => {
    const exit = waitForExit()
    const lifecycle = new ChildProcessLifecycle({
      binary: SH,
      args: ['-c', 'exit 2'],
      spawnGraceMs: 2000,
      onExit: (reason, code) => exit.resolve({ reason, code })
    })
    lifecycle.start()
    const { reason, code } = await exit.promise
    expect(reason).toBe('spawn-failure')
    expect(code).toBe(2)
  })

  it('classifies exit after spawn grace as crash', async () => {
    const exit = waitForExit()
    const lifecycle = new ChildProcessLifecycle({
      binary: SH,
      args: ['-c', 'sleep 0.3; exit 7'],
      spawnGraceMs: 100,
      onExit: (reason, code) => exit.resolve({ reason, code })
    })
    lifecycle.start()
    const { reason, code } = await exit.promise
    expect(reason).toBe('crash')
    expect(code).toBe(7)
  })

  it('classifies explicit stop as killed', async () => {
    const exit = waitForExit()
    const lifecycle = new ChildProcessLifecycle({
      binary: SH,
      args: ['-c', 'sleep 10'],
      spawnGraceMs: 100,
      onExit: (reason, code) => exit.resolve({ reason, code })
    })
    lifecycle.start()
    await new Promise((r) => setTimeout(r, 150))
    lifecycle.stop()
    const { reason } = await exit.promise
    expect(reason).toBe('killed')
  })

  it('SIGKILL fires after termination grace if SIGTERM is ignored', async () => {
    const exit = waitForExit()
    const started = Date.now()
    const lifecycle = new ChildProcessLifecycle({
      binary: SH,
      args: ['-c', 'trap "" TERM; sleep 10'],
      terminationGraceMs: 150,
      onExit: (reason) => exit.resolve({ reason, code: null })
    })
    lifecycle.start()
    await new Promise((r) => setTimeout(r, 50))
    lifecycle.stop()
    await exit.promise
    const elapsed = Date.now() - started
    expect(elapsed).toBeGreaterThanOrEqual(150)
    expect(elapsed).toBeLessThan(2000)
  })

  it('splits stdout into lines', async () => {
    const lines: string[] = []
    const exit = waitForExit()
    const lifecycle = new ChildProcessLifecycle({
      binary: SH,
      args: ['-c', 'printf "one\\ntwo\\nthree\\n"'],
      spawnGraceMs: 50,
      onStdout: (line) => lines.push(line),
      onExit: (reason, code) => exit.resolve({ reason, code })
    })
    lifecycle.start()
    await exit.promise
    expect(lines).toEqual(['one', 'two', 'three'])
  })

  it('splits stderr into lines', async () => {
    const lines: string[] = []
    const exit = waitForExit()
    const lifecycle = new ChildProcessLifecycle({
      binary: SH,
      args: ['-c', 'printf "err1\\nerr2\\n" 1>&2'],
      spawnGraceMs: 50,
      onStderr: (line) => lines.push(line),
      onExit: (reason, code) => exit.resolve({ reason, code })
    })
    lifecycle.start()
    await exit.promise
    expect(lines).toEqual(['err1', 'err2'])
  })

  it('emits trailing line without newline on exit', async () => {
    const lines: string[] = []
    const exit = waitForExit()
    const lifecycle = new ChildProcessLifecycle({
      binary: SH,
      args: ['-c', 'printf "no-newline"'],
      spawnGraceMs: 50,
      onStdout: (line) => lines.push(line),
      onExit: (reason, code) => exit.resolve({ reason, code })
    })
    lifecycle.start()
    await exit.promise
    expect(lines).toEqual(['no-newline'])
  })

  it('isRunning reflects state across start/stop', async () => {
    const exit = waitForExit()
    const lifecycle = new ChildProcessLifecycle({
      binary: SH,
      args: ['-c', 'sleep 10'],
      onExit: (reason, code) => exit.resolve({ reason, code })
    })
    expect(lifecycle.isRunning()).toBe(false)
    lifecycle.start()
    expect(lifecycle.isRunning()).toBe(true)
    lifecycle.stop()
    expect(lifecycle.isRunning()).toBe(false)
    await exit.promise
  })

  it('stop signals the whole process group (kills forked helpers)', async () => {
    // Shell script forks a `sleep` helper in its own background, prints the
    // helper's PID, then waits. If stop() only signals the shell's PID, the
    // helper would be orphaned (re-parented to PID 1) and survive.
    const exit = waitForExit()
    const helperPids: string[] = []
    const lifecycle = new ChildProcessLifecycle({
      binary: SH,
      args: ['-c', 'sleep 30 & echo $!; wait'],
      spawnGraceMs: 50,
      onStdout: (line) => helperPids.push(line.trim()),
      onExit: (reason, code) => exit.resolve({ reason, code })
    })
    lifecycle.start()
    // Wait for the shell to print the helper PID.
    await new Promise((r) => setTimeout(r, 100))
    lifecycle.stop()
    await exit.promise
    expect(helperPids).toHaveLength(1)
    const helperPid = Number(helperPids[0])
    expect(Number.isFinite(helperPid)).toBe(true)
    // Give the OS a moment to finalize exit state.
    await new Promise((r) => setTimeout(r, 50))
    // Signal 0 is the "does this PID exist" probe. If the helper survived,
    // process.kill(pid, 0) resolves without throwing; if it's gone, it throws ESRCH.
    let helperAlive = true
    try { process.kill(helperPid, 0) } catch { helperAlive = false }
    expect(helperAlive).toBe(false)
  })

  it('start is idempotent while running', async () => {
    const exits: ExitReason[] = []
    const exit = waitForExit()
    const lifecycle = new ChildProcessLifecycle({
      binary: SH,
      args: ['-c', 'sleep 10'],
      onExit: (reason) => { exits.push(reason); exit.resolve({ reason, code: null }) }
    })
    lifecycle.start()
    lifecycle.start()
    await new Promise((r) => setTimeout(r, 50))
    lifecycle.stop()
    await exit.promise
    expect(exits).toEqual(['killed'])
  })
})
