/// <reference types="vite/client" />

export {}

declare global {
  interface Window {
    api: {
      send: (channel: string, ...args: any[]) => void
      invoke: (channel: string, ...args: any[]) => Promise<any>
      on: (channel: string, callback: (...args: any[]) => void) => void
      removeAllListeners: (channel: string) => void
    }
  }
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
