import { defineStore } from 'pinia'
import type { SyncStatus } from '@/types/sync'

export const useSyncStore = defineStore('sync', {
  state: () => ({
    isSyncing: false,
    syncStatus: null as SyncStatus | null,
    syncMessage: '',
  }),

  actions: {
    clearSyncStatus(): void {
      this.syncStatus = null
      this.syncMessage = ''
    },
  },
})
