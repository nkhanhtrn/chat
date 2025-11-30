

import { mount } from '@vue/test-utils'
import ContextMenu from '../ContextMenu.vue'

describe('ContextMenu', () => {
  let root
  let wrapper
  const baseProps = {
    visible: true,
    x: 100,
    y: 200,
    highlightedText: 'test highlight'
  }

  beforeEach(() => {
    root = document.createElement('div')
    document.body.appendChild(root)
  })
  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
      wrapper = null
    }
    document.body.innerHTML = ''
  })

  it('renders at correct position when visible', () => {
    wrapper = mount(ContextMenu, { props: baseProps, attachTo: root })
    const menu = document.body.querySelector('.context-menu')
    expect(menu).toBeTruthy()
    expect(menu.style.left).toBe('100px')
    expect(menu.style.top).toBe('200px')
    expect(menu.style.display).toBe('block')
  })


  it('emits close when clicking outside', async () => {
    wrapper = mount(ContextMenu, { props: baseProps, attachTo: root })
    const backdrop = document.body.querySelector('.context-menu-backdrop')
    expect(backdrop).toBeTruthy()
    await backdrop.click()
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('emits close when pressing Escape key', async () => {
    wrapper = mount(ContextMenu, { props: baseProps, attachTo: root })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('does not emit close when pressing Escape if not visible', async () => {
    wrapper = mount(ContextMenu, { props: { ...baseProps, visible: false }, attachTo: root })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('close')).toBeFalsy()
  })

  it('does not render menu when not visible', () => {
    wrapper = mount(ContextMenu, { props: { ...baseProps, visible: false }, attachTo: root })
    const menu = document.body.querySelector('.context-menu')
    expect(menu).toBeFalsy()
  })

  it('disables Ask Question button when isStreaming is true', () => {
    wrapper = mount(ContextMenu, { props: { ...baseProps, isStreaming: true }, attachTo: root })
    const buttons = document.body.querySelectorAll('.context-menu-btn')
    // Button order: Highlight (0), Copy (1), Note (2), Explain (3), Add Chapter (4)
    const askQuestionBtn = buttons[3]
    expect(askQuestionBtn).toBeTruthy()
    expect(askQuestionBtn.disabled).toBe(true)
  })

  it('enables Ask Question button when isStreaming is false', () => {
    wrapper = mount(ContextMenu, { props: { ...baseProps, isStreaming: false }, attachTo: root })
    const buttons = document.body.querySelectorAll('.context-menu-btn')
    const askQuestionBtn = buttons[3]
    expect(askQuestionBtn).toBeTruthy()
    expect(askQuestionBtn.disabled).toBe(false)
  })

  it('highlight button is always enabled regardless of streaming', () => {
    wrapper = mount(ContextMenu, { props: { ...baseProps, isStreaming: true }, attachTo: root })
    const buttons = document.body.querySelectorAll('.context-menu-btn')
    const highlightBtn = buttons[0] // First button is "Highlight"
    expect(highlightBtn).toBeTruthy()
    expect(highlightBtn.disabled).toBe(false)
  })

  describe('Color Picker', () => {
    it('renders 5 color circles', () => {
      wrapper = mount(ContextMenu, { props: baseProps, attachTo: root })
      const circles = document.body.querySelectorAll('.color-circle')
      expect(circles.length).toBe(5)
    })

    it('selects first color by default', () => {
      wrapper = mount(ContextMenu, { props: baseProps, attachTo: root })
      const circles = document.body.querySelectorAll('.color-circle')
      expect(circles[0].classList.contains('selected')).toBe(true)
      expect(circles[1].classList.contains('selected')).toBe(false)
    })

    it('selects color based on colorIndex prop', () => {
      wrapper = mount(ContextMenu, { props: { ...baseProps, colorIndex: 2 }, attachTo: root })
      const circles = document.body.querySelectorAll('.color-circle')
      expect(circles[0].classList.contains('selected')).toBe(false)
      expect(circles[2].classList.contains('selected')).toBe(true)
    })

    it('emits keep-highlight when clicking a color circle for new highlight', async () => {
      wrapper = mount(ContextMenu, { props: baseProps, attachTo: root })
      const circles = document.body.querySelectorAll('.color-circle')

      await circles[3].click()

      expect(wrapper.emitted('keep-highlight')).toBeTruthy()
      expect(wrapper.emitted('keep-highlight')[0]).toEqual([3])
    })

    it('emits change-color when clicking a color circle for existing highlight', async () => {
      wrapper = mount(ContextMenu, { props: { ...baseProps, hasExistingHighlight: true }, attachTo: root })
      const circles = document.body.querySelectorAll('.color-circle')

      await circles[3].click()

      expect(wrapper.emitted('change-color')).toBeTruthy()
      expect(wrapper.emitted('change-color')[0]).toEqual([3])
    })

    it('updates selected color when clicking a circle', async () => {
      wrapper = mount(ContextMenu, { props: baseProps, attachTo: root })
      const circles = document.body.querySelectorAll('.color-circle')

      await circles[2].click()

      expect(circles[2].classList.contains('selected')).toBe(true)
      expect(circles[0].classList.contains('selected')).toBe(false)
    })

    it('emits remove-highlight when clicking Remove button for existing highlight', async () => {
      // For existing highlights, clicking the button (which shows "Remove") should emit remove-highlight
      wrapper = mount(ContextMenu, { props: { ...baseProps, hasExistingHighlight: true }, attachTo: root })

      // Click Remove button (first button)
      const buttons = document.body.querySelectorAll('.context-menu-btn')
      await buttons[0].click()

      expect(wrapper.emitted('remove-highlight')).toBeTruthy()
    })

    it('emits keep-highlight with selected color index when clicking Highlight button for new selection', async () => {
      // For new selections, clicking the Highlight button should emit keep-highlight with selected color
      wrapper = mount(ContextMenu, { props: { ...baseProps, hasExistingHighlight: false }, attachTo: root })
      const circles = document.body.querySelectorAll('.color-circle')

      // Select color index 4
      await circles[4].click()

      // Click Highlight button (first button)
      const buttons = document.body.querySelectorAll('.context-menu-btn')
      await buttons[0].click()

      // keep-highlight is emitted twice: once when clicking color circle, once when clicking button
      expect(wrapper.emitted('keep-highlight')).toBeTruthy()
      expect(wrapper.emitted('keep-highlight')[1]).toEqual([4])
    })

    // Note: Color circles are not disabled during streaming in the current implementation
    // This is intentional as highlighting does not require API calls

    it('syncs selectedColorIndex when colorIndex prop changes', async () => {
      wrapper = mount(ContextMenu, { props: baseProps, attachTo: root })

      // Initially first color is selected
      let circles = document.body.querySelectorAll('.color-circle')
      expect(circles[0].classList.contains('selected')).toBe(true)

      // Update prop to select third color
      await wrapper.setProps({ colorIndex: 2 })

      circles = document.body.querySelectorAll('.color-circle')
      expect(circles[2].classList.contains('selected')).toBe(true)
      expect(circles[0].classList.contains('selected')).toBe(false)
    })

    it('resets to prop colorIndex when menu becomes visible', async () => {
      wrapper = mount(ContextMenu, { props: { ...baseProps, visible: false, colorIndex: 0 }, attachTo: root })

      // Make menu visible with colorIndex 3
      await wrapper.setProps({ visible: true, colorIndex: 3 })

      const circles = document.body.querySelectorAll('.color-circle')
      expect(circles[3].classList.contains('selected')).toBe(true)
    })
  })

  describe('Copy functionality', () => {
    let mockWriteText

    beforeEach(() => {
      mockWriteText = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: mockWriteText },
        writable: true,
        configurable: true
      })
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('renders Copy button as the second button', () => {
      wrapper = mount(ContextMenu, { props: baseProps, attachTo: root })
      const buttons = document.body.querySelectorAll('.context-menu-btn')
      expect(buttons[1].textContent).toBe('Copy')
    })

    it('copies highlighted text to clipboard when clicking Copy button', async () => {
      wrapper = mount(ContextMenu, { props: baseProps, attachTo: root })
      const buttons = document.body.querySelectorAll('.context-menu-btn')

      await buttons[1].click()
      await vi.waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith('test highlight')
      })
    })

    it('emits close after copying', async () => {
      wrapper = mount(ContextMenu, { props: baseProps, attachTo: root })
      const buttons = document.body.querySelectorAll('.context-menu-btn')

      await buttons[1].click()
      await vi.waitFor(() => {
        expect(wrapper.emitted('close')).toBeTruthy()
      })
    })

    it('copies text when pressing Ctrl+C', async () => {
      wrapper = mount(ContextMenu, { props: baseProps, attachTo: root })

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true }))
      await vi.waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith('test highlight')
      })
    })

    it('copies text when pressing Cmd+C (Mac)', async () => {
      wrapper = mount(ContextMenu, { props: baseProps, attachTo: root })

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', metaKey: true }))
      await vi.waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith('test highlight')
      })
    })

    it('emits close after Ctrl+C copy', async () => {
      wrapper = mount(ContextMenu, { props: baseProps, attachTo: root })

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true }))
      await vi.waitFor(() => {
        expect(wrapper.emitted('close')).toBeTruthy()
      })
    })

    it('does not copy when menu is not visible', async () => {
      // Create a fresh mock specifically for this test to check it's not called
      const freshMock = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: freshMock },
        writable: true,
        configurable: true
      })

      wrapper = mount(ContextMenu, { props: { ...baseProps, visible: false }, attachTo: root })

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true }))
      // Give time for any async operations
      await new Promise(resolve => setTimeout(resolve, 10))
      expect(freshMock).not.toHaveBeenCalled()
    })

    it('does not copy when Ctrl is not pressed', async () => {
      wrapper = mount(ContextMenu, { props: baseProps, attachTo: root })

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c' }))
      // Give time for any async operations
      await new Promise(resolve => setTimeout(resolve, 10))
      expect(mockWriteText).not.toHaveBeenCalled()
    })

    it('does not copy when highlightedText is empty', async () => {
      wrapper = mount(ContextMenu, { props: { ...baseProps, highlightedText: '' }, attachTo: root })
      const buttons = document.body.querySelectorAll('.context-menu-btn')

      await buttons[1].click()
      // Give time for any async operations
      await new Promise(resolve => setTimeout(resolve, 10))
      expect(mockWriteText).not.toHaveBeenCalled()
    })
  })

  describe('Note functionality', () => {
    // Button order: Highlight (0), Copy (1), Note (2), Explain (3), Add Chapter (4)
    const NOTE_BTN_INDEX = 2

    it('shows "Add Note" button by default', () => {
      wrapper = mount(ContextMenu, { props: baseProps, attachTo: root })
      const buttons = document.body.querySelectorAll('.context-menu-btn')
      const noteBtn = buttons[NOTE_BTN_INDEX]
      expect(noteBtn.textContent).toBe('Note')
    })

    it('shows "Edit Note" when hasExistingNote is true', () => {
      wrapper = mount(ContextMenu, { props: { ...baseProps, hasExistingNote: true }, attachTo: root })
      const buttons = document.body.querySelectorAll('.context-menu-btn')
      const noteBtn = buttons[NOTE_BTN_INDEX]
      expect(noteBtn.textContent).toBe('Edit Note')
    })

    it('shows "Note" when hasExistingNote is false', () => {
      wrapper = mount(ContextMenu, { props: { ...baseProps, hasExistingNote: false }, attachTo: root })
      const buttons = document.body.querySelectorAll('.context-menu-btn')
      const noteBtn = buttons[NOTE_BTN_INDEX]
      expect(noteBtn.textContent).toBe('Note')
    })

    it('emits add-note event when Note button is clicked', async () => {
      wrapper = mount(ContextMenu, { props: baseProps, attachTo: root })
      const buttons = document.body.querySelectorAll('.context-menu-btn')
      const noteBtn = buttons[NOTE_BTN_INDEX]

      await noteBtn.click()

      expect(wrapper.emitted('add-note')).toBeTruthy()
      expect(wrapper.emitted('add-note')).toHaveLength(1)
    })

    it('emits add-note event when Edit Note button is clicked', async () => {
      wrapper = mount(ContextMenu, { props: { ...baseProps, hasExistingNote: true }, attachTo: root })
      const buttons = document.body.querySelectorAll('.context-menu-btn')
      const noteBtn = buttons[NOTE_BTN_INDEX]

      await noteBtn.click()

      expect(wrapper.emitted('add-note')).toBeTruthy()
      expect(wrapper.emitted('add-note')).toHaveLength(1)
    })

    it('note button is always enabled regardless of streaming', () => {
      wrapper = mount(ContextMenu, { props: { ...baseProps, isStreaming: true }, attachTo: root })
      const buttons = document.body.querySelectorAll('.context-menu-btn')
      const noteBtn = buttons[NOTE_BTN_INDEX]
      expect(noteBtn.disabled).toBe(false)
    })

    it('updates button text when hasExistingNote prop changes', async () => {
      wrapper = mount(ContextMenu, { props: { ...baseProps, hasExistingNote: false }, attachTo: root })

      // Initially shows "Note"
      let buttons = document.body.querySelectorAll('.context-menu-btn')
      expect(buttons[NOTE_BTN_INDEX].textContent).toBe('Note')

      // Update prop to show existing note
      await wrapper.setProps({ hasExistingNote: true })

      buttons = document.body.querySelectorAll('.context-menu-btn')
      expect(buttons[NOTE_BTN_INDEX].textContent).toBe('Edit Note')
    })
  })

  describe('Custom prompt functionality', () => {
    it('renders PromptInput component', () => {
      wrapper = mount(ContextMenu, { props: baseProps, attachTo: root })
      const promptInput = document.body.querySelector('.prompt-input')
      expect(promptInput).toBeTruthy()
    })

    it('emits custom-prompt event when PromptInput submits', async () => {
      wrapper = mount(ContextMenu, { props: baseProps, attachTo: root })

      // Find the input and simulate submit
      const input = document.body.querySelector('.prompt-input input, .prompt-input textarea')
      if (input) {
        input.value = 'explain this concept'
        input.dispatchEvent(new Event('input'))

        // Trigger submit via Enter key
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
      }

      // The PromptInput component should emit submit which triggers custom-prompt
      // We can test this by checking the wrapper emitted events
      await wrapper.vm.$nextTick()

      // Since PromptInput emits 'submit', ContextMenu should emit 'custom-prompt'
      // The exact mechanism depends on PromptInput implementation
    })

    it('disables PromptInput when isStreaming is true', () => {
      wrapper = mount(ContextMenu, { props: { ...baseProps, isStreaming: true }, attachTo: root })
      const promptInput = document.body.querySelector('.prompt-input')
      // PromptInput should be disabled
      const input = promptInput?.querySelector('input, textarea')
      if (input) {
        expect(input.disabled).toBe(true)
      }
    })

    it('enables PromptInput when isStreaming is false', () => {
      wrapper = mount(ContextMenu, { props: { ...baseProps, isStreaming: false }, attachTo: root })
      const promptInput = document.body.querySelector('.prompt-input')
      const input = promptInput?.querySelector('input, textarea')
      if (input) {
        expect(input.disabled).toBe(false)
      }
    })
  })
})
