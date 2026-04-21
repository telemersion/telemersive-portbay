export type { Backend } from '../../shared/topics'
export {
  backendTopic,
  backendFallback,
  ugEnableTopic,
  applicableBackends,
  refreshTopic,
  backendFromRefreshTopic
} from '../../shared/topics'

export interface EnumerationResult {
  range: string
  count: number
}
