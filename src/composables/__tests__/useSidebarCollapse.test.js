import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useSidebarCollapse } from '../useSidebarCollapse.js'
import { nextTick } from 'vue'

// Mock onMounted to execute callback immediately
vi.mock('vue', async () => {
  const actual = await vi.importActual('vue')
  return {
    ...actual,
    onMounted: (cb) => cb()
  }
})

describe('useSidebarCollapse', () => {
  const STORAGE_KEY = 'testSidebarCollapsed'

  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('initial state', () => {
    it('defaults to not collapsed when no localStorage value', () => {
      const { isCollapsed } = useSidebarCollapse(STORAGE_KEY)
      expect(isCollapsed.value).toBe(false)
    })

    it('loads collapsed state from localStorage when true', () => {
      localStorage.setItem(STORAGE_KEY, 'true')
      const { isCollapsed } = useSidebarCollapse(STORAGE_KEY)
      expect(isCollapsed.value).toBe(true)
    })

    it('loads expanded state from localStorage when false', () => {
      localStorage.setItem(STORAGE_KEY, 'false')
      const { isCollapsed } = useSidebarCollapse(STORAGE_KEY)
      expect(isCollapsed.value).toBe(false)
    })

    it('uses custom storage key', () => {
      localStorage.setItem('customKey', 'true')
      const { isCollapsed } = useSidebarCollapse('customKey')
      expect(isCollapsed.value).toBe(true)
    })

    it('uses default storage key when not provided', () => {
      localStorage.setItem('chatSidebarCollapsed', 'true')
      const { isCollapsed } = useSidebarCollapse()
      expect(isCollapsed.value).toBe(true)
    })
  })

  describe('toggle', () => {
    it('toggles from expanded to collapsed', () => {
      const { isCollapsed, toggle } = useSidebarCollapse(STORAGE_KEY)
      expect(isCollapsed.value).toBe(false)

      toggle()
      expect(isCollapsed.value).toBe(true)
    })

    it('toggles from collapsed to expanded', () => {
      localStorage.setItem(STORAGE_KEY, 'true')
      const { isCollapsed, toggle } = useSidebarCollapse(STORAGE_KEY)
      expect(isCollapsed.value).toBe(true)

      toggle()
      expect(isCollapsed.value).toBe(false)
    })

    it('toggles multiple times correctly', () => {
      const { isCollapsed, toggle } = useSidebarCollapse(STORAGE_KEY)

      toggle()
      expect(isCollapsed.value).toBe(true)

      toggle()
      expect(isCollapsed.value).toBe(false)

      toggle()
      expect(isCollapsed.value).toBe(true)
    })
  })

  describe('localStorage persistence', () => {
    it('saves collapsed state to localStorage when changed', async () => {
      const { isCollapsed } = useSidebarCollapse(STORAGE_KEY)

      isCollapsed.value = true
      await nextTick()

      expect(localStorage.getItem(STORAGE_KEY)).toBe('true')
    })

    it('saves expanded state to localStorage when changed', async () => {
      localStorage.setItem(STORAGE_KEY, 'true')
      const { isCollapsed } = useSidebarCollapse(STORAGE_KEY)

      isCollapsed.value = false
      await nextTick()

      expect(localStorage.getItem(STORAGE_KEY)).toBe('false')
    })

    it('persists state after toggle', async () => {
      const { toggle } = useSidebarCollapse(STORAGE_KEY)

      toggle()
      await nextTick()

      expect(localStorage.getItem(STORAGE_KEY)).toBe('true')
    })
  })
})
