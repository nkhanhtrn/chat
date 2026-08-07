import { ref, watch } from 'vue'
import { Settings } from '@/services/settings'
import type { DrawTool } from '@/services/strokeLayer'

/**
 * Loads drawing settings from cloud-synced `Settings` and persists changes.
 * Shared between PdfToolbar and NotebookView so neither needs its own
 * Settings watchers — callers only watch for stroke-layer propagation.
 */
export function useDrawSettings() {
  const drawTool = ref<DrawTool>(loadDrawTool())
  const drawColorIndex = ref<number>(loadNum('pdfDrawColor', 0))
  const penSize = ref<number>(loadNum('pdfPenSize', 1.8))
  const highlighterSize = ref<number>(loadNum('pdfHighlighterSize', 14))
  const eraserSize = ref<number>(loadNum('pdfEraserSize', 20))
  const eraserOpacity = ref<number>(loadNum('pdfEraserOpacity', 0.4))

  watch(drawTool, (v) => Settings.set({ pdfDrawTool: v }))
  watch(drawColorIndex, (v) => Settings.set({ pdfDrawColor: v }))
  watch(penSize, (v) => Settings.set({ pdfPenSize: v }))
  watch(highlighterSize, (v) => Settings.set({ pdfHighlighterSize: v }))
  watch(eraserSize, (v) => Settings.set({ pdfEraserSize: v }))
  watch(eraserOpacity, (v) => Settings.set({ pdfEraserOpacity: v }))

  return { drawTool, drawColorIndex, penSize, highlighterSize, eraserSize, eraserOpacity }
}

function loadNum(key: 'pdfDrawColor' | 'pdfPenSize' | 'pdfHighlighterSize' | 'pdfEraserSize' | 'pdfEraserOpacity', fallback: number): number {
  const v = Settings.get(key)
  return typeof v === 'number' ? v : fallback
}

function loadDrawTool(): DrawTool {
  const v = Settings.get('pdfDrawTool')
  return v === 'pen' || v === 'highlighter' || v === 'eraser' ? v : 'pen'
}
