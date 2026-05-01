import { app } from 'electron'
import { existsSync } from 'fs'
import { spawn } from 'child_process'
import {
  TOOL_REQUIREMENTS,
  ULTRAGRID_REQUIREMENT,
  NATNET_OSC_REQUIREMENT,
  type CompatStatus,
  type ToolStatus,
  type ToolRequirement
} from '../../shared/toolRequirements'
import { loadSettings, saveSettings } from '../persistence/settings'
import { resolveUgPath } from '../enumeration/spawnCli'

const VERSION_PROBE_TIMEOUT_MS = 5000

function platformSupported(req: ToolRequirement): boolean {
  return req.supportedPlatforms.includes(process.platform)
}

function probeVersion(binary: string, args: string[], regex: RegExp): Promise<string | null> {
  return new Promise((resolve) => {
    if (!existsSync(binary)) {
      resolve(null)
      return
    }
    let stdout = ''
    let stderr = ''
    let settled = false
    const finish = (val: string | null): void => {
      if (settled) return
      settled = true
      resolve(val)
    }
    let child
    try {
      child = spawn(binary, args)
    } catch {
      finish(null)
      return
    }
    const timer = setTimeout(() => {
      try { child.kill('SIGTERM') } catch {}
      finish(null)
    }, VERSION_PROBE_TIMEOUT_MS)
    child.stdout?.on('data', (c) => { stdout += c.toString() })
    child.stderr?.on('data', (c) => { stderr += c.toString() })
    child.on('error', () => { clearTimeout(timer); finish(null) })
    child.on('close', () => {
      clearTimeout(timer)
      const text = stdout + '\n' + stderr
      const m = text.match(regex)
      finish(m ? m[1] : null)
    })
  })
}

function probeUgVersion(path: string): Promise<string | null> {
  return probeVersion(path, ['--version'], /UltraGrid\s+(\d+\.\d+\.\d+)/i)
}

function probeNatNetVersion(path: string): Promise<string | null> {
  // NatNetFour2OSC supports --version; output format may be "NatNetFour2OSC v10.0.0" or similar.
  return probeVersion(path, ['--version'], /v?(\d+\.\d+\.\d+)/)
}

function makeStatus(
  req: ToolRequirement,
  installed: string | null,
  path: string | null,
  errorMsg?: string
): ToolStatus {
  const base = { id: req.id, label: req.label, required: req.requiredVersion }
  if (!platformSupported(req)) {
    return { ...base, installed: null, path: null, status: 'unsupported-os' }
  }
  if (errorMsg) {
    return { ...base, installed, path, status: 'error', error: errorMsg }
  }
  if (!path || !installed) {
    return { ...base, installed: null, path: null, status: 'missing' }
  }
  if (installed !== req.requiredVersion) {
    return { ...base, installed, path, status: 'version-mismatch' }
  }
  return { ...base, installed, path, status: 'ok' }
}

export async function checkUg(): Promise<ToolStatus> {
  if (!platformSupported(ULTRAGRID_REQUIREMENT)) {
    return makeStatus(ULTRAGRID_REQUIREMENT, null, null)
  }
  const path = resolveUgPath()
  if (!path) return makeStatus(ULTRAGRID_REQUIREMENT, null, null)
  const installed = await probeUgVersion(path)
  return makeStatus(ULTRAGRID_REQUIREMENT, installed, path)
}

export async function checkNatNetOsc(): Promise<ToolStatus> {
  if (!platformSupported(NATNET_OSC_REQUIREMENT)) {
    return makeStatus(NATNET_OSC_REQUIREMENT, null, null)
  }
  const settings = loadSettings()
  const path = settings.natnetOscPath || null
  if (!path || !existsSync(path)) {
    return makeStatus(NATNET_OSC_REQUIREMENT, null, null)
  }
  const installed = await probeNatNetVersion(path)
  return makeStatus(NATNET_OSC_REQUIREMENT, installed, path)
}

export async function runCompatCheck(): Promise<CompatStatus> {
  const tools = await Promise.all([checkUg(), checkNatNetOsc()])
  const status: CompatStatus = {
    ngVersion: app.getVersion(),
    lastCheckedAt: Date.now(),
    tools
  }
  // Persist marker so we know the check completed successfully.
  const s = loadSettings()
  saveSettings({
    ...s,
    appVersion: status.ngVersion,
    lastCompatCheckAt: status.lastCheckedAt
  })
  return status
}

export function expectedToolForId(id: string): ToolRequirement | null {
  return TOOL_REQUIREMENTS.find((r) => r.id === id) ?? null
}

export async function validateToolPath(
  id: ToolRequirement['id'],
  path: string
): Promise<ToolStatus> {
  const req = expectedToolForId(id)
  if (!req) {
    return {
      id: id as ToolRequirement['id'],
      label: id,
      required: '',
      installed: null,
      path: null,
      status: 'error',
      error: `unknown tool: ${id}`
    }
  }
  if (!existsSync(path)) {
    return makeStatus(req, null, null, `path does not exist: ${path}`)
  }
  const installed =
    id === 'ultragrid' ? await probeUgVersion(path) : await probeNatNetVersion(path)
  return makeStatus(req, installed, path)
}
