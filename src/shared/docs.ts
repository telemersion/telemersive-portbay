// Documentation site links, shared by the main-process Help menu and the
// per-device help buttons in the panel headers.
//
// NOTE: the path segment is the repository name, which is still
// `telemersive-portbay` even though the application is called Telemersive
// Gateway. Renaming the repo would change this URL and break every link
// already published, so it stays until the repo itself is renamed.
export const DOCS_URL = 'https://telemersion.github.io/telemersive-portbay/'

/**
 * Docs page for a device type, keyed by the `loaded` discriminator.
 * Unknown types fall back to the general device page rather than 404.
 */
const DEVICE_DOCS: Record<string, string> = {
  '1': 'devices/osc/',
  '2': 'devices/ultragrid/',
  '3': 'devices/mocap/#mocap-natnetfour2osc',
  '4': 'devices/stage-control/',
  '5': 'devices/mocap/#motive-bridge'
}

export function deviceDocsUrl(loaded: string): string {
  return DOCS_URL + (DEVICE_DOCS[loaded] ?? 'guide/devices/')
}
