import { createRouter, createMemoryHistory } from 'vue-router'
import ConnectView from './views/ConnectView.vue'
import RoomPickerView from './views/RoomPickerView.vue'
import MatrixView from './views/MatrixView.vue'

export const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', name: 'connect', component: ConnectView },
    { path: '/rooms', name: 'rooms', component: RoomPickerView },
    { path: '/matrix', name: 'matrix', component: MatrixView }
  ]
})
