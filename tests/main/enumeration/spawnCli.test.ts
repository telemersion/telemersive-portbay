import { describe, it, expect, vi } from 'vitest'
import { existsSync } from 'fs'
import { spawnCli, SpawnCliError, resolveUgPath } from '../../../src/main/enumeration/spawnCli'

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return { ...actual, existsSync: vi.fn(actual.existsSync) }
})

// Use the Node binary itself so these tests don't depend on Unix-only paths
// like /bin/echo, /bin/sh, /bin/sleep — Node is guaranteed to exist wherever
// vitest runs, including Windows.
const NODE = process.execPath

describe('spawnCli', () => {
  it('resolves stdout for a successful command', async () => {
    const result = await spawnCli(NODE, ['-e', "process.stdout.write('hello world')"])
    expect(result.stdout.trim()).toBe('hello world')
    expect(result.stderr).toBe('')
    expect(result.exitCode).toBe(0)
  })

  it('resolves with non-zero exitCode without throwing', async () => {
    const result = await spawnCli(NODE, [
      '-e',
      "process.stdout.write('out\\n'); process.stderr.write('err\\n'); process.exit(3)"
    ])
    expect(result.stdout.trim()).toBe('out')
    expect(result.stderr.trim()).toBe('err')
    expect(result.exitCode).toBe(3)
  })

  it('rejects when the binary does not exist', async () => {
    await expect(spawnCli('/nonexistent/bin/xyz', [])).rejects.toBeInstanceOf(SpawnCliError)
  })

  it('rejects with timeout when the command exceeds timeoutMs', async () => {
    await expect(
      spawnCli(NODE, ['-e', 'setTimeout(() => {}, 5000)'], { timeoutMs: 100 })
    ).rejects.toThrow(/timeout/)
  })
})

describe('resolveUgPath', () => {
  it('prefers UG_PATH env var when it points at an existing file', () => {
    const original = process.env.UG_PATH
    process.env.UG_PATH = NODE
    try {
      expect(resolveUgPath()).toBe(NODE)
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

  it('returns null on win32 when no UV install can be found', () => {
    const original = process.env.UG_PATH
    delete process.env.UG_PATH
    const originalPlatform = process.platform
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })
    // Don't depend on whether this machine actually has UltraGrid installed
    // under Program Files or vendored — force the "nothing found" path.
    const mockedExists = vi.mocked(existsSync)
    const realImpl = mockedExists.getMockImplementation()
    mockedExists.mockReturnValue(false)
    try {
      expect(resolveUgPath()).toBeNull()
    } finally {
      mockedExists.mockImplementation(realImpl!)
      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true })
      if (original !== undefined) process.env.UG_PATH = original
    }
  })
})
