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
  { id: 'session', label: 'Session', icon: 'plug',   kind: 'route', target: '/',       position: 'top' },
  { id: 'matrix',  label: 'Matrix',  icon: 'grid',   kind: 'route', target: '/matrix', position: 'top' },
  { id: 'log',     label: 'Activity log', icon: 'list', kind: 'panel', target: 'log',  position: 'top' }
]

export const ICONS: Record<string, string> = {
  plug: 'M7 3v5M17 3v5M5 8h14v3a7 7 0 0 1-14 0zM12 18v3',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  list: 'M4 6h16M4 12h16M4 18h10'
}
