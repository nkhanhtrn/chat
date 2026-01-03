import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ref } from 'vue'

// Mock ChatStorage
vi.mock('../../services/ChatStorage.js', () => ({
  ChatStorage: {
    setReadOnlyMode: vi.fn(),
    isReadOnlyMode: vi.fn(() => false)
  }
}))

describe('useStaleDataDetection (local-only mode)', () => {
  let useStaleDataDetection
  let setReadOnlyMode

  const mockLocalStorage = {
    store: {},
    getItem: vi.fn((key) => mockLocalStorage.store[key] || null),
    setItem: vi.fn((key, value) => { mockLocalStorage.store[key] = value }),
    removeItem: vi.fn((key) => { delete mockLocalStorage.store[key] }),
    clear: vi.fn(() => { mockLocalStorage.store = {} })
  }

  beforeEach(async () => {
    vi.useFakeTimers()

    // Reset localStorage mock
    mockLocalStorage.store = {}
    mockLocalStorage.getItem.mockClear()

    // Mock global localStorage
    Object.defineProperty(global, 'localStorage', {
      value: mockLocalStorage,
      writable: true
    })

    // Mock document for visibility and event listeners
    global.document = {
      visibilityState: 'visible',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }

    // Mock window.location.reload
    global.window = {
      location: {
        reload: vi.fn()
      }
    }

    // Import fresh modules
    const { ChatStorage } = await import('../../services/ChatStorage.js')
    setReadOnlyMode = ChatStorage.setReadOnlyMode

    // Reset mocks
    vi.mocked(setReadOnlyMode).mockClear()

    // Import the composable fresh
    const module = await import('../useStaleDataDetection.js')
    useStaleDataDetection = module.useStaleDataDetection
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('should start with banner hidden', () => {
      const { showStaleDataBanner } = useStaleDataDetection()
      expect(showStaleDataBanner.value).toBe(false)
    })

    it('should start with read-only mode disabled', () => {
      const { isReadOnlyMode } = useStaleDataDetection()
      expect(isReadOnlyMode.value).toBe(false)
    })
  })

  describe('triggerBanner', () => {
    it('should show the stale data banner when triggered', () => {
      const { showStaleDataBanner, triggerBanner } = useStaleDataDetection()

      triggerBanner()

      expect(showStaleDataBanner.value).toBe(true)
    })

    it('should enable read-only mode when triggered', () => {
      const { isReadOnlyMode, triggerBanner } = useStaleDataDetection()

      triggerBanner()

      expect(isReadOnlyMode.value).toBe(true)
      expect(setReadOnlyMode).toHaveBeenCalledWith(true)
    })
  })

  describe('dismissBanner', () => {
    it('should hide the banner when dismissed', () => {
      const { showStaleDataBanner, triggerBanner, dismissBanner } = useStaleDataDetection()

      triggerBanner()
      expect(showStaleDataBanner.value).toBe(true)

      dismissBanner()
      expect(showStaleDataBanner.value).toBe(false)
    })

    it('should keep read-only mode enabled when dismissed', () => {
      const { isReadOnlyMode, triggerBanner, dismissBanner } = useStaleDataDetection()

      triggerBanner()
      dismissBanner()

      expect(isReadOnlyMode.value).toBe(true)
      // setReadOnlyMode should have been called twice (once for trigger, once for dismiss)
      expect(setReadOnlyMode).toHaveBeenCalledTimes(2)
      expect(setReadOnlyMode).toHaveBeenLastCalledWith(true)
    })
  })

  describe('refresh', () => {
    it('should reload the page when refresh is called', () => {
      const { refresh } = useStaleDataDetection()

      refresh()

      expect(window.location.reload).toHaveBeenCalled()
    })

    it('should disable read-only mode before refresh', () => {
      const { refresh } = useStaleDataDetection()

      refresh()

      expect(setReadOnlyMode).toHaveBeenCalledWith(false)
    })
  })

  describe('returned interface', () => {
    it('should return all expected properties and methods', () => {
      const result = useStaleDataDetection()

      expect(result).toHaveProperty('showStaleDataBanner')
      expect(result).toHaveProperty('isReadOnlyMode')
      expect(result).toHaveProperty('refresh')
      expect(result).toHaveProperty('dismissBanner')
      expect(result).toHaveProperty('triggerBanner')

      expect(typeof result.refresh).toBe('function')
      expect(typeof result.dismissBanner).toBe('function')
      expect(typeof result.triggerBanner).toBe('function')
    })
  })
})
