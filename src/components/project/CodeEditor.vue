<template>
  <div ref="editorContainer" class="cm-editor-wrap"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, shallowRef } from 'vue'
import { EditorState, StateEffect, StateField, RangeSetBuilder } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightActiveLine, drawSelection, rectangularSelection, highlightSpecialChars, ViewPlugin, Decoration, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { foldGutter, indentOnInput, bracketMatching, foldKeymap, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { searchKeymap, highlightSelectionMatches, SearchCursor, openSearchPanel } from '@codemirror/search'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { javascript } from '@codemirror/lang-javascript'
import { oneDark } from '@codemirror/theme-one-dark'

const setSearchQuery = StateEffect.define<string>()

const searchQueryField = StateField.define<string>({
  create: () => '',
  update: (value, tr) => {
    for (const e of tr.effects) {
      if (e.is(setSearchQuery)) return e.value
    }
    return value
  },
})

const matchDeco = Decoration.mark({ class: 'cm-customSearchMatch' })

const searchHighlighter = ViewPlugin.fromClass(class {
  decorations: DecorationSet = Decoration.none
  matchCount = 0

  update(update: ViewUpdate) {
    if (update.docChanged || update.transactions.some(tr => tr.effects.some(e => e.is(setSearchQuery)))) {
      this.build(update.view)
    }
  }

  build(view: EditorView) {
    const query = view.state.field(searchQueryField)
    if (!query) {
      this.decorations = Decoration.none
      this.matchCount = 0
      return
    }
    const builder = new RangeSetBuilder<Decoration>()
    let count = 0
    const cursor = new SearchCursor(view.state, query, 0)
    while (cursor.next().value) {
      builder.add(cursor.value.from, cursor.value.to, matchDeco)
      count++
    }
    this.decorations = builder.finish()
    this.matchCount = count
  }
}, {
  decorations: v => v.decorations,
})

const props = withDefaults(defineProps<{
  modelValue?: string
  readOnly?: boolean
  language?: 'vue' | 'html' | 'css' | 'javascript'
}>(), {
  modelValue: '',
  readOnly: false,
  language: 'vue',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const editorContainer = ref<HTMLElement>()
const view = shallowRef<EditorView>()
const isInternalUpdate = ref(false)

function getLanguageExtension() {
  switch (props.language) {
    case 'html': return html()
    case 'css': return css()
    case 'javascript': return javascript()
    case 'vue':
    default: return html()
  }
}

function getTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light'
  if (current === 'dark') return oneDark
  return []
}

function createState(doc: string): EditorState {
  const extensions = [
    searchQueryField,
    searchHighlighter,
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    foldGutter(),
    drawSelection(),
    indentOnInput(),
    bracketMatching(),
    highlightActiveLine(),
    rectangularSelection(),
    highlightSelectionMatches(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    keymap.of([
      ...defaultKeymap,
      ...historyKeymap,
      ...searchKeymap,
      ...foldKeymap,
      indentWithTab,
    ]),
    getLanguageExtension(),
    getTheme(),
    EditorView.lineWrapping,
    EditorView.updateListener.of((update) => {
      if (update.docChanged && !isInternalUpdate.value) {
        emit('update:modelValue', update.state.doc.toString())
      }
    }),
    EditorView.theme({
      '&': { height: '100%', fontSize: '0.8rem' },
      '.cm-scroller': { fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace", lineHeight: '1.5' },
      '.cm-gutters': { borderRight: '1px solid var(--color-border-subtle)' },
    }),
  ]

  if (props.readOnly) {
    extensions.push(EditorState.readOnly.of(true))
    extensions.push(EditorView.theme({
      '.cm-content': { cursor: 'default' },
      '.cm-cursor': { display: 'none' },
    }))
  }

  return EditorState.create({ doc, extensions })
}

function handleThemeChange() {
  if (!view.value) return
  const newState = createState(view.value.state.doc.toString())
  view.value.setState(newState)
}

let observer: MutationObserver | null = null

onMounted(() => {
  if (!editorContainer.value) return
  view.value = new EditorView({
    state: createState(props.modelValue),
    parent: editorContainer.value,
  })

  observer = new MutationObserver(() => {
    const newTheme = document.documentElement.getAttribute('data-theme')
    if (newTheme !== lastTheme) {
      lastTheme = newTheme
      handleThemeChange()
    }
  })
  let lastTheme = document.documentElement.getAttribute('data-theme')
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
})

onUnmounted(() => {
  observer?.disconnect()
  view.value?.destroy()
})

watch(() => props.modelValue, (newVal) => {
  if (!view.value) return
  const current = view.value.state.doc.toString()
  if (current !== newVal) {
    isInternalUpdate.value = true
    view.value.dispatch({
      changes: { from: 0, to: current.length, insert: newVal },
    })
    isInternalUpdate.value = false
  }
})

watch(() => props.readOnly, (newReadOnly) => {
  if (!view.value) return
  view.value.dispatch({
    effects: EditorState.readOnly.reconfigure.of(
      newReadOnly
        ? EditorState.readOnly.of(true)
        : []
    ),
  })
})

function setSearch(query: string) {
  if (!view.value) return
  view.value.dispatch({ effects: setSearchQuery.of(query) })
}

function getMatchCount(): number {
  if (!view.value) return 0
  const plugin = view.value.plugin(searchHighlighter)
  return plugin?.matchCount ?? 0
}

function findNext() {
  if (!view.value) return
  const query = view.value.state.field(searchQueryField)
  if (!query) return
  const cur = view.value.state.selection.main.to
  const cursor = new SearchCursor(view.value.state, query, cur + 1)
  let pos = cursor.next().value
  if (!pos) {
    const fromStart = new SearchCursor(view.value.state, query, 0)
    pos = fromStart.next().value
  }
  if (pos) {
    view.value.dispatch({ selection: { anchor: pos.from, head: pos.to }, scrollIntoView: true })
  }
}

function findPrev() {
  if (!view.value) return
  const query = view.value.state.field(searchQueryField)
  if (!query) return
  const cur = view.value.state.selection.main.from
  const cursor = new SearchCursor(view.value.state, query, cur - 1, 'backward')
  let pos = cursor.next().value
  if (!pos) {
    const fromEnd = new SearchCursor(view.value.state, query, view.value.state.doc.length, 'backward')
    pos = fromEnd.next().value
  }
  if (pos) {
    view.value.dispatch({ selection: { anchor: pos.from, head: pos.to }, scrollIntoView: true })
  }
}

function openSearch() {
  if (view.value) openSearchPanel(view.value)
}

defineExpose({ view, setSearch, getMatchCount, findNext, findPrev, openSearch })
</script>

<style scoped>
.cm-editor-wrap {
  height: 100%;
  overflow: hidden;
}
.cm-editor-wrap :deep(.cm-editor) {
  height: 100%;
}
.cm-editor-wrap :deep(.cm-editor.cm-focused) {
  outline: none;
}
.cm-editor-wrap :deep(.cm-panel.cm-search) {
  padding: 0.35rem 0.6rem;
  background: var(--color-bg-page);
  border-bottom: 1px solid var(--color-border-subtle);
  font-family: system-ui, sans-serif;
  font-size: 0.75rem;
}
.cm-editor-wrap :deep(.cm-panel.cm-search label) {
  color: var(--color-text-muted);
  font-size: 0.7rem;
}
.cm-editor-wrap :deep(.cm-panel.cm-search input) {
  padding: 0.2rem 0.4rem;
  background: var(--color-bg-input);
  border: 1px solid var(--color-border-input);
  border-radius: 4px;
  color: var(--color-text-base);
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 0.75rem;
  outline: none;
}
.cm-editor-wrap :deep(.cm-panel.cm-search input:focus) {
  border-color: var(--color-primary);
}
.cm-editor-wrap :deep(.cm-panel.cm-search button) {
  padding: 0.2rem 0.5rem;
  background: var(--color-bg-button);
  border: 1px solid var(--color-border-button);
  border-radius: 4px;
  color: var(--color-text-muted);
  font-family: system-ui, sans-serif;
  font-size: 0.7rem;
  cursor: pointer;
}
.cm-editor-wrap :deep(.cm-panel.cm-search button:hover) {
  background: var(--color-bg-button-hover);
  color: var(--color-text-base);
}
.cm-editor-wrap :deep(.cm-panel.cm-search button[name="close"]) {
  padding: 0.15rem 0.35rem;
  font-size: 0.85rem;
  line-height: 1;
  border: none;
}
.cm-editor-wrap :deep(.cm-searchMatch) {
  background: var(--color-highlight, rgba(255, 255, 100, 0.5));
}
.cm-editor-wrap :deep(.cm-searchMatch-selected) {
  background: rgba(255, 180, 60, 0.6);
}
.cm-editor-wrap :deep(.cm-customSearchMatch) {
  background: var(--color-highlight, rgba(255, 255, 100, 0.5));
  border-radius: 2px;
}
</style>
