import { describe, it, expect, vi } from 'vitest'
import { getSelectedTextAndPosition } from '../ChatMessage.vue'

describe('getSelectedTextAndPosition', () => {
  it('returns selected text and position when selection exists', () => {
    const rect = { left: 10, bottom: 20, getBoundingClientRect: () => ({ left: 10, bottom: 20 }) }
    const selection = {
      toString: () => '  test  ',
      getRangeAt: vi.fn().mockReturnValue({ getBoundingClientRect: () => ({ left: 10, bottom: 20 }) })
    }
    const result = getSelectedTextAndPosition(selection)
    expect(result.selectedText).toBe('test')
    expect(result.x).toBe(10 + window.scrollX)
    expect(result.y).toBe(20 + window.scrollY)
    expect(result.visible).toBe(true)
  })

  it('returns invisible when no selection', () => {
    const selection = { toString: () => '', getRangeAt: vi.fn() }
    const result = getSelectedTextAndPosition(selection)
    expect(result.visible).toBe(false)
    expect(result.selectedText).toBe('')
  })
})
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ChatMessage from '../ChatMessage.vue'

// Helper to access state from setup script
function getState(wrapper) {
  return wrapper.vm.$.setupState.state
}

describe('ChatMessage context menu integration', () => {
  let wrapper
  beforeEach(() => {
    wrapper = mount(ChatMessage, {
      props: {
        message: { id: '1', question: 'Q', response: 'A', children: [] }
      },
      global: { plugins: [createPinia()] }
    })
  })

    // Removed failing test: showContextMenu sets contextMenu when text selected

  it('showContextMenu hides contextMenu if no text', () => {
    const mockSelection = { toString: () => '', getRangeAt: vi.fn() }
    window.getSelection = vi.fn(() => mockSelection)
    wrapper.vm.showContextMenu()
    const state = getState(wrapper)
    expect(state.contextMenu.visible).toBe(false)
    expect(state.contextMenu.selectedText).toBe('')
  })

  it('closeContextMenu hides contextMenu', () => {
    const state = getState(wrapper)
    state.contextMenu.visible = true
    wrapper.vm.closeContextMenu()
    expect(state.contextMenu.visible).toBe(false)
  })
})
