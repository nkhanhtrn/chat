<template>
  <div
    v-if="window.displayState === 'open'"
    class="output-window"
    :class="{ maximized: isMaximized }"
    :style="windowStyle"
    @pointerdown="$emit('bring-to-front')"
  >
    <div class="window-header" @pointerdown="startDrag" @dblclick="toggleMaximize">
      <div class="window-title-area" @click.stop="onTitleClick">
        <InlineEdit
          ref="titleEditRef"
          :modelValue="window.title"
          editOnClick
          @save="(newTitle: string) => $emit('update:title', newTitle)"
        />
      </div>
      <div class="window-controls" @pointerdown.stop>
        <button v-if="window.type === 'tool' && window.code" class="control-btn" @click="$emit('promote', window)" title="Save as global tool">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
        <button v-if="window.type === 'tool' && window.code" class="control-btn" :class="{ 'revert-active': window.previousCode }" :disabled="!window.previousCode" @click="$emit('revert', window.id)" :title="window.previousCode ? 'Switch version' : 'No previous version'">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :style="window.isReverted ? 'transform: scaleX(-1)' : ''">
            <polyline points="1 4 1 10 7 10"></polyline>
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
          </svg>
        </button>
        <button v-if="window.type === 'tool' && window.code" class="control-btn" :class="{ active: showCode }" @click="toggleCodeView" title="View code">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="16 18 22 12 16 6"></polyline>
            <polyline points="8 6 2 12 8 18"></polyline>
          </svg>
        </button>
        <button class="control-btn" @click="$emit('clone', window)" title="Clone">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
        <button class="control-btn delete" @click="$emit('delete', window.id)" title="Delete">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
        <button class="control-btn close" @click="$emit('close')" title="Minimize">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>
    <template v-if="!isMaximized">
      <div class="resize-handle right" @pointerdown.stop="startResize('e', $event)"></div>
      <div class="resize-handle bottom" @pointerdown.stop="startResize('s', $event)"></div>
      <div class="resize-handle corner" @pointerdown.stop="startResize('se', $event)"></div>
    </template>
    <div class="window-body">
      <template v-if="window.type === 'tool' && window.code">
        <CodeDisplay v-if="showCode && !editingCode" :content="window.code" language="vue" @edit="startEdit" />
        <div v-else-if="showCode && editingCode" class="code-editor">
          <div class="editor-toolbar">
            <button class="toolbar-btn save" @click="handleSaveEdit" title="Save & re-render">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>Save</span>
            </button>
            <button class="toolbar-btn" @click="editingCode = false; editDraft = ''" title="Cancel">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <CodeEditor v-model="editDraft" language="vue" />
        </div>
        <div v-else :data-tool-scope="scopeId" class="tool-mount">
          <component :is="compiledComponent" v-if="compiledComponent" />
          <div v-else-if="compilerError || runtimeError" class="compile-error">
            <p>{{ runtimeError ? 'Runtime Error' : 'Compilation Error' }}</p>
            <pre>{{ runtimeError || compilerError }}</pre>
          </div>
          <div v-else class="window-placeholder">
            <p>Compiling...</p>
          </div>
        </div>
      </template>
      <CodeDisplay v-else-if="window.type === 'code' || window.type === 'html'" :content="window.content" :language="window.type === 'html' ? 'html' : 'javascript'" />
      <div v-else class="window-placeholder">
        <p>{{ window.type }} window</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch, onErrorCaptured } from 'vue'
import InlineEdit from '@/components/InlineEdit.vue'
import CodeDisplay from './CodeDisplay.vue'
import CodeEditor from './CodeEditor.vue'
import { useDynamicCompiler } from '@/composables/useDynamicCompiler'
import type { ProjectWindow } from '@/types/project'

const props = defineProps<{
  window: ProjectWindow
  topBoundary: number
}>()

const emit = defineEmits<{
  close: []
  minimize: []
  delete: [windowId: string]
  'update:position': [position: { x: number; y: number }]
  'update:size': [size: { width: number; height: number }]
  'update:title': [title: string]
  'update:code': [code: string]
  'bring-to-front': []
  clone: [window: ProjectWindow]
  promote: [window: ProjectWindow]
  revert: [windowId: string]
}>()

const showCode = ref(false)
const editingCode = ref(false)
const editDraft = ref('')

const titleEditRef = ref<InstanceType<typeof InlineEdit> | null>(null)
let clickTimer: ReturnType<typeof setTimeout> | null = null

const isMaximized = ref(false)
const savedGeometry = ref<{ x: number; y: number; width: number; height: number } | null>(null)

function onTitleClick() {
  if (clickTimer) return
  clickTimer = setTimeout(() => {
    titleEditRef.value?.startEditing()
    clickTimer = null
  }, 220)
}

function clearClickTimer() {
  if (clickTimer) {
    clearTimeout(clickTimer)
    clickTimer = null
  }
}

function toggleMaximize() {
  clearClickTimer()
  if (isMaximized.value) {
    if (savedGeometry.value) {
      emit('update:position', { x: savedGeometry.value.x, y: savedGeometry.value.y })
      emit('update:size', { width: savedGeometry.value.width, height: savedGeometry.value.height })
    }
    isMaximized.value = false
    savedGeometry.value = null
  } else {
    savedGeometry.value = {
      x: props.window.position.x,
      y: props.window.position.y,
      width: props.window.size.width,
      height: props.window.size.height,
    }
    isMaximized.value = true
  }
}

function toggleCodeView() {
  showCode.value = !showCode.value
  editingCode.value = false
  editDraft.value = ''
}

function startEdit() {
  editDraft.value = props.window.code ?? ''
  editingCode.value = true
}

function handleSaveEdit() {
  emit('update:code', editDraft.value)
  editingCode.value = false
  editDraft.value = ''
}

const runtimeError = ref<string | null>(null)

onErrorCaptured((err: any) => {
  if (props.window.type === 'tool') {
    runtimeError.value = err?.message || String(err)
    return false
  }
})

const compiler = props.window.type === 'tool' && props.window.code
  ? useDynamicCompiler({ projectId: props.window.sessionId, windowId: props.window.id })
  : null

const compiledComponent = computed(() => compiler?.compiledComponent.value ?? null)
const compilerError = computed(() => compiler?.error.value ?? null)
const scopeId = computed(() => compiler?.scopeId ?? '')

function handleDataUpdate(e: Event) {
  const { dataKey, windowId, data } = (e as CustomEvent).detail
  if (dataKey === props.window.sessionId && windowId === props.window.id && compiler) {
    compiler.pushState(data)
  }
}

onMounted(() => {
  if (props.window.type === 'tool' && props.window.code && compiler) {
    compiler.compile(props.window.code)
  }

  if (props.window.position.y < props.topBoundary) {
    emit('update:position', { ...props.window.position, y: props.topBoundary })
  }

  window.addEventListener('tool-data-updated', handleDataUpdate)
})

onUnmounted(() => {
  compiler?.cleanup()
  window.removeEventListener('tool-data-updated', handleDataUpdate)
})

watch(() => props.window.code, (newCode) => {
  runtimeError.value = null
  if (props.window.type === 'tool' && newCode && compiler) {
    compiler.compile(newCode)
  }
})

const windowStyle = computed(() => {
  if (isMaximized.value) {
    return {
      left: '0px',
      top: `${props.topBoundary}px`,
      width: '100%',
      height: `calc(100% - ${props.topBoundary}px)`,
      zIndex: props.window.zIndex,
    }
  }
  return {
    left: `${props.window.position.x}px`,
    top: `${props.window.position.y}px`,
    width: `${props.window.size.width}px`,
    height: `${props.window.size.height}px`,
    zIndex: props.window.zIndex,
  }
})

function startDrag(e: PointerEvent) {
  if (isMaximized.value) return
  const startX = e.clientX
  const startY = e.clientY
  const startPos = { ...props.window.position }

  function onMove(ev: PointerEvent) {
    emit('update:position', {
      x: startPos.x + (ev.clientX - startX),
      y: Math.max(props.topBoundary, startPos.y + (ev.clientY - startY)),
    })
  }

  function onUp() {
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerup', onUp)
  }

  document.addEventListener('pointermove', onMove)
  document.addEventListener('pointerup', onUp)
}

function startResize(direction: string, e: PointerEvent) {
  const startX = e.clientX
  const startY = e.clientY
  const startSize = { ...props.window.size }

  function onMove(ev: PointerEvent) {
    const newWidth = Math.max(200, startSize.width + (ev.clientX - startX))
    const newHeight = Math.max(100, startSize.height + (ev.clientY - startY))
    emit('update:size', { width: newWidth, height: newHeight })
  }

  function onUp() {
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerup', onUp)
  }

  document.addEventListener('pointermove', onMove)
  document.addEventListener('pointerup', onUp)
}
</script>

<style scoped>
.output-window { position: absolute; display: flex; flex-direction: column; background: var(--color-bg-page); border: 1px solid var(--color-border-base); box-shadow: 0 4px 20px var(--shadow-primary); min-width: 200px; min-height: 100px; }
.output-window.maximized { transition: left 0.2s ease, top 0.2s ease, width 0.2s ease, height 0.2s ease; }
.window-header { display: flex; align-items: center; justify-content: space-between; padding: 0.4rem 0.6rem; background: var(--color-bg-base); border-bottom: 1px solid var(--color-border-base); cursor: grab; user-select: none; flex-shrink: 0; touch-action: none; }
.window-header:active { cursor: grabbing; }
.window-title-area { flex: 1; min-width: 0; font-size: 0.8rem; font-family: system-ui, sans-serif; font-weight: 500; color: var(--color-text-base); }
.window-title-area :deep(.inline-edit-wrapper) { width: 100%; }
.window-title-area :deep(.inline-edit-text) { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.8rem; }
.window-title-area :deep(.inline-edit-input) { font-size: 0.8rem; width: 100%; padding: 2px 4px; }
.window-controls { display: flex; gap: 0.25rem; flex-shrink: 0; }
.control-btn { display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; padding: 0; background: none; border: none; color: var(--color-text-muted); cursor: pointer; transition: all 0.15s; }
.control-btn:hover { background: var(--color-bg-hover); color: var(--color-text-base); }
.control-btn.active { color: var(--color-primary, #6366f1); background: var(--color-primary-subtle, rgba(99, 102, 241, 0.1)); }
.control-btn.close:hover { background: var(--color-error-subtle, #fee2e2); color: var(--color-error, #ef4444); }
.control-btn.delete:hover { background: var(--color-error-subtle, #fee2e2); color: var(--color-error, #ef4444); }
.control-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.control-btn.revert-active { color: var(--color-primary); }
.resize-handle { position: absolute; touch-action: none; }
.resize-handle.right { top: 0; right: -3px; width: 6px; height: 100%; cursor: ew-resize; }
.resize-handle.bottom { bottom: -3px; left: 0; width: 100%; height: 6px; cursor: ns-resize; }
.resize-handle.corner { bottom: -3px; right: -3px; width: 12px; height: 12px; cursor: nwse-resize; }
.window-body { flex: 1; overflow: auto; position: relative; }
.window-placeholder { display: flex; align-items: center; justify-content: center; height: 100%; color: var(--color-text-muted); font-family: system-ui, sans-serif; font-size: 0.85rem; }
.tool-mount { height: 100%; overflow: hidden; }
.compile-error { padding: 0.75rem; color: var(--color-error, #ef4444); font-size: 0.8rem; }
.compile-error p { font-weight: 600; margin-bottom: 0.5rem; }
.compile-error pre { white-space: pre-wrap; word-break: break-word; font-size: 0.75rem; opacity: 0.8; }
.code-editor { display: flex; flex-direction: column; height: 100%; background: var(--color-bg-base); }
.editor-toolbar { display: flex; align-items: center; gap: 0.25rem; padding: 0.35rem 0.6rem; background: var(--color-bg-page); border-bottom: 1px solid var(--color-border-subtle); }
.toolbar-btn { display: flex; align-items: center; gap: 0.25rem; padding: 0.2rem 0.5rem; background: none; border: 1px solid var(--color-border-base); color: var(--color-text-muted); cursor: pointer; font-family: system-ui, sans-serif; font-size: 0.7rem; border-radius: 4px; transition: all 0.15s; }
.toolbar-btn:hover { background: var(--color-bg-hover); color: var(--color-text-base); }
.toolbar-btn.save { border-color: var(--color-primary, #6366f1); color: var(--color-primary, #6366f1); }
.toolbar-btn.save:hover { background: var(--color-primary, #6366f1); color: white; }
.editor-body { flex: 1; display: flex; overflow: hidden; }
.editor-body .line-numbers { flex-shrink: 0; padding: 0.75rem 0.5rem 0.75rem 0.6rem; text-align: right; color: var(--color-text-muted); opacity: 0.45; user-select: none; font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace; font-size: 0.8rem; line-height: 1.5; font-variant-numeric: tabular-nums; overflow: hidden; border-right: 1px solid var(--color-border-subtle); cursor: text; }
.editor-body .line-num { min-width: 1.5em; }
.editor-textarea { flex: 1; padding: 0.75rem; border: none; outline: none; resize: none; font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace; font-size: 0.8rem; line-height: 1.5; color: var(--color-text-base); background: transparent; }
</style>
