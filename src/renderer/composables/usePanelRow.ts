import { ref, computed } from 'vue'

export interface PanelSlot {
  id: string          // unique: `${peerId}-${channelIndex}`
  peerId: string
  channelIndex: number
  pinned: boolean
}

function makeId(peerId: string, channelIndex: number): string {
  return `${peerId}-${channelIndex}`
}

export function usePanelRow() {
  const pinnedSlots = ref<PanelSlot[]>([])
  const floatingSlot = ref<PanelSlot | null>(null)

  const allSlots = computed<PanelSlot[]>(() => {
    return floatingSlot.value
      ? [...pinnedSlots.value, floatingSlot.value]
      : [...pinnedSlots.value]
  })

  const panelRowVisible = computed(() => allSlots.value.length > 0)

  const activeId = ref<string | null>(null)

  function selectCell(peerId: string, channelIndex: number) {
    const id = makeId(peerId, channelIndex)
    const alreadyPinned = pinnedSlots.value.find(s => s.id === id)
    if (alreadyPinned) {
      floatingSlot.value = null
      activeId.value = id
      return
    }
    floatingSlot.value = { id, peerId, channelIndex, pinned: false }
    activeId.value = id
  }

  function clearSelection() {
    floatingSlot.value = null
    activeId.value = null
  }

  function pinFloating() {
    if (!floatingSlot.value) return
    const slot: PanelSlot = { ...floatingSlot.value, pinned: true }
    pinnedSlots.value = [...pinnedSlots.value, slot]
    floatingSlot.value = null
  }

  function closePinned(id: string) {
    pinnedSlots.value = pinnedSlots.value.filter(s => s.id !== id)
  }

  function reorderPinned(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return
    const list = [...pinnedSlots.value]
    const [moved] = list.splice(fromIndex, 1)
    list.splice(toIndex, 0, moved)
    pinnedSlots.value = list
  }

  function activateSlot(id: string) {
    activeId.value = id
    if (pinnedSlots.value.find(s => s.id === id)) {
      floatingSlot.value = null
    }
  }

  function activateCell(peerId: string, channelIndex: number) {
    const id = makeId(peerId, channelIndex)
    activeId.value = id
    selectCell(peerId, channelIndex)
  }

  return {
    pinnedSlots,
    floatingSlot,
    allSlots,
    panelRowVisible,
    activeId,
    activateCell,
    activateSlot,
    clearSelection,
    pinFloating,
    closePinned,
    reorderPinned,
  }
}
