import { describe, it, expect } from 'vitest'
import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { resolve } from 'path'

// Integration test: verify every "accepted" codec in our mapping is still
// accepted by the live `uv` binary. Runs against vendor/ultragrid/active or
// $UG_PATH. Skipped automatically when neither is available.
//
// If this test starts failing after a UG upgrade, the codec acceptance map
// in src/main/devices/ultragrid/cliBuilder.ts needs to be revisited. Re-run
// scripts/probe-uv-codecs.sh for a human-readable diff and update the maps
// (and the docs/ug-codecs-<version>.txt report) together.

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

// Names here must match the strings our cliBuilder emits, NOT the Max umenu
// labels. In particular: index 1 is "JPEG" (not "MJPEG") and speex is absent.
const VIDEO_CODEC_NAMES = ['JPEG', 'H.264', 'H.265', 'J2K', 'AV1', 'VP8', 'VP9', 'HFYU', 'FFV1']
const AUDIO_CODEC_NAMES = ['OPUS', 'FLAC', 'AAC', 'MP3', 'G.722', 'u-law', 'A-law', 'PCM']

function runUvCollect(args: string[], timeoutMs = 3000): Promise<string> {
  return new Promise((resolveP, rejectP) => {
    const child = spawn(UV_BIN!, args)
    let combined = ''
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL') } catch { /* already gone */ }
    }, timeoutMs)
    child.stdout.on('data', (c) => { combined += c.toString() })
    child.stderr.on('data', (c) => { combined += c.toString() })
    child.on('error', (err) => { clearTimeout(timer); rejectP(err) })
    child.on('close', () => { clearTimeout(timer); resolveP(combined) })
  })
}

describeIfUv('UG codec acceptance (live `uv` binary)', () => {
  it.each(VIDEO_CODEC_NAMES)('accepts video codec %s via libavcodec:codec=%s:help', async (name) => {
    const out = await runUvCollect(['-c', `libavcodec:codec=${name}:help`])
    expect(out).not.toMatch(/Unable to find codec/)
  })

  it.each(AUDIO_CODEC_NAMES)('accepts audio codec %s via short spawn', async (name) => {
    const out = await runUvCollect([
      '-s', 'testcard',
      '--audio-codec', `${name}:bitrate=64000`,
      '-P', '11002:11002:11004:11004',
      '192.0.2.1'
    ])
    expect(out).not.toMatch(/Unable to find encoder for audio codec/)
    expect(out).toMatch(/Audio codec/)
  })

  it('confirms speex is rejected (reason we throw on index 2)', async () => {
    const out = await runUvCollect([
      '-s', 'testcard',
      '--audio-codec', 'speex:bitrate=64000',
      '-P', '11002:11002:11004:11004',
      '192.0.2.1'
    ])
    expect(out).toMatch(/Unable to find encoder for audio codec 'speex'/)
  })

  it('confirms MJPEG is rejected (reason we remap index 1 to JPEG)', async () => {
    const out = await runUvCollect(['-c', 'libavcodec:codec=MJPEG:help'])
    expect(out).toMatch(/Unable to find codec/)
  })
})
