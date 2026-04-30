import { ref } from 'vue'

export function usePeerDetail() {
  const selectedPeerId = ref<string | null>(null)

  function selectPeer(peerId: string) {
    selectedPeerId.value = selectedPeerId.value === peerId ? null : peerId
  }

  function close() {
    selectedPeerId.value = null
  }

  return { selectedPeerId, selectPeer, close }
}
