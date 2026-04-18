import { computed } from 'vue'

export function useMqttBinding(
  getValue: () => string | undefined,
  topic: string
) {
  const value = computed(() => getValue() ?? '')

  function set(newValue: string | number): void {
    window.api.invoke('mqtt:publish', true, topic, String(newValue))
  }

  return { value, set }
}
