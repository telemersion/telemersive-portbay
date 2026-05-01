import { createRouter, createMemoryHistory } from 'vue-router'
import SessionView from './views/SessionView.vue'
import MatrixView from './views/MatrixView.vue'
import SettingsView from './views/SettingsView.vue'

export const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'session', component: SessionView },
    { path: '/matrix', name: 'matrix', component: MatrixView },
    { path: '/settings', name: 'settings', component: SettingsView }
  ]
})
