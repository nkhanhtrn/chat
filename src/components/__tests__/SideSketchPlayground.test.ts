import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, nextTick, reactive } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

const mockRoute = reactive<{ name: string; params: Record<string, string> }>({
  name: 'home',
  params: {},
})

vi.mock('vue-router', () => ({
  useRoute: () => mockRoute,
}))

vi.mock('@/services/StrokeStorage', () => ({
  StrokeStorage: {
    getStrokes: vi.fn().mockResolvedValue([]),
    saveStroke: vi.fn().mockResolvedValue(undefined),
    deleteStroke: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@/services/firestore/firestore-strokes', () => ({
  saveStrokeToFirestore: vi.fn().mockResolvedValue(undefined),
  deleteStrokeFromFirestore: vi.fn().mockResolvedValue(undefined),
  loadStrokesForBook: vi.fn().mockResolvedValue([]),
}))

const redrawMock = vi.fn()

vi.mock('@/composables/useStrokeCanvas', () => ({
  useStrokeCanvas: () => ({
    layer: ref(null),
    setTool: vi.fn(),
    setColor: vi.fn(),
    setPenWidth: vi.fn(),
    setHighlighterWidth: vi.fn(),
    setEraserWidth: vi.fn(),
    setEraserOpacity: vi.fn(),
    setPage: vi.fn(),
    redraw: redrawMock,
    setGestureActive: vi.fn(),
    cancelDraw: vi.fn(),
    getDebugInfo: vi.fn(),
  }),
}))

vi.mock('@/composables/useDrawSettings', () => ({
  useDrawSettings: () => ({
    drawTool: ref('pen'),
    drawColorIndex: ref(0),
    penSize: ref(1.8),
    highlighterSize: ref(14),
    eraserSize: ref(20),
    eraserOpacity: ref(0.4),
  }),
}))

import SideSketchPlayground from '../SideSketchPlayground.vue'
import { useStrokesStore } from '@/stores/strokes'
import type { Stroke } from '@/types/stroke'

function makeStroke(overrides: Partial<Stroke> = {}): Stroke {
  return {
    id: `stroke-${Math.random().toString(36).slice(2)}`,
    bookId: 'test',
    page: 0,
    tool: 'pen',
    colorIndex: 0,
    width: 1.8,
    points: [{ x: 10, y: 10 }, { x: 50, y: 50 }],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

const ROUTE_SCOPES: Record<string, { params: Record<string, string>; name: string }> = {
  home: { name: 'home', params: {} },
  'book-viewer': { name: 'book-viewer', params: { bookId: 'b1' } },
  notebook: { name: 'notebook', params: { id: 'n1' } },
  sketchbook: { name: 'sketchbook', params: { id: 's1' } },
  'project-detail': { name: 'project-detail', params: { id: 'p1' } },
  'project-subproject': { name: 'project-subproject', params: { id: 'p1', subId: 'sub1' } },
}

async function mountSketch(
  routeKey: string = 'home',
  preSetup?: (store: ReturnType<typeof useStrokesStore>) => void,
) {
  const r = ROUTE_SCOPES[routeKey] ?? ROUTE_SCOPES.home
  mockRoute.name = r.name
  mockRoute.params = { ...r.params }

  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useStrokesStore()

  if (preSetup) preSetup(store)

  const wrapper = mount(SideSketchPlayground, { global: { plugins: [pinia] } })
  await flushPromises()
  await nextTick()
  return { wrapper, store }
}

function keyFor(scope: string): string {
  return `side-sketch:${scope}`
}

describe('SideSketchPlayground', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders toolbar with undo and clear buttons', async () => {
      const { wrapper } = await mountSketch()
      expect(wrapper.find('.side-sketch-toolbar').exists()).toBe(true)
      expect(wrapper.find('.side-sketch-canvas-wrap').exists()).toBe(true)
      expect(wrapper.find('[title="Undo"]').exists()).toBe(true)
      expect(wrapper.find('[title="Clear all"]').exists()).toBe(true)
      wrapper.unmount()
    })

    it('disables undo and clear when no strokes', async () => {
      const { wrapper } = await mountSketch()
      await nextTick()
      expect(wrapper.find('[title="Undo"]').attributes('disabled')).toBeDefined()
      expect(wrapper.find('[title="Clear all"]').attributes('disabled')).toBeDefined()
      wrapper.unmount()
    })
  })

  describe('scope keys', () => {
    it('uses book-scoped key on book-viewer route', async () => {
      const { store } = await mountSketch('book-viewer', (s) => {
        vi.spyOn(s, 'loadForBook').mockResolvedValue(undefined)
      })
      expect(store.loadForBook).toHaveBeenCalledWith('side-sketch:book-b1')
    })

    it('uses notebook-scoped key on notebook route', async () => {
      const { store } = await mountSketch('notebook', (s) => {
        vi.spyOn(s, 'loadForBook').mockResolvedValue(undefined)
      })
      expect(store.loadForBook).toHaveBeenCalledWith('side-sketch:notebook-n1')
    })

    it('uses sketchbook-scoped key on sketchbook route', async () => {
      const { store } = await mountSketch('sketchbook', (s) => {
        vi.spyOn(s, 'loadForBook').mockResolvedValue(undefined)
      })
      expect(store.loadForBook).toHaveBeenCalledWith('side-sketch:sketchbook-s1')
    })

    it('uses project-scoped key on project route', async () => {
      const { store } = await mountSketch('project-detail', (s) => {
        vi.spyOn(s, 'loadForBook').mockResolvedValue(undefined)
      })
      expect(store.loadForBook).toHaveBeenCalledWith('side-sketch:project-p1')
    })

    it('uses project+sub scoped key on subproject route', async () => {
      const { store } = await mountSketch('project-subproject', (s) => {
        vi.spyOn(s, 'loadForBook').mockResolvedValue(undefined)
      })
      expect(store.loadForBook).toHaveBeenCalledWith('side-sketch:project-p1-sub1')
    })

    it('uses global key on home route', async () => {
      const { store } = await mountSketch('home', (s) => {
        vi.spyOn(s, 'loadForBook').mockResolvedValue(undefined)
      })
      expect(store.loadForBook).toHaveBeenCalledWith('side-sketch:global')
    })

    it('enables undo when strokes exist for the current scope', async () => {
      const k = keyFor('global')
      const { wrapper } = await mountSketch('home', (s) => {
        s.byBook[k] = [makeStroke()]
        s.loadedBooks[k] = true
      })
      expect(wrapper.find('[title="Undo"]').attributes('disabled')).toBeUndefined()
      wrapper.unmount()
    })

    it('does not enable undo for a different scope', async () => {
      const { wrapper } = await mountSketch('home', (s) => {
        s.byBook[keyFor('book-b1')] = [makeStroke()]
        s.loadedBooks[keyFor('book-b1')] = true
      })
      expect(wrapper.find('[title="Undo"]').attributes('disabled')).toBeDefined()
      wrapper.unmount()
    })
  })

  describe('undo', () => {
    it('removes last stroke and redraws', async () => {
      const k = keyFor('global')
      const { wrapper, store } = await mountSketch('home', (s) => {
        s.byBook[k] = [
          makeStroke({ id: 's1', createdAt: 100 }),
          makeStroke({ id: 's2', createdAt: 200 }),
        ]
        s.loadedBooks[k] = true
      })

      redrawMock.mockClear()
      wrapper.find('[title="Undo"]').trigger('click')
      await nextTick()

      expect(store.byBook[k]).toHaveLength(1)
      expect(store.byBook[k]![0].id).toBe('s1')
      expect(redrawMock).toHaveBeenCalledTimes(1)
      wrapper.unmount()
    })
  })

  describe('clear', () => {
    it('shows confirm dialog on clear click', async () => {
      const { wrapper } = await mountSketch('home', (s) => {
        s.byBook[keyFor('global')] = [makeStroke()]
        s.loadedBooks[keyFor('global')] = true
      })

      expect(wrapper.find('.clear-overlay').exists()).toBe(false)
      await wrapper.find('[title="Clear all"]').trigger('click')
      expect(wrapper.find('.clear-overlay').exists()).toBe(true)
      wrapper.unmount()
    })

    it('removes all strokes and redraws on confirm', async () => {
      const k = keyFor('global')
      const { wrapper, store } = await mountSketch('home', (s) => {
        s.byBook[k] = [makeStroke({ id: 's1' }), makeStroke({ id: 's2' })]
        s.loadedBooks[k] = true
      })

      await wrapper.find('[title="Clear all"]').trigger('click')
      redrawMock.mockClear()
      await wrapper.find('.clear-dialog .danger.solid').trigger('click')
      await nextTick()
      await nextTick()

      expect(store.byBook[k] ?? []).toHaveLength(0)
      expect(redrawMock).toHaveBeenCalledTimes(1)
      expect(wrapper.find('.clear-overlay').exists()).toBe(false)
      wrapper.unmount()
    })

    it('cancel does not remove strokes', async () => {
      const k = keyFor('global')
      const { wrapper, store } = await mountSketch('home', (s) => {
        s.byBook[k] = [makeStroke({ id: 's1' })]
        s.loadedBooks[k] = true
      })

      await wrapper.find('[title="Clear all"]').trigger('click')
      await wrapper.find('.clear-dialog .tb-btn:not(.danger)').trigger('click')
      await nextTick()

      expect(store.byBook[k]).toHaveLength(1)
      expect(wrapper.find('.clear-overlay').exists()).toBe(false)
      wrapper.unmount()
    })
  })
})
