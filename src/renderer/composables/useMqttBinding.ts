import { computed } from 'vue'

export function useMqttBinding(
  getValue: () => string | undefined,
  topic: string
) {
  const value = computed(() => getValue() ?? '')

  function set(newValue: string | number): void {
    window.api.invoke('mqtt:publish', { topic, value: String(newValue), retain: true })
  }

  return { value, set }
}
