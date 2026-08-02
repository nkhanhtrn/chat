<template>
  <div class="settings-body">
    <div class="debug-toolbar">
      <button class="debug-icon-btn" @click="refresh" title="Refresh">&#x21bb;</button>
    </div>

    <!-- Browser & Environment -->
    <div class="setting-item setting-item-vertical">
      <label class="setting-label">Browser</label>
      <div class="debug-info-grid">
        <template v-for="(value, key) in browserInfo" :key="key">
          <span class="debug-info-key">{{ key }}</span>
          <span class="debug-info-val" :title="String(value)">{{ value }}</span>
        </template>
      </div>
    </div>

    <!-- Storage -->
    <div class="setting-item setting-item-vertical">
      <label class="setting-label">Storage</label>
      <div v-if="storageInfo" class="debug-info-grid">
        <span class="debug-info-key">localStorage</span>
        <span class="debug-info-val">{{ formatBytes(storageInfo.localStorageBytes) }} ({{ storageInfo.localStorageEntries }} keys)</span>
        <span class="debug-info-key">IndexedDB</span>
        <span class="debug-info-val">{{ storageInfo.indexedDBName }} v{{ storageInfo.indexedDBVersion }}</span>
        <template v-if="storageIndexedExpanded">
          <template v-for="store in storageInfo.indexedDBStores" :key="store.name">
            <span class="debug-info-key debug-info-sub">&#x2514; {{ store.name }}</span>
            <span class="debug-info-val">{{ store.count }} records</span>
          </template>
        </template>
        <span class="debug-info-key">Cache API</span>
        <span class="debug-info-val">{{ storageInfo.cacheStoreCount }} stores</span>
        <span class="debug-info-key">Quota used</span>
        <span class="debug-info-val">
          {{ formatBytes(storageInfo.quotaUsage) }} / {{ formatBytes(storageInfo.quotaLimit) }}
          <span v-if="storageInfo.quotaUsage && storageInfo.quotaLimit" class="debug-quota-pct">({{ (storageInfo.quotaUsage / storageInfo.quotaLimit * 100).toFixed(1) }}%)</span>
        </span>
      </div>
      <span v-else class="setting-hint">Loading…</span>
      <button v-if="storageInfo?.indexedDBStores.length" class="debug-expand-btn" @click="storageIndexedExpanded = !storageIndexedExpanded">
        {{ storageIndexedExpanded ? '− Collapse' : '+ ' + storageInfo.indexedDBStores.length + ' object stores' }}
      </button>
    </div>

    <!-- Cloud (Firestore + Storage) -->
    <div class="setting-item setting-item-vertical">
      <label class="setting-label">Cloud</label>
      <div v-if="firestoreInfo" class="debug-info-grid">
        <template v-if="firestoreInfo.error">
          <span class="debug-info-val" style="color: #dc2626;">{{ firestoreInfo.error }}</span>
        </template>
        <template v-else-if="!firestoreInfo.signedIn">
          <span class="debug-info-val">Not signed in</span>
        </template>
        <template v-else>
          <span class="debug-info-key">UID</span>
          <span class="debug-info-val" :title="firestoreInfo.uid ?? ''">{{ firestoreInfo.uid }}</span>
          <span class="debug-info-key">Firestore</span>
          <span class="debug-info-val">{{ formatBytes(firestoreInfo.totalBytes) }}</span>
          <template v-if="firestoreCollectionsExpanded">
            <template v-for="col in firestoreInfo.collections" :key="col.name">
              <span class="debug-info-key debug-info-sub">&#x2514; {{ col.name }}</span>
              <span class="debug-info-val">{{ col.count }} docs ({{ formatBytes(col.bytes) }})</span>
            </template>
          </template>
          <span class="debug-info-key">Files</span>
          <span class="debug-info-val">{{ cloudStorageInfo?.error ? '—' : formatBytes(cloudStorageInfo?.totalBytes ?? null) }}<template v-if="cloudStorageInfo && !cloudStorageInfo.error"> ({{ cloudStorageInfo.fileCount }} files)</template></span>
          <template v-if="cloudStorageExpanded && cloudStorageInfo && !cloudStorageInfo.error">
            <template v-for="f in cloudStorageInfo.files" :key="f.name">
              <span class="debug-info-key debug-info-sub">&#x2514; {{ f.name }}</span>
              <span class="debug-info-val">{{ formatBytes(f.bytes) }}</span>
            </template>
          </template>
        </template>
      </div>
      <span v-else class="setting-hint">Loading…</span>
      <div v-if="firestoreInfo?.signedIn && !firestoreInfo.error" class="debug-expand-row">
        <button v-if="firestoreInfo.collections.length" class="debug-expand-btn" @click="firestoreCollectionsExpanded = !firestoreCollectionsExpanded">
          {{ firestoreCollectionsExpanded ? '− Collapse' : '+ ' + firestoreInfo.collections.length + ' Firestore collections' }}
        </button>
        <button v-if="cloudStorageInfo && !cloudStorageInfo.error && cloudStorageInfo.fileCount" class="debug-expand-btn" @click="cloudStorageExpanded = !cloudStorageExpanded">
          {{ cloudStorageExpanded ? '− Collapse' : '+ ' + cloudStorageInfo.fileCount + ' storage files' }}
        </button>
      </div>
    </div>

    <!-- Console Log Capture -->
    <div class="setting-item setting-item-vertical">
      <div class="debug-section-header">
        <label class="setting-label">Console</label>
        <div class="debug-log-actions">
          <button :class="['toggle-button', { active: isCapturing }]" @click="toggleConsoleCapture">{{ isCapturing ? 'Stop' : 'Capture' }}</button>
          <button v-if="logBuffer.length" class="debug-icon-btn" @click="clearLogs" title="Clear">Clear</button>
        </div>
      </div>
      <div v-if="logBuffer.length" class="debug-log-list">
        <div v-for="(entry, i) in logBuffer" :key="i" :class="['debug-log-entry', `debug-log-${entry.level}`]">
          <span class="debug-log-time">{{ entry.time }}</span>
          <span class="debug-log-msg">{{ entry.message }}</span>
        </div>
      </div>
      <span v-else-if="isCapturing" class="setting-hint">Waiting for console output…</span>
      <span v-else class="setting-hint">Toggle capture to record console messages (last 300).</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useDebugInfo } from '@/composables/useDebugInfo'

const { logBuffer, isCapturing, startCapture, stopCapture, clearLogs, storageInfo, browserInfo, firestoreInfo, cloudStorageInfo, refresh, ensureLoaded } = useDebugInfo()
const storageIndexedExpanded = ref(false)
const firestoreCollectionsExpanded = ref(false)
const cloudStorageExpanded = ref(false)

function formatBytes(bytes: number | null): string {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function toggleConsoleCapture() {
  if (isCapturing.value) stopCapture()
  else startCapture()
}

onMounted(() => {
  ensureLoaded()
})
</script>

<style scoped>
.settings-body { padding: 0.25rem 0; }
.debug-toolbar { position: sticky; top: 0; z-index: 10; display: flex; justify-content: flex-end; margin-bottom: 0.5rem; padding-right: 2rem; background: var(--color-bg-elevated); }
.setting-item { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.setting-item-vertical { flex-direction: column; align-items: stretch; gap: 0.75rem; }
.setting-item + .setting-item { margin-top: 1.25rem; padding-top: 1.25rem; border-top: 1px solid var(--color-border-subtle); }
.setting-label { font-size: 0.95rem; color: var(--color-text-base); font-family: 'Georgia', serif; flex-shrink: 0; }
.setting-hint { font-size: 0.75rem; color: var(--color-text-muted); font-family: system-ui, -apple-system, sans-serif; margin-top: 0.25rem; }

.toggle-button { padding: 0.4rem 1rem; background: var(--color-bg-elevated); border: none; cursor: pointer; font-size: 0.9rem; color: var(--color-text-muted); font-family: system-ui, -apple-system, sans-serif; transition: all 0.15s ease; border-right: 1px solid var(--color-border-base); }
.toggle-button:last-child { border-right: none; }
.toggle-button:hover { background: var(--color-bg-hover); }
.toggle-button.active { background: var(--color-bg-active); color: var(--color-text-strong); }

.debug-section-header { display: flex; align-items: center; justify-content: space-between; }
.debug-log-actions { display: flex; align-items: center; gap: 0.5rem; }
.debug-icon-btn { padding: 0.2rem 0.5rem; background: var(--color-bg-elevated); border: 1px solid var(--color-border-base); border-radius: 4px; cursor: pointer; font-size: 0.9rem; color: var(--color-text-muted); transition: all 0.15s; }
.debug-icon-btn:hover { background: var(--color-bg-hover); color: var(--color-text-base); }

.debug-info-grid { display: grid; grid-template-columns: minmax(90px, auto) 1fr; gap: 0.15rem 1rem; font-size: 0.8rem; font-family: system-ui, -apple-system, sans-serif; }
.debug-info-key { color: var(--color-text-muted); white-space: nowrap; }
.debug-info-sub { padding-left: 0.75rem; }
.debug-info-val { color: var(--color-text-base); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.debug-quota-pct { color: var(--color-text-muted); margin-left: 0.25rem; }
.debug-expand-btn { align-self: flex-start; margin-top: 0.5rem; padding: 0.2rem 0.6rem; background: none; border: none; cursor: pointer; font-size: 0.75rem; font-family: system-ui, -apple-system, sans-serif; color: var(--color-text-muted); transition: color 0.15s; }
.debug-expand-btn:hover { color: var(--color-text-base); }
.debug-expand-row { display: flex; gap: 1rem; flex-wrap: wrap; margin-top: 0.5rem; }

.debug-log-list { max-height: 200px; overflow-y: auto; background: var(--color-bg-page); border: 1px solid var(--color-border-subtle); border-radius: 4px; padding: 0.5rem; font-family: monospace; font-size: 0.75rem; }
.debug-log-entry { display: flex; gap: 0.5rem; padding: 0.1rem 0; }
.debug-log-time { color: var(--color-text-muted); flex-shrink: 0; white-space: nowrap; }
.debug-log-msg { word-break: break-word; }
.debug-log-warn .debug-log-msg { color: #b45309; }
.debug-log-error .debug-log-msg { color: #dc2626; }
.debug-log-info .debug-log-msg { color: #2563eb; }
</style>
