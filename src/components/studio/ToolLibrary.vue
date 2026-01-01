<template>
  <div class="tool-library">
    <button class="library-trigger" @click="isOpen = !isOpen" title="Saved Tools">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
      </svg>
      <span v-if="tools.length" class="tool-count">{{ tools.length }}</span>
    </button>

    <Transition name="dropdown">
      <div
        v-if="isOpen"
        ref="dropdownRef"
        class="library-dropdown"
        :style="{ width: dropdownWidth + 'px', height: dropdownHeight + 'px' }"
      >
        <div class="dropdown-header">
          <span>{{ showRecycleBin ? 'Recycle Bin' : 'Tools' }}</span>
          <span class="shortcut-hint">Ctrl+Space</span>
          <button
            class="bin-toggle"
            :class="{ active: showRecycleBin }"
            @click="showRecycleBin = !showRecycleBin"
            :title="showRecycleBin ? 'Back to tools' : 'Recycle bin'"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            <span v-if="deletedTools.length" class="bin-count">{{ deletedTools.length }}</span>
          </button>
          <button class="close-btn" @click="isOpen = false">×</button>
        </div>

        <!-- Scope filter (only show when not in recycle bin) -->
        <div v-if="!showRecycleBin" class="scope-filter">
          <button
            :class="['scope-tab', { active: scopeFilter === 'global' }]"
            @click="scopeFilter = 'global'"
          >🌍 Global</button>
          <button
            :class="['scope-tab', { active: scopeFilter === 'session' }]"
            @click="scopeFilter = 'session'"
          >🔒 Session</button>
        </div>

        <div v-if="(showRecycleBin ? deletedTools : tools).length > 0" class="search-box">
          <input
            ref="searchInputRef"
            v-model="searchQuery"
            type="text"
            :placeholder="showRecycleBin ? 'Search deleted...' : 'Search tools...'"
            class="search-input"
            @keydown.esc="isOpen = false"
          />
        </div>

        <!-- Empty states -->
        <div v-if="!showRecycleBin && tools.length === 0" class="empty-state">
          <p>No tools saved yet</p>
          <p class="hint">Tools you create will appear here</p>
        </div>

        <div v-else-if="showRecycleBin && deletedTools.length === 0" class="empty-state">
          <p>Recycle bin is empty</p>
        </div>

        <div v-else-if="filteredTools.length === 0" class="empty-state">
          <p>No matches</p>
        </div>

        <!-- Tool list -->
        <div v-else class="tool-list">
          <!-- Flat view: filtered list or recycle bin -->
          <div
            v-for="tool in filteredTools"
            :key="tool.id"
            :class="['tool-item', { 'other-session': !showRecycleBin && isToolFromOtherSession(tool) }]"
            @click="!showRecycleBin && !isToolFromOtherSession(tool) && openTool(tool)"
          >
            <span class="tool-emoji">{{ tool.emoji || '🔧' }}</span>
            <div class="tool-info">
              <span class="tool-name">{{ tool.name }}</span>
              <span class="tool-meta">
                <span v-if="!showRecycleBin" :class="['scope-badge', getScopeBadge(tool).class]">
                  {{ getScopeBadge(tool).icon }} {{ getScopeBadge(tool).label }}
                </span>
                <span class="tool-date">{{ formatDate(showRecycleBin ? tool.deletedAt : tool.updatedAt) }}</span>
              </span>
            </div>
            <!-- Normal tools: delete and scope toggle buttons -->
            <template v-if="!showRecycleBin">
              <!-- Other session tools: clone only -->
              <template v-if="isToolFromOtherSession(tool)">
                <button class="action-btn clone-btn" @click.stop="cloneTool(tool)" title="Clone to current session">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                </button>
              </template>
              <!-- Current session/global tools: promote/demote/delete -->
              <template v-else>
                <button
                  v-if="tool.scope === 'session' && tool.sessionId === activeSessionId"
                  class="action-btn promote-btn"
                  @click.stop="promoteToGlobal(tool.id)"
                  title="Promote to global"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 19V5M5 12l7-7 7 7"/>
                  </svg>
                </button>
                <button
                  v-if="tool.scope === 'global' || !tool.scope"
                  class="action-btn demote-btn"
                  @click.stop="demoteToSession(tool.id)"
                  title="Make session-only"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 5v14M19 12l-7 7-7-7"/>
                  </svg>
                </button>
                <button class="action-btn delete-btn" @click.stop="deleteTool(tool.id)" title="Move to recycle bin">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                </button>
              </template>
            </template>
            <!-- Recycle bin: restore and permanent delete -->
            <template v-else>
              <button class="action-btn restore-btn" @click.stop="restoreTool(tool.id)" title="Restore">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                  <path d="M3 3v5h5"/>
                </svg>
              </button>
              <button class="action-btn perm-delete-btn" @click.stop="permDeleteTool(tool.id)" title="Delete permanently">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </template>
          </div>
        </div>

        <!-- Empty bin button -->
        <div v-if="showRecycleBin && deletedTools.length > 0" class="bin-actions">
          <button class="empty-bin-btn" @click="emptyBin">Empty Recycle Bin</button>
        </div>

        <!-- Resize handle -->
        <div
          class="resize-handle"
          @mousedown.prevent="startResize"
        ></div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import {
  getAllTools,
  getDeletedTools,
  deleteTool as deleteToolFromDB,
  restoreTool as restoreToolFromDB,
  permanentlyDeleteTool,
  emptyRecycleBin,
  syncToolsFromCloud,
  updateToolScope
} from '../../services/indexedDB.js'
import { useStudioSessions } from '../../composables/studio/useStudioSessions.js'

const emit = defineEmits(['open-tool'])

const { activeSessionId } = useStudioSessions()

const isOpen = ref(false)
const tools = ref([])
const deletedTools = ref([])
const searchQuery = ref('')
const dropdownRef = ref(null)
const searchInputRef = ref(null)
const showRecycleBin = ref(false)
const scopeFilter = ref('global') // 'global', 'session'

// Dropdown size (resizeable) - load from localStorage
const STORAGE_KEY = 'tool-library-size'
const DEFAULT_WIDTH = 280
const DEFAULT_HEIGHT = 400

const dropdownWidth = ref(DEFAULT_WIDTH)
const dropdownHeight = ref(DEFAULT_HEIGHT)
const isResizing = ref(false)
const resizeStart = ref({ x: 0, y: 0, width: 0, height: 0 })

// Load saved size on mount
function loadSavedSize() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const { width, height } = JSON.parse(saved)
      dropdownWidth.value = width
      dropdownHeight.value = height
    }
  } catch (e) {
    console.warn('Failed to load tool library size from localStorage:', e)
  }
}

// Save size to localStorage
function saveSize() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      width: dropdownWidth.value,
      height: dropdownHeight.value
    }))
  } catch (e) {
    console.warn('Failed to save tool library size to localStorage:', e)
  }
}

function startResize(e) {
  isResizing.value = true
  resizeStart.value = {
    x: e.clientX,
    y: e.clientY,
    width: dropdownWidth.value,
    height: dropdownHeight.value
  }
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
}

function onResize(e) {
  if (!isResizing.value) return
  const dx = e.clientX - resizeStart.value.x
  const dy = e.clientY - resizeStart.value.y

  // Minimum dimensions (invert dx for bottom-left resize)
  dropdownWidth.value = Math.max(200, resizeStart.value.width - dx)
  dropdownHeight.value = Math.max(200, resizeStart.value.height + dy)
}

function stopResize() {
  isResizing.value = false
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
  saveSize()
}

const filteredTools = computed(() => {
  let list = showRecycleBin.value ? deletedTools.value : tools.value

  // Apply scope filter (whether searching or not)
  if (!showRecycleBin.value) {
    if (scopeFilter.value === 'global') {
      // Global filter: show all tools (global + all sessions) when searching
      // When not searching, show only global tools
      if (!searchQuery.value.trim()) {
        list = list.filter(t => t.scope === 'global' || !t.scope)
      }
      // When searching, keep all tools (no filtering)
    } else if (scopeFilter.value === 'session') {
      // Session filter: always only show current session tools
      list = list.filter(t => t.scope === 'session' && t.sessionId === activeSessionId.value)
    }
  }

  // Apply search query
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    return list.filter(t =>
      t.name?.toLowerCase().includes(q) ||
      t.sourcePrompt?.toLowerCase().includes(q)
    )
  }

  return list
})

let hasInitialSync = false

async function loadTools() {
  // Sync from cloud on first load
  if (!hasInitialSync) {
    hasInitialSync = true
    await syncToolsFromCloud().catch(err => console.error('Cloud sync failed:', err))
  }

  tools.value = await getAllTools()
  tools.value.sort((a, b) => b.updatedAt - a.updatedAt)
  deletedTools.value = await getDeletedTools()
}

// Keyboard shortcut: Ctrl+Space to toggle
function handleKeydown(e) {
  if (e.ctrlKey && e.code === 'Space') {
    e.preventDefault()
    toggleOpen()
  }
}

async function toggleOpen() {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    await loadTools()
    await nextTick()
    searchInputRef.value?.focus()
  }
}

// Close on click outside
function handleClickOutside(e) {
  if (isOpen.value && dropdownRef.value && !dropdownRef.value.contains(e.target)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  document.addEventListener('mousedown', handleClickOutside)
  loadTools()
  loadSavedSize()
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('mousedown', handleClickOutside)
})

function openTool(tool) {
  emit('open-tool', {
    type: 'tool',
    title: tool.name,
    content: { id: tool.id, code: tool.code, type: tool.type, name: tool.name, emoji: tool.emoji }
  })
  isOpen.value = false
}

async function deleteTool(id) {
  await deleteToolFromDB(id)
  await loadTools()
}

async function restoreTool(id) {
  await restoreToolFromDB(id)
  await loadTools()
}

async function permDeleteTool(id) {
  await permanentlyDeleteTool(id)
  await loadTools()
}

async function emptyBin() {
  if (deletedTools.value.length === 0) return
  await emptyRecycleBin()
  await loadTools()
}

function formatDate(timestamp) {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date

  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return date.toLocaleDateString()
}

async function promoteToGlobal(id) {
  await updateToolScope(id, 'global')
  await loadTools()
}

async function demoteToSession(id) {
  await updateToolScope(id, 'session', activeSessionId.value)
  await loadTools()
}

function getScopeBadge(tool) {
  if (tool.scope === 'session') {
    return { label: 'Session', icon: '🔒', class: 'session-badge' }
  }
  return { label: 'Global', icon: '🌍', class: 'global-badge' }
}

function isToolFromOtherSession(tool) {
  return tool.scope === 'session' && tool.sessionId !== activeSessionId.value
}

async function cloneTool(tool) {
  // Create a copy of the tool, preserving its scope
  const { saveTool, getAllTools } = await import('../../services/indexedDB.js')

  // Determine scope filter for name uniqueness check
  const isGlobalScope = !tool.scope || tool.scope === 'global'

  // Get existing tools to find a unique name
  const allTools = await getAllTools()
  const toolsForScopeCheck = isGlobalScope
    ? allTools.filter(t => !t.scope || t.scope === 'global')
    : allTools.filter(t => t.scope === 'session' && t.sessionId === tool.sessionId)

  // Find a unique name by appending (Copy), (Copy 2), etc.
  let cloneName = `${tool.name} (Copy)`
  let counter = 2
  while (toolsForScopeCheck.some(t => t.name === cloneName)) {
    cloneName = `${tool.name} (Copy ${counter})`
    counter++
  }

  // Create the clone with the unique name and NO id (so saveTool creates new)
  const clonedTool = {
    name: cloneName,
    emoji: tool.emoji,
    type: tool.type,
    code: tool.code,
    sourcePrompt: tool.sourcePrompt,
    scope: isGlobalScope ? 'global' : 'session',
    sessionId: isGlobalScope ? undefined : tool.sessionId
    // Note: NO id field - saveTool will create a new one
  }

  await saveTool(clonedTool)
  await loadTools()
}

defineExpose({ loadTools, toggleOpen })
</script>

<style scoped>
.tool-library {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 9999;
}

.library-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  border: 1px solid var(--color-border-base);
  background: var(--color-bg-base);
  color: var(--color-text-muted);
  cursor: pointer;
  position: relative;
  transition: all 0.15s;
}

.library-trigger:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-base);
}

.tool-count {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--color-primary);
  color: white;
  font-size: 11px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.library-dropdown {
  position: absolute;
  top: 48px;
  right: 0;
  min-width: 200px;
  min-height: 200px;
  background: var(--color-bg-base);
  border: 1px solid var(--color-border-base);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  z-index: 9999;
  display: flex;
  flex-direction: column;
}

.dropdown-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border-subtle);
  font-weight: 500;
  color: var(--color-text-base);
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.close-btn:hover {
  color: var(--color-text-base);
}

.shortcut-hint {
  font-size: 10px;
  color: var(--color-text-muted);
  background: var(--color-bg-hover);
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: auto;
  margin-right: 4px;
}

.bin-toggle {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: none;
  border: none;
  border-radius: 4px;
  color: var(--color-text-muted);
  cursor: pointer;
  margin-right: 4px;
}

.bin-toggle:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-base);
}

.bin-toggle.active {
  background: var(--color-bg-hover);
  color: var(--color-primary);
}

.bin-count {
  position: absolute;
  top: -2px;
  right: -2px;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  border-radius: 7px;
  background: var(--color-error, #ef4444);
  color: white;
  font-size: 9px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-box {
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border-subtle);
}

.search-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--color-border-input);
  border-radius: 6px;
  background: var(--color-bg-input);
  color: var(--color-text-base);
  font-size: 13px;
}

.search-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.search-input::placeholder {
  color: var(--color-text-muted);
}

.empty-state {
  padding: 24px 16px;
  text-align: center;
  color: var(--color-text-muted);
}

.empty-state p {
  margin: 0;
}

.empty-state .hint {
  font-size: 12px;
  margin-top: 4px;
  opacity: 0.7;
}

.tool-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.tool-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  cursor: pointer;
  transition: background 0.15s;
}

.tool-item:hover {
  background: var(--color-bg-hover);
}

.tool-emoji {
  font-size: 20px;
  flex-shrink: 0;
}

.tool-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tool-name {
  font-size: 14px;
  color: var(--color-text-base);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tool-date {
  font-size: 11px;
  color: var(--color-text-muted);
}

.action-btn {
  background: none;
  border: none;
  padding: 4px;
  color: var(--color-text-muted);
  cursor: pointer;
  opacity: 0;
  transition: all 0.15s;
  flex-shrink: 0;
}

.tool-item:hover .action-btn {
  opacity: 1;
}

.delete-btn:hover,
.perm-delete-btn:hover {
  color: var(--color-error, #ef4444);
}

.restore-btn:hover {
  color: var(--color-success, #22c55e);
}

.bin-actions {
  padding: 8px 12px;
  border-top: 1px solid var(--color-border-subtle);
}

.empty-bin-btn {
  width: 100%;
  padding: 8px;
  background: none;
  border: 1px solid var(--color-error, #ef4444);
  border-radius: 6px;
  color: var(--color-error, #ef4444);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.empty-bin-btn:hover {
  background: var(--color-error, #ef4444);
  color: white;
}

/* Scope filter tabs */
.scope-filter {
  display: flex;
  gap: 4px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border-subtle);
}

.scope-tab {
  flex: 1;
  padding: 6px 8px;
  background: none;
  border: 1px solid transparent;
  border-radius: 6px;
  font-size: 12px;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.scope-tab:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-base);
}

.scope-tab.active {
  background: var(--color-bg-hover);
  border-color: var(--color-border-subtle);
  color: var(--color-primary);
  font-weight: 500;
}

/* Tool sections */
.tool-section {
  border-bottom: 1px solid var(--color-border-subtle);
}

.tool-section:last-child {
  border-bottom: none;
}

.section-header {
  padding: 8px 16px 4px;
  background: var(--color-bg-muted);
}

.section-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.tool-section.archived .section-title {
  opacity: 0.7;
}

/* Tool meta (contains badge and date) */
.tool-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
}

/* Scope badges */
.scope-badge {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
}

.scope-badge.global-badge {
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
}

.scope-badge.session-badge {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}

/* Promote/demote buttons */
.promote-btn:hover {
  color: var(--color-success, #22c55e);
}

.demote-btn:hover {
  color: var(--color-primary);
}

/* Clone button */
.clone-btn:hover {
  color: var(--color-primary);
}

/* Other session tool items */
.tool-item.other-session {
  opacity: 0.6;
  cursor: default;
}

.tool-item.other-session:hover {
  opacity: 0.8;
}

/* Dropdown animation */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* Resize handle */
.resize-handle {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 16px;
  height: 16px;
  cursor: nesw-resize;
  background: linear-gradient(45deg, transparent 50%, var(--color-border-base) 50%);
  border-radius: 0 0 0 8px;
}

.resize-handle:hover {
  background: linear-gradient(45deg, transparent 50%, var(--color-primary) 50%);
}
</style>
