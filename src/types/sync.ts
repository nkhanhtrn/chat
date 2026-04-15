/** Overall sync status */
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error'

/** Conflict data passed to UI for resolution */
export interface ConflictData {
  localChatCount: number
  cloudChatCount: number
  localChats: unknown[]
  cloudChats: unknown[]
}

/** Sync state for download-all operations */
export interface SyncState {
  isSyncing: boolean
  syncStatus: SyncStatus | null
  syncMessage: string
}
