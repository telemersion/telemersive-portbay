import { describe, it, expect, vi } from 'vitest'
import { isTransientNetworkError, handleUncaughtException } from '../../src/main/crashGuard'

const withCode = (code: string, msg = 'boom') => Object.assign(new Error(msg), { code })

describe('crashGuard', () => {
  it.each(['EPIPE', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'])('treats %s as transient', (code) => {
    expect(isTransientNetworkError(withCode(code))).toBe(true)
  })

  it('does not treat programming errors or unknown codes as transient', () => {
    expect(isTransientNetworkError(new TypeError('x is undefined'))).toBe(false)
    expect(isTransientNetworkError(withCode('ENOENT'))).toBe(false)
    expect(isTransientNetworkError(null)).toBe(false)
    expect(isTransientNetworkError('write EPIPE')).toBe(false)
  })

  it('swallows write EPIPE (issue #7) and reports it as transient', () => {
    const handlers = { onTransient: vi.fn(), fatal: vi.fn() }
    handleUncaughtException(withCode('EPIPE', 'write EPIPE'), handlers)
    expect(handlers.onTransient).toHaveBeenCalledOnce()
    expect(handlers.fatal).not.toHaveBeenCalled()
  })

  it('forwards everything else to fatal, wrapping non-Error throws', () => {
    const handlers = { onTransient: vi.fn(), fatal: vi.fn() }
    handleUncaughtException(new TypeError('bug'), handlers)
    handleUncaughtException('configuration incomplete', handlers)
    expect(handlers.onTransient).not.toHaveBeenCalled()
    expect(handlers.fatal).toHaveBeenCalledTimes(2)
    expect(handlers.fatal.mock.calls[1][0]).toBeInstanceOf(Error)
  })
})
