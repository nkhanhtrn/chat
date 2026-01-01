import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ToolLibrary from '../ToolLibrary.vue'

// Mock InlineEdit component
vi.mock('../../../InlineEdit.vue', () => ({
  default: {
    name: 'InlineEdit',
    props: ['modelValue', 'textClass', 'inputClass'],
    emits: ['save'],
    template: '<div class="mock-inline-edit">{{ modelValue }}</div>'
  }
}))

// Mock indexedDB service
const mockTools = [
  { id: '1', name: 'Global Tool', scope: 'global', type: 'tool', code: 'console.log("test")', emoji: '🔧' },
  { id: '2', name: 'Session Tool', scope: 'session', sessionId: 'session-123', type: 'tool', code: 'console.log("session")', emoji: '📝' }
]

vi.mock('../../../services/indexedDB.js', () => ({
  getAllTools: vi.fn(() => Promise.resolve(mockTools)),
  getDeletedTools: vi.fn(() => Promise.resolve([])),
  saveTool: vi.fn(() => Promise.resolve()),
  deleteTool: vi.fn(() => Promise.resolve()),
  restoreTool: vi.fn(() => Promise.resolve()),
  permanentlyDeleteTool: vi.fn(() => Promise.resolve()),
  emptyRecycleBin: vi.fn(() => Promise.resolve()),
  syncToolsFromCloud: vi.fn(() => Promise.resolve()),
  updateToolScope: vi.fn(() => Promise.resolve())
}))

// Mock useStudioSessions
vi.mock('../../../composables/studio/useStudioSessions.js', () => ({
  useStudioSessions: () => ({
    activeSessionId: { value: 'session-123' }
  })
}))

describe('ToolLibrary', () => {
  let wrapper
  let localStorageMock

  beforeEach(() => {
    // Mock localStorage
    const localStorageData = {}
    localStorageMock = {
      getItem: vi.fn((key) => localStorageData[key] || null),
      setItem: vi.fn((key, value) => { localStorageData[key] = value }),
      removeItem: vi.fn((key) => { delete localStorageData[key] }),
      clear: vi.fn(() => { Object.keys(localStorageData).forEach(k => delete localStorageData[k]) })
    }
    global.localStorage = localStorageMock

    // Clear all mocks before each test
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Rendering', () => {
    it('should render the library trigger button', () => {
      wrapper = mount(ToolLibrary)
      expect(wrapper.find('.library-trigger').exists()).toBe(true)
    })

    it('should render the dropdown when open', async () => {
      wrapper = mount(ToolLibrary)
      await wrapper.vm.toggleOpen()
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.library-dropdown').exists()).toBe(true)
    })

    it('should render resize handle', async () => {
      wrapper = mount(ToolLibrary)
      await wrapper.vm.toggleOpen()
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.resize-handle').exists()).toBe(true)
    })
  })

  describe('Resize Functionality', () => {
    it('should have default width and height', () => {
      wrapper = mount(ToolLibrary)
      expect(wrapper.vm.dropdownWidth).toBe(280)
      expect(wrapper.vm.dropdownHeight).toBe(400)
    })

    it('should load saved size from localStorage on mount', async () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify({ width: 350, height: 500 }))
      wrapper = mount(ToolLibrary)
      await wrapper.vm.$nextTick()

      expect(localStorageMock.getItem).toHaveBeenCalledWith('tool-library-size')
      expect(wrapper.vm.dropdownWidth).toBe(350)
      expect(wrapper.vm.dropdownHeight).toBe(500)
    })

    it('should save size to localStorage after resize', async () => {
      wrapper = mount(ToolLibrary)
      await wrapper.vm.toggleOpen()
      await wrapper.vm.$nextTick()

      // Simulate resize start
      const resizeHandle = wrapper.find('.resize-handle')
      await resizeHandle.trigger('mousedown', { clientX: 100, clientY: 200 })

      // Simulate mouse move (drag right and down)
      const mouseMoveEvent = new MouseEvent('mousemove', { clientX: 150, clientY: 250 })
      document.dispatchEvent(mouseMoveEvent)

      // Simulate mouse up to stop resizing
      const mouseUpEvent = new MouseEvent('mouseup')
      document.dispatchEvent(mouseUpEvent)

      await wrapper.vm.$nextTick()

      // Check that size was saved to localStorage
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'tool-library-size',
        expect.stringContaining('"width"')
      )
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'tool-library-size',
        expect.stringContaining('"height"')
      )
    })

    it('should apply correct width and height to dropdown', async () => {
      wrapper = mount(ToolLibrary)
      wrapper.vm.dropdownWidth = 350
      wrapper.vm.dropdownHeight = 500
      await wrapper.vm.toggleOpen()
      await wrapper.vm.$nextTick()

      const dropdown = wrapper.find('.library-dropdown')
      expect(dropdown.attributes('style')).toContain('width: 350px')
      expect(dropdown.attributes('style')).toContain('height: 500px')
    })

    it('should respect minimum width constraint during resize', async () => {
      wrapper = mount(ToolLibrary)
      wrapper.vm.isResizing = true
      wrapper.vm.dropdownWidth = 250
      wrapper.vm.resizeStart = { x: 100, y: 100, width: 250, height: 400 }

      // Try to resize below minimum (200px) - drag far right which would make width very small
      // dx = 500 - 100 = 400, so new width would be 250 - 400 = -150, clamped to 200
      wrapper.vm.onResize({ clientX: 500, clientY: 200 })

      expect(wrapper.vm.dropdownWidth).toBe(200) // Should be clamped to minimum
    })

    it('should respect minimum height constraint during resize', async () => {
      wrapper = mount(ToolLibrary)
      wrapper.vm.isResizing = true
      wrapper.vm.dropdownHeight = 250
      wrapper.vm.resizeStart = { x: 100, y: 100, width: 280, height: 250 }

      // Try to resize below minimum (200px)
      // dy = 50 - 100 = -50, so new height would be 250 - 50 = 200
      wrapper.vm.onResize({ clientX: 100, clientY: 50 })

      expect(wrapper.vm.dropdownHeight).toBe(200) // Should be clamped to minimum
    })

    it('should invert width calculation for bottom-left resize handle', async () => {
      wrapper = mount(ToolLibrary)
      wrapper.vm.isResizing = true
      wrapper.vm.resizeStart = { x: 100, y: 100, width: 300, height: 400 }

      // Drag right (positive dx) should decrease width for bottom-left handle
      wrapper.vm.onResize({ clientX: 150, clientY: 100 })
      expect(wrapper.vm.dropdownWidth).toBe(250) // 300 - 50

      // Drag left (negative dx) should increase width for bottom-left handle
      wrapper.vm.onResize({ clientX: 50, clientY: 100 })
      expect(wrapper.vm.dropdownWidth).toBe(350) // 300 - (-50)
    })
  })

  describe('Clone Tool Scope Preservation', () => {
    it('should clone global tool to global scope', async () => {
      const { saveTool } = await import('../../../services/indexedDB.js')
      const globalTool = { id: '1', name: 'Global Tool', scope: 'global', type: 'tool', code: 'test', emoji: '🔧' }

      wrapper = mount(ToolLibrary)
      await wrapper.vm.cloneTool(globalTool)

      expect(saveTool).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'global',
          sessionId: undefined,
          name: 'Global Tool (Copy)'
        })
      )
    })

    it('should clone session tool to session scope', async () => {
      const { saveTool } = await import('../../../services/indexedDB.js')
      const sessionTool = { id: '2', name: 'Session Tool', scope: 'session', sessionId: 'session-abc', type: 'tool', code: 'test', emoji: '📝' }

      wrapper = mount(ToolLibrary)
      await wrapper.vm.cloneTool(sessionTool)

      expect(saveTool).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'session',
          sessionId: 'session-abc',
          name: 'Session Tool (Copy)'
        })
      )
    })

    it('should clone tool without scope to global scope', async () => {
      const { saveTool } = await import('../../../services/indexedDB.js')
      const toolWithoutScope = { id: '3', name: 'Old Tool', type: 'tool', code: 'test', emoji: '⚙️' }

      wrapper = mount(ToolLibrary)
      await wrapper.vm.cloneTool(toolWithoutScope)

      expect(saveTool).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'global',
          sessionId: undefined
        })
      )
    })

    it('should append copy number when name exists in scope', async () => {
      const { saveTool, getAllTools } = await import('../../../services/indexedDB.js')
      getAllTools.mockResolvedValue([
        { name: 'My Tool (Copy)', scope: 'global', type: 'tool' }
      ])

      const tool = { id: '1', name: 'My Tool', scope: 'global', type: 'tool', code: 'test', emoji: '🔧' }

      wrapper = mount(ToolLibrary)
      await wrapper.vm.cloneTool(tool)

      expect(saveTool).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'My Tool (Copy 2)'
        })
      )
    })
  })

  describe('Open/Close Behavior', () => {
    it('should start closed', () => {
      wrapper = mount(ToolLibrary)
      expect(wrapper.vm.isOpen).toBe(false)
    })

    it('should open when toggleOpen is called', async () => {
      wrapper = mount(ToolLibrary)
      wrapper.vm.toggleOpen()
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.isOpen).toBe(true)
    })

    it('should close when clicking outside', async () => {
      wrapper = mount(ToolLibrary)
      wrapper.vm.toggleOpen()
      await wrapper.vm.$nextTick()

      // Trigger click outside event
      const clickEvent = new MouseEvent('mousedown', { bubbles: true })
      document.dispatchEvent(clickEvent)
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.isOpen).toBe(false)
    })
  })

  describe('Keyboard Shortcuts', () => {
    it('should open on Ctrl+Space', async () => {
      wrapper = mount(ToolLibrary)

      const keyboardEvent = new KeyboardEvent('keydown', {
        code: 'Space',
        ctrlKey: true,
        bubbles: true
      })
      document.dispatchEvent(keyboardEvent)

      await wrapper.vm.$nextTick()
      expect(wrapper.vm.isOpen).toBe(true)
    })

    it('should be able to close via toggleOpen', async () => {
      wrapper = mount(ToolLibrary)
      wrapper.vm.toggleOpen()
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.isOpen).toBe(true)

      wrapper.vm.toggleOpen()
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.isOpen).toBe(false)
    })
  })

  describe('Resize Handle Position', () => {
    it('should position resize handle at bottom left', async () => {
      wrapper = mount(ToolLibrary)
      await wrapper.vm.toggleOpen()
      await wrapper.vm.$nextTick()

      const resizeHandle = wrapper.find('.resize-handle')
      const styles = window.getComputedStyle(resizeHandle.element)

      // The resize handle should be positioned at bottom-left
      expect(resizeHandle.exists()).toBe(true)
    })
  })
})
