export type NavKind = 'route' | 'panel'
export type NavPosition = 'top' | 'bottom'

export interface NavItem {
  id: string
  label: string
  icon: string
  kind: NavKind
  target: string
  position: NavPosition
}

export const navItems: NavItem[] = [
  { id: 'session',  label: 'Session', icon: 'plug',   kind: 'route', target: '/',         position: 'top' },
  { id: 'matrix',   label: 'Matrix',  icon: 'grid',   kind: 'route', target: '/matrix',   position: 'top' },
  { id: 'log',      label: 'Activity log', icon: 'list', kind: 'panel', target: 'log',    position: 'top' },
  { id: 'settings', label: 'Settings', icon: 'gear',  kind: 'route', target: '/settings', position: 'bottom' }
]

export const ICONS: Record<string, string> = {
  plug: 'M7 3v5M17 3v5M5 8h14v3a7 7 0 0 1-14 0zM12 18v3',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  list: 'M4 6h16M4 12h16M4 18h10',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'
}
