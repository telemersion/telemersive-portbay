// Re-uses the EnumerationResult shape from ../topics.ts so parsers can feed
// the orchestrator directly without an extra adapter.
export interface ParseResult {
  range: string
  count: number
}

export const EMPTY_RANGE: ParseResult = { range: '0', count: 0 }
export const DEFAULT_RANGE: ParseResult = { range: '-default-', count: 0 }
