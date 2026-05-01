import { createRouter, createMemoryHistory } from 'vue-router'
import SessionView from './views/SessionView.vue'
import MatrixView from './views/MatrixView.vue'
import SettingsView from './views/SettingsView.vue'
import { compatState } from './state/compat'
import { isAllOk } from '../shared/toolRequirements'
import { sessionState } from './state/session'

export const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'session', component: SessionView },
    { path: '/matrix', name: 'matrix', component: MatrixView },
    { path: '/settings', name: 'settings', component: SettingsView }
  ]
})

router.beforeEach((to) => {
  if (to.path === '/settings') return true
  // Hold all routes until the initial compat check has resolved.
  if (!compatState.status) return '/settings'
  if (!isAllOk(compatState.status)) return '/settings'
  if (to.path === '/matrix' && !sessionState.joined) return '/'
  return true
})
