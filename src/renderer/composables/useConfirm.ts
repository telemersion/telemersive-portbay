import { reactive } from 'vue'

interface ConfirmState {
  open: boolean
  message: string
  resolve: ((value: boolean) => void) | null
}

const state = reactive<ConfirmState>({
  open: false,
  message: '',
  resolve: null
})

export function useConfirm() {
  function confirm(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      state.message = message
      state.open = true
      state.resolve = resolve
    })
  }

  function respond(result: boolean): void {
    state.open = false
    state.resolve?.(result)
    state.resolve = null
  }

  return { state, confirm, respond }
}
