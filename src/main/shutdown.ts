import type { TBusClient } from './busClient'
import type { DeviceRouter } from './deviceRouter'
import { saveRack } from './persistence/rack'

export function performShutdown(
  bus: TBusClient,
  deviceRouter: DeviceRouter | null,
  publishedTopics: string[]
): void {
  if (deviceRouter) {
    deviceRouter.destroyAll()
  }

  for (const topic of publishedTopics) {
    try {
      bus.publish(1, topic, '')
    } catch {}
  }

  try { bus.leave() } catch {}
  try { bus.disconnect() } catch {}
}
