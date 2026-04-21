export class MonitorLogBuffer {
  private readonly lines: string[] = []
  constructor(private readonly capacity: number = 50) {}

  append(line: string): void {
    this.lines.push(line)
    while (this.lines.length > this.capacity) this.lines.shift()
  }

  snapshot(): string {
    return this.lines.join('\n')
  }

  replay(): readonly string[] {
    return this.lines
  }

  clear(): void {
    this.lines.length = 0
  }
}
