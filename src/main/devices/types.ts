export interface DeviceHandler {
  readonly channelIndex: number
  readonly deviceType: number

  onTopicChanged(subpath: string, value: string): void

  publishDefaults(): void

  teardown(): string[]

  destroy(): void
}
