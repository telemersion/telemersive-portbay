import type { BrowserWindow } from 'electron'
import { pushCapped, type LogEntry } from '../shared/log'

export type { LogEntry, LogKind, LogSource } from '../shared/log'

type LogInput = Omit<LogEntry, 'seq' | 'ts' | 'source'> & { source?: LogEntry['source'] }

const buffer: LogEntry[] = []
let seq = 0
let sink: BrowserWindow | null = null

export function setLogSink(win: BrowserWindow | null): void {
  sink = win
}

export function logEvent(ev: LogInput): void {
  const entry: LogEntry = { seq: ++seq, ts: Date.now(), source: 'data', ...ev }
  pushCapped(buffer, entry)
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
