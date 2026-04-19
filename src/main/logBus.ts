import type { BrowserWindow } from 'electron'

export type LogKind = 'sub' | 'unsub' | 'pub' | 'recv'

export interface LogEntry {
  seq: number
  ts: number
  kind: LogKind
  topic: string
  value?: string
  retained?: boolean
}

const BUFFER_CAP = 500
const buffer: LogEntry[] = []
let seq = 0
let sink: BrowserWindow | null = null

export function setLogSink(win: BrowserWindow | null): void {
  sink = win
}

export function logEvent(ev: Omit<LogEntry, 'seq' | 'ts'>): void {
  const entry: LogEntry = { seq: ++seq, ts: Date.now(), ...ev }
  buffer.push(entry)
  if (buffer.length > BUFFER_CAP) buffer.shift()
  if (sink && !sink.isDestroyed()) {
    sink.webContents.send('log:entry', entry)
  }
}

export function getLogBuffer(): LogEntry[] {
  return buffer.slice()
}

export function clearLogBuffer(): void {
  buffer.length = 0
}
