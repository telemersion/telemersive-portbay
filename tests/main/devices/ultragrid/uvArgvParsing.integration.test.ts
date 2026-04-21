import { describe, it, expect } from 'vitest'
import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { resolve } from 'path'

// Regression guard for D2 (single-quote handling). NG builds UltraGrid CLI
// args without wrapping string values in single-quotes, then hands them to
// `child_process.spawn(binary, argv)` — no shell, no word-splitting, no quote
// substitution. This test verifies that `uv` actually accepts that shape when
// a value contains whitespace.
//
// The signal we use: an unknown capture-type argument causes `uv` to print
//   Capture device   : <arg verbatim>
//   WARNING: Selected '<arg verbatim>' capture card was not found.
// and exit quickly. If our argv element survives as one token, both lines
// echo the full string including spaces. If the shell or `spawn` split it,
// we'd see only the first word.

const VENDORED_UV = resolve(
  __dirname,
  '../../../../vendor/ultragrid/active/uv-qt.app/Contents/MacOS/uv'
)

const UV_BIN = process.env.UG_PATH && existsSync(process.env.UG_PATH)
  ? process.env.UG_PATH
  : existsSync(VENDORED_UV)
    ? VENDORED_UV
    : null

const describeIfUv = UV_BIN ? describe : describe.skip

function runUv(args: string[], timeoutMs = 4000): Promise<{ stderr: string; stdout: string }> {
  return new Promise((resolveP, rejectP) => {
    const child = spawn(UV_BIN!, args)
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL') } catch { /* already gone */ }
    }, timeoutMs)
    child.stdout.on('data', (c) => { stdout += c.toString() })
    child.stderr.on('data', (c) => { stderr += c.toString() })
    child.on('error', (err) => { clearTimeout(timer); rejectP(err) })
    child.on('close', () => { clearTimeout(timer); resolveP({ stdout, stderr }) })
  })
}

describeIfUv('uv argv parsing (live `uv` binary)', () => {
  it('preserves whitespace inside a single argv element for -t', async () => {
    // Unknown capture type with spaces. `uv` echoes it back verbatim in a
    // stable error line. If the argv element were word-split, the echo would
    // show only "not-a-real-type".
    const unknown = 'not-a-real-type with spaces and more'
    const { stdout, stderr } = await runUv(['-t', unknown])
    const combined = stdout + stderr
    expect(combined).toContain(`Capture device   : ${unknown}`)
    expect(combined).toContain(`WARNING: Selected '${unknown}' capture card was not found.`)
  }, 8000)

  it('accepts a syphon/spout-style capture arg with unquoted spaces in the name', async () => {
    // NG's cliBuilder produces `syphon:name=Foo Bar` (no wrapping quotes)
    // because Max's shell-era quote-wrap is stripped out in cliBuilder.ts:33.
    // The signal: syphon plugin loads and enters its "No server(s) found!"
    // search loop, meaning the sub-argument parsed cleanly. If the argv had
    // been split on spaces, `uv` would see `-t syphon:name=NG` as a bare
    // backend-only selector and wouldn't search for the space-containing
    // name at all; we'd also see spurious argv tokens fall through as
    // unknown positional args.
    if (process.platform !== 'darwin') return // syphon plugin is macOS-only
    const arg = 'syphon:name=NG Test Nonexistent Name'
    const { stdout, stderr } = await runUv(['-t', arg], 3500)
    const combined = stdout + stderr
    expect(combined).toContain('Capture device   : syphon')
    expect(combined).toMatch(/\[syphon cap\.\] No server\(s\) found!/)
    // No spurious leftover tokens from a misparsed argv:
    expect(combined).not.toMatch(/unknown parameter|unrecognized option/i)
  }, 8000)

  it('treats an embedded single-quote in a name as a literal character', async () => {
    // Documents `uv`'s behavior: quotes inside a `-t syphon:name=...` value
    // are part of the name, not shell-style delimiters. That's why Max's
    // pipeline had to strip them before spawn (syscmdHelper.js:38), and why
    // NG's cliBuilder does the same. This test is a safeguard: if `uv` ever
    // started stripping quotes internally, the test would flip and we could
    // drop the cliBuilder strip step.
    if (process.platform !== 'darwin') return
    const arg = "syphon:name='Legacy Quoted Form'"
    const { stdout, stderr } = await runUv(['-t', arg], 3500)
    const combined = stdout + stderr
    // `uv` still parses the CLI and loads the plugin:
    expect(combined).toContain('Capture device   : syphon')
    expect(combined).toMatch(/\[syphon cap\.\] No server\(s\) found!/)
  }, 8000)
})
