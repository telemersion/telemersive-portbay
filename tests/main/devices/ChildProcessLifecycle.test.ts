import { describe, it, expect } from 'vitest'
import { ChildProcessLifecycle, type ExitReason } from '../../../src/main/devices/ChildProcessLifecycle'

// Use the running Node binary — always available regardless of platform.
const NODE = process.execPath

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
      binary: NODE,
      args: ['-e', 'process.exit(2)'],
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
      binary: NODE,
      args: ['-e', 'setTimeout(() => process.exit(7), 300)'],
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
      binary: NODE,
      args: ['-e', 'setTimeout(() => {}, 10000)'],
      spawnGraceMs: 100,
      onExit: (reason, code) => exit.resolve({ reason, code })
    })
    lifecycle.start()
    await new Promise((r) => setTimeout(r, 150))
    lifecycle.stop()
    const { reason } = await exit.promise
    expect(reason).toBe('killed')
  })

  it('splits stdout into lines', async () => {
    const lines: string[] = []
    const exit = waitForExit()
    const lifecycle = new ChildProcessLifecycle({
      binary: NODE,
      args: ['-e', 'process.stdout.write("one\\ntwo\\nthree\\n")'],
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
      binary: NODE,
      args: ['-e', 'process.stderr.write("err1\\nerr2\\n")'],
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
      binary: NODE,
      args: ['-e', 'process.stdout.write("no-newline")'],
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
      binary: NODE,
      args: ['-e', 'setTimeout(() => {}, 10000)'],
      onExit: (reason, code) => exit.resolve({ reason, code })
    })
    expect(lifecycle.isRunning()).toBe(false)
    lifecycle.start()
    expect(lifecycle.isRunning()).toBe(true)
    lifecycle.stop()
    expect(lifecycle.isRunning()).toBe(false)
    await exit.promise
  })

  it('start is idempotent while running', async () => {
    const exits: ExitReason[] = []
    const exit = waitForExit()
    const lifecycle = new ChildProcessLifecycle({
      binary: NODE,
      args: ['-e', 'setTimeout(() => {}, 10000)'],
      onExit: (reason) => { exits.push(reason); exit.resolve({ reason, code: null }) }
    })
    lifecycle.start()
    lifecycle.start()
    await new Promise((r) => setTimeout(r, 50))
    lifecycle.stop()
    await exit.promise
    expect(exits).toEqual(['killed'])
  })

  // POSIX only: signal trapping and process-group kill rely on UNIX semantics.
  const describeIfPosix = process.platform === 'win32' ? describe.skip : describe

  describeIfPosix('POSIX-only', () => {
    const SH = '/bin/sh'

    it('stop kills immediately even when SIGTERM would be trapped', async () => {
      const exit = waitForExit()
      const lifecycle = new ChildProcessLifecycle({
        binary: SH,
        args: ['-c', 'trap "" TERM; sleep 10'],
        onExit: (reason) => exit.resolve({ reason, code: null })
      })
      lifecycle.start()
      await new Promise((r) => setTimeout(r, 50))
      const stopStarted = Date.now()
      lifecycle.stop()
      await exit.promise
      const killLatency = Date.now() - stopStarted
      expect(killLatency).toBeLessThan(500)
    })

    it('stop signals the whole process group (kills forked helpers)', async () => {
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
      await new Promise((r) => setTimeout(r, 100))
      lifecycle.stop()
      await exit.promise
      expect(helperPids).toHaveLength(1)
      const helperPid = Number(helperPids[0])
      expect(Number.isFinite(helperPid)).toBe(true)
      await new Promise((r) => setTimeout(r, 50))
      let helperAlive = true
      try { process.kill(helperPid, 0) } catch { helperAlive = false }
      expect(helperAlive).toBe(false)
    })
  })
})
