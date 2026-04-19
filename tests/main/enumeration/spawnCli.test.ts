import { describe, it, expect } from 'vitest'
import { spawnCli, SpawnCliError, resolveUgPath } from '../../../src/main/enumeration/spawnCli'

const SH = '/bin/sh'
const ECHO = '/bin/echo'
const SLEEP = '/bin/sleep'

describe('spawnCli', () => {
  it('resolves stdout for a successful command', async () => {
    const result = await spawnCli(ECHO, ['hello world'])
    expect(result.stdout.trim()).toBe('hello world')
    expect(result.stderr).toBe('')
    expect(result.exitCode).toBe(0)
  })

  it('resolves with non-zero exitCode without throwing', async () => {
    const result = await spawnCli(SH, ['-c', 'echo out; echo err 1>&2; exit 3'])
    expect(result.stdout.trim()).toBe('out')
    expect(result.stderr.trim()).toBe('err')
    expect(result.exitCode).toBe(3)
  })

  it('rejects when the binary does not exist', async () => {
    await expect(spawnCli('/nonexistent/bin/xyz', [])).rejects.toBeInstanceOf(SpawnCliError)
  })

  it('rejects with timeout when the command exceeds timeoutMs', async () => {
    await expect(spawnCli(SLEEP, ['5'], { timeoutMs: 100 })).rejects.toThrow(/timeout/)
  })
})

describe('resolveUgPath', () => {
  it('prefers UG_PATH env var when it points at an existing file', () => {
    const original = process.env.UG_PATH
    process.env.UG_PATH = ECHO
    try {
      expect(resolveUgPath()).toBe(ECHO)
    } finally {
      if (original === undefined) delete process.env.UG_PATH
      else process.env.UG_PATH = original
    }
  })

  it('returns null when UG_PATH is set but the file does not exist', () => {
    const original = process.env.UG_PATH
    process.env.UG_PATH = '/definitely/not/a/real/binary/uv'
    try {
      expect(resolveUgPath()).toBeNull()
    } finally {
      if (original === undefined) delete process.env.UG_PATH
      else process.env.UG_PATH = original
    }
  })

  it('returns null on win32 without UG_PATH (M2a stub)', () => {
    const original = process.env.UG_PATH
    delete process.env.UG_PATH
    const originalPlatform = process.platform
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })
    try {
      expect(resolveUgPath()).toBeNull()
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true })
      if (original !== undefined) process.env.UG_PATH = original
    }
  })
})
