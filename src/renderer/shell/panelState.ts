import { reactive } from 'vue'

export const panelState = reactive<{ openPanelId: string | null }>({
  openPanelId: null
})

export function togglePanel(id: string): void {
  panelState.openPanelId = panelState.openPanelId === id ? null : id
}

export function closePanel(): void {
  panelState.openPanelId = null
}
