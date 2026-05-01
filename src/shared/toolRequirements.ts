export interface ToolRequirement {
  id: 'ultragrid' | 'natnetOsc'
  label: string
  requiredVersion: string
  downloadUrl: Partial<Record<NodeJS.Platform, string>>
  supportedPlatforms: NodeJS.Platform[]
}

export const REQUIRED_UG_VERSION = '1.10.3'
export const REQUIRED_NATNET_OSC_VERSION = '10.0.0'

export const ULTRAGRID_REQUIREMENT: ToolRequirement = {
  id: 'ultragrid',
  label: 'UltraGrid',
  requiredVersion: REQUIRED_UG_VERSION,
  downloadUrl: {
    darwin: `https://github.com/CESNET/UltraGrid/releases/tag/v${REQUIRED_UG_VERSION}`,
    win32:  `https://github.com/CESNET/UltraGrid/releases/tag/v${REQUIRED_UG_VERSION}`,
    linux:  `https://github.com/CESNET/UltraGrid/releases/tag/v${REQUIRED_UG_VERSION}`
  },
  supportedPlatforms: ['darwin', 'win32', 'linux']
}

export const NATNET_OSC_REQUIREMENT: ToolRequirement = {
  id: 'natnetOsc',
  label: 'NatNetFour2OSC',
  requiredVersion: REQUIRED_NATNET_OSC_VERSION,
  downloadUrl: {
    win32: `https://github.com/immersive-arts/NatNetFour2OSC/releases/tag/v${REQUIRED_NATNET_OSC_VERSION}`
  },
  supportedPlatforms: ['win32']
}

export const TOOL_REQUIREMENTS: ToolRequirement[] = [
  ULTRAGRID_REQUIREMENT,
  NATNET_OSC_REQUIREMENT
]

export type ToolStatusKind =
  | 'ok'
  | 'missing'
  | 'version-mismatch'
  | 'unsupported-os'
  | 'checking'
  | 'error'

export interface ToolStatus {
  id: ToolRequirement['id']
  label: string
  required: string
  installed: string | null
  path: string | null
  status: ToolStatusKind
  error?: string
}

export interface CompatStatus {
  ngVersion: string
  lastCheckedAt: number | null
  tools: ToolStatus[]
}

export function isAllOk(status: CompatStatus): boolean {
  return status.tools.every((t) => t.status === 'ok' || t.status === 'unsupported-os')
}
