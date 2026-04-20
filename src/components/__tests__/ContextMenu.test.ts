import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import ContextMenu from '../ContextMenu.vue'

// Stub PromptInput since it doesn't exist as a component file
const PromptInputStub = {
  name: 'PromptInput',
  template: '<div class="prompt-input-stub"><input type="text" /></div>',
  emits: ['submit', 'ctrl-enter-submit'],
  props: ['placeholder', 'disabled'],
}

let wrapper: VueWrapper<any>

function mountMenu(props = {}) {
  if (wrapper) wrapper.unmount()
  wrapper = mount(ContextMenu, {
    props: {
      visible: true,
      x: 100,
      y: 100,
      highlightedText: 'test text',
      ...props,
    },
    global: {
      stubs: { PromptInput: PromptInputStub },
    },
    attachTo: document.body,
  })
  return wrapper
}

function getBody() {
  return document.body
}

describe('ContextMenu', () => {
  beforeEach(() => {
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
  })

  afterEach(() => {
    if (wrapper) wrapper.unmount()
    vi.restoreAllMocks()
  })

  describe('visibility', () => {
    it('renders nothing when visible is false', () => {
      const w = mount(ContextMenu, {
        props: { visible: false },
        global: { stubs: { PromptInput: PromptInputStub } },
        attachTo: document.body,
      })
      expect(getBody().querySelector('.context-menu')).toBeNull()
      w.unmount()
    })

    it('renders menu when visible is true', () => {
      mountMenu()
      expect(getBody().querySelector('.context-menu')).not.toBeNull()
      expect(getBody().querySelector('.context-menu-backdrop')).not.toBeNull()
    })
  })

  describe('positioning', () => {
    it('applies x and y as inline styles', () => {
      mountMenu({ x: 200, y: 300 })
      const menu = getBody().querySelector('.context-menu') as HTMLElement
      expect(menu.style.left).toBe('200px')
      expect(menu.style.top).toBe('300px')
    })
  })

  describe('close behavior', () => {
    it('emits close when backdrop is clicked', async () => {
      const w = mountMenu()
      const backdrop = getBody().querySelector('.context-menu-backdrop') as HTMLElement
      backdrop.click()
      await nextTick()
      expect(w.emitted('close')).toHaveLength(1)
    })

    it('emits close on Escape key', async () => {
      const w = mountMenu()
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      await nextTick()
      expect(w.emitted('close')).toHaveLength(1)
    })

    it('does not emit close on Escape when not visible', async () => {
      const w = mount(ContextMenu, {
        props: { visible: false },
        global: { stubs: { PromptInput: PromptInputStub } },
        attachTo: document.body,
      })
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      await nextTick()
      expect(w.emitted('close')).toBeUndefined()
      w.unmount()
    })
  })

  describe('copy', () => {
    it('copies highlighted text to clipboard and emits close', async () => {
      const w = mountMenu({ highlightedText: 'copy me' })
      const buttons = getBody().querySelectorAll('.context-menu-btn')
      const copyBtn = Array.from(buttons).find(b => b.textContent === 'Copy')!
      copyBtn.click()
      await nextTick()

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('copy me')
      expect(w.emitted('close')).toHaveLength(1)
    })
  })

  describe('highlight vs remove', () => {
    it('shows Highlight button when no highlightId', () => {
      mountMenu({ highlightId: null })
      const buttons = Array.from(getBody().querySelectorAll('.context-menu-btn')).map(b => b.textContent)
      expect(buttons).toContain('Highlight')
      expect(buttons).not.toContain('Remove')
    })

    it('shows Remove button when highlightId is set', () => {
      mountMenu({ highlightId: 'hl-1' })
      const buttons = Array.from(getBody().querySelectorAll('.context-menu-btn')).map(b => b.textContent)
      expect(buttons).toContain('Remove')
      expect(buttons).not.toContain('Highlight')
    })

    it('emits highlight when Highlight is clicked', async () => {
      const w = mountMenu()
      const buttons = getBody().querySelectorAll('.context-menu-btn')
      const hlBtn = Array.from(buttons).find(b => b.textContent === 'Highlight')!
      hlBtn.click()
      await nextTick()
      expect(w.emitted('highlight')).toHaveLength(1)
    })

    it('emits remove when Remove is clicked', async () => {
      const w = mountMenu({ highlightId: 'hl-1' })
      const buttons = getBody().querySelectorAll('.context-menu-btn')
      const rmBtn = Array.from(buttons).find(b => b.textContent === 'Remove')!
      rmBtn.click()
      await nextTick()
      expect(w.emitted('remove')).toHaveLength(1)
    })
  })

  describe('color picker', () => {
    it('renders 5 color circles', () => {
      mountMenu()
      expect(getBody().querySelectorAll('.color-circle')).toHaveLength(5)
    })

    it('marks the colorIndex circle as selected', () => {
      mountMenu({ colorIndex: 2 })
      const circles = getBody().querySelectorAll('.color-circle')
      expect(circles[2].classList.contains('selected')).toBe(true)
      expect(circles[0].classList.contains('selected')).toBe(false)
    })

    it('emits set-selection-color when a circle is clicked', async () => {
      const w = mountMenu()
      const circles = getBody().querySelectorAll('.color-circle')
      circles[3].dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await nextTick()
      expect(w.emitted('set-selection-color')).toEqual([[3]])
    })
  })

  describe('action buttons', () => {
    it('emits ask-question when Explain is clicked', async () => {
      const w = mountMenu({ highlightedText: 'deep dive this' })
      const buttons = getBody().querySelectorAll('.context-menu-btn')
      const btn = Array.from(buttons).find(b => b.textContent === 'Explain')!
      btn.click()
      await nextTick()
      expect(w.emitted('ask-question')).toEqual([['deep dive this']])
    })

    it('emits dictionary when Dictionary is clicked', async () => {
      const w = mountMenu()
      const buttons = getBody().querySelectorAll('.context-menu-btn')
      const btn = Array.from(buttons).find(b => b.textContent === 'Dictionary')!
      btn.click()
      await nextTick()
      expect(w.emitted('dictionary')).toHaveLength(1)
    })

    it('emits summary when Summary is clicked', async () => {
      const w = mountMenu({ highlightedText: 'summarize this' })
      const buttons = getBody().querySelectorAll('.context-menu-btn')
      const btn = Array.from(buttons).find(b => b.textContent === 'Summary')!
      btn.click()
      await nextTick()
      expect(w.emitted('summary')).toHaveLength(1)
    })

    it('emits link-to-question when Link to Question is clicked', async () => {
      const w = mountMenu()
      const buttons = getBody().querySelectorAll('.context-menu-btn')
      const btn = Array.from(buttons).find(b => b.textContent === 'Link to Question')!
      btn.click()
      await nextTick()
      expect(w.emitted('link-to-question')).toHaveLength(1)
    })

    it('emits note when Note is clicked', async () => {
      const w = mountMenu()
      const buttons = getBody().querySelectorAll('.context-menu-btn')
      const btn = Array.from(buttons).find(b => b.textContent?.includes('Note'))!
      btn.click()
      await nextTick()
      expect(w.emitted('note')).toHaveLength(1)
    })

    it('disables Dictionary when isStreaming is true', () => {
      mountMenu({ isStreaming: true })
      const buttons = getBody().querySelectorAll('.context-menu-btn')
      const btn = Array.from(buttons).find(b => b.textContent === 'Dictionary')!
      expect(btn.hasAttribute('disabled')).toBe(true)
    })

    it('disables Explain when isStreaming is true', () => {
      mountMenu({ isStreaming: true })
      const buttons = getBody().querySelectorAll('.context-menu-btn')
      const btn = Array.from(buttons).find(b => b.textContent === 'Explain')!
      expect(btn.hasAttribute('disabled')).toBe(true)
    })

    it('disables Summary when isStreaming is true', () => {
      mountMenu({ isStreaming: true })
      const buttons = getBody().querySelectorAll('.context-menu-btn')
      const btn = Array.from(buttons).find(b => b.textContent === 'Summary')!
      expect(btn.hasAttribute('disabled')).toBe(true)
    })
  })

  describe('note button label', () => {
    it('shows "Add Note" when no existing item', () => {
      mountMenu({ highlightId: null })
      const buttons = Array.from(getBody().querySelectorAll('.context-menu-btn'))
      const btn = buttons.find(b => b.textContent?.includes('Note'))
      expect(btn?.textContent).toBe('Add Note')
    })

    it('shows "Add Note" when has existing item but no note', () => {
      mountMenu({ highlightId: 'hl-1', hasNote: false })
      const buttons = Array.from(getBody().querySelectorAll('.context-menu-btn'))
      const btn = buttons.find(b => b.textContent?.includes('Note'))
      expect(btn?.textContent).toBe('Add Note')
    })

    it('shows "Edit Note" when has existing item and note', () => {
      mountMenu({ highlightId: 'hl-1', hasNote: true })
      const buttons = Array.from(getBody().querySelectorAll('.context-menu-btn'))
      const btn = buttons.find(b => b.textContent?.includes('Note'))
      expect(btn?.textContent).toBe('Edit Note')
    })
  })

  describe('readOnly mode', () => {
    it('shows Copy, Dictionary, Explain, and Summary in readOnly mode', () => {
      mountMenu({ readOnly: true })
      const buttons = Array.from(getBody().querySelectorAll('.context-menu-btn')).map(b => b.textContent)
      expect(buttons).toEqual(['Copy', 'Dictionary', 'Explain', 'Summary'])
    })

    it('does not show Highlight or Note in readOnly mode', () => {
      mountMenu({ readOnly: true })
      const buttons = Array.from(getBody().querySelectorAll('.context-menu-btn')).map(b => b.textContent)
      expect(buttons).not.toContain('Highlight')
      expect(buttons).not.toContain('Add Note')
      expect(buttons).not.toContain('Remove')
    })
  })

  describe('cleanup', () => {
    it('removes keydown listener on unmount', () => {
      const removeSpy = vi.spyOn(document, 'removeEventListener')
      const w = mountMenu()
      w.unmount()
      expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
    })
  })
})
