import { systemPreferences, shell } from 'electron'

export type MediaKind = 'microphone' | 'camera'

// Electron's own status values, plus 'unknown' for the platforms where macOS
// TCC does not apply and the question is meaningless.
export type MediaAccessStatus =
  | 'not-determined'
  | 'granted'
  | 'denied'
  | 'restricted'
  | 'unknown'

const PRIVACY_PANE: Readonly<Record<MediaKind, string>> = {
  microphone: 'Privacy_Microphone',
  camera: 'Privacy_Camera'
}

/**
 * Current TCC state for `kind`, from this app's point of view.
 *
 * UltraGrid runs as a child process, so macOS attributes its hardware requests
 * to this app (the responsible process) and checks *this* bundle's record. That
 * makes the app-level status the right thing to read before spawning `uv`.
 */
export function mediaAccessStatus(kind: MediaKind): MediaAccessStatus {
  if (process.platform !== 'darwin') return 'unknown'
  return systemPreferences.getMediaAccessStatus(kind) as MediaAccessStatus
}

/**
 * Ask macOS for `kind` once, from the GUI app itself.
 *
 * The prompt has to come from a process the window server knows about. A
 * request raised by the `uv` child instead is attributed to this app anyway but
 * arrives without a foreground app to host the dialog, which is how the denial
 * ends up silent. Asking here puts the prompt on screen at a predictable moment
 * and records the grant under this bundle id — which is exactly the record the
 * child's later request is checked against.
 *
 * Returns immediately (no dialog) when the user has already answered.
 */
export async function requestMediaAccess(kind: MediaKind): Promise<boolean> {
  if (process.platform !== 'darwin') return true
  const status = mediaAccessStatus(kind)
  if (status === 'granted') return true
  if (status === 'denied' || status === 'restricted') return false
  try {
    return await systemPreferences.askForMediaAccess(kind)
  } catch (err) {
    console.warn(`[permissions] askForMediaAccess(${kind}) failed:`, err)
    return false
  }
}

/** Deep-link into the relevant System Settings pane so the user can flip it back on. */
export function openPrivacySettings(kind: MediaKind): Promise<void> {
  if (process.platform !== 'darwin') return Promise.resolve()
  return shell.openExternal(
    `x-apple.systempreferences:com.apple.preference.security?${PRIVACY_PANE[kind]}`
  )
}

/**
 * Ask for microphone and camera at startup, before any channel can spawn `uv`.
 *
 * Deliberately eager: the spawn path is synchronous, so there is no safe point
 * to await a prompt once a device is being enabled — and a device enabled
 * against a not-determined TCC record captures silence.
 */
export async function primeMediaAccess(): Promise<void> {
  if (process.platform !== 'darwin') return
  for (const kind of ['microphone', 'camera'] as const) {
    const granted = await requestMediaAccess(kind)
    if (!granted) {
      console.warn(
        `[permissions] ${kind} access ${mediaAccessStatus(kind)} — UltraGrid capture ` +
          `from this device type will be silent. System Settings › Privacy & Security › ` +
          `${kind === 'microphone' ? 'Microphone' : 'Camera'}.`
      )
    }
  }
}
