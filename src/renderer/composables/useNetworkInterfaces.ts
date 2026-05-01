import { ref } from 'vue'

export interface NetInterface {
  name: string
  address: string
  family: string
}

const interfaces = ref<NetInterface[]>([])
const loaded = ref(false)
let loading: Promise<void> | null = null

async function load(): Promise<void> {
  if (loaded.value) return
  if (loading) return loading
  loading = (async () => {
    try {
      const list = await window.api.invoke('net:interfaces')
      interfaces.value = Array.isArray(list) ? list : []
    } finally {
      loaded.value = true
      loading = null
    }
  })()
  return loading
}

export async function refreshNetworkInterfaces(): Promise<void> {
  loaded.value = false
  await load()
}

export function useNetworkInterfaces() {
  if (!loaded.value && !loading) load()
  return { interfaces, loaded }
}

// Pick the interface whose IPv4 address matches `localIP` (same NIC the bus is
// using). Falls back to the first non-loopback interface, then null. Returns
// the interface name (e.g. "en0") suitable for use as a default selection.
export function bestGuessInterfaceName(localIP: string, list: NetInterface[]): string | null {
  if (!list.length) return null
  const exact = list.find((i) => i.address === localIP)
  if (exact) return exact.name
  return list[0].name
}
