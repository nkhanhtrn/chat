import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import QuestionSearchModal from '../QuestionSearchModal.vue'
import { useChatStore } from '../../stores/chat.js'

describe('QuestionSearchModal', () => {
  let wrapper
  let root
  let pinia
  let chatStore

  const createStoreWithMessages = () => {
    chatStore = useChatStore()

    // Add root messages
    chatStore.messagesById = {
      'root-1': {
        id: 'root-1',
        question: 'What is JavaScript?',
        questionSummarized: 'What is JavaScript?',
        response: 'JavaScript is a programming language.',
        childIds: ['child-1'],
        parentId: null
      },
      'child-1': {
        id: 'child-1',
        question: 'How do closures work?',
        questionSummarized: 'How do closures work?',
        response: 'Closures capture their environment.',
        childIds: ['grandchild-1'],
        parentId: 'root-1'
      },
      'grandchild-1': {
        id: 'grandchild-1',
        question: 'What about memory leaks?',
        questionSummarized: 'What about memory leaks?',
        response: 'Memory leaks can occur.',
        childIds: [],
        parentId: 'child-1'
      },
      'root-2': {
        id: 'root-2',
        question: 'What is TypeScript?',
        questionSummarized: 'What is TypeScript?',
        response: 'TypeScript is a typed superset of JavaScript.',
        childIds: [],
        parentId: null
      }
    }
    chatStore.rootMessageIds = ['root-1', 'root-2']

    return chatStore
  }

  beforeEach(() => {
    root = document.createElement('div')
    document.body.appendChild(root)
    pinia = createPinia()
    setActivePinia(pinia)
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
      wrapper = null
    }
    document.body.innerHTML = ''
  })

  describe('Rendering', () => {
    it('renders modal when visible is true', () => {
      createStoreWithMessages()
      wrapper = mount(QuestionSearchModal, {
        props: { visible: true },
        global: { plugins: [pinia] },
        attachTo: root
      })

      const modal = document.body.querySelector('.modal-content')
      expect(modal).toBeTruthy()
    })

    it('does not render modal when visible is false', () => {
      createStoreWithMessages()
      wrapper = mount(QuestionSearchModal, {
        props: { visible: false },
        global: { plugins: [pinia] },
        attachTo: root
      })

      const modal = document.body.querySelector('.modal-content')
      expect(modal).toBeFalsy()
    })

    it('renders search input', () => {
      createStoreWithMessages()
      wrapper = mount(QuestionSearchModal, {
        props: { visible: true },
        global: { plugins: [pinia] },
        attachTo: root
      })

      const input = document.body.querySelector('.search-input')
      expect(input).toBeTruthy()
      expect(input.placeholder).toBe('Search for a question...')
    })

    it('shows empty state when no search query', () => {
      createStoreWithMessages()
      wrapper = mount(QuestionSearchModal, {
        props: { visible: true },
        global: { plugins: [pinia] },
        attachTo: root
      })

      const emptyState = document.body.querySelector('.empty-state')
      expect(emptyState).toBeTruthy()
      expect(emptyState.textContent.trim()).toBe('Type to search for questions')
    })

    it('renders Cancel button in footer', () => {
      createStoreWithMessages()
      wrapper = mount(QuestionSearchModal, {
        props: { visible: true },
        global: { plugins: [pinia] },
        attachTo: root
      })

      const footer = document.body.querySelector('.modal-footer')
      expect(footer).toBeTruthy()
      const cancelBtn = footer.querySelector('button')
      expect(cancelBtn.textContent).toBe('Cancel')
    })
  })

  describe('Search functionality', () => {
    it('shows results when typing a search query', async () => {
      createStoreWithMessages()
      wrapper = mount(QuestionSearchModal, {
        props: { visible: true },
        global: { plugins: [pinia] },
        attachTo: root
      })

      const input = document.body.querySelector('.search-input')
      input.value = 'JavaScript'
      input.dispatchEvent(new Event('input'))
      await wrapper.vm.$nextTick()

      const results = document.body.querySelectorAll('.result-item')
      expect(results.length).toBeGreaterThan(0)
    })

    it('shows "No questions found" when query matches nothing', async () => {
      createStoreWithMessages()
      wrapper = mount(QuestionSearchModal, {
        props: { visible: true },
        global: { plugins: [pinia] },
        attachTo: root
      })

      const input = document.body.querySelector('.search-input')
      input.value = 'xyz123nonexistent'
      input.dispatchEvent(new Event('input'))
      await wrapper.vm.$nextTick()

      const emptyState = document.body.querySelector('.empty-state')
      expect(emptyState).toBeTruthy()
      expect(emptyState.textContent.trim()).toBe('No questions found')
    })

    it('searches through child messages', async () => {
      createStoreWithMessages()
      wrapper = mount(QuestionSearchModal, {
        props: { visible: true },
        global: { plugins: [pinia] },
        attachTo: root
      })

      const input = document.body.querySelector('.search-input')
      input.value = 'closures'
      input.dispatchEvent(new Event('input'))
      await wrapper.vm.$nextTick()

      const results = document.body.querySelectorAll('.result-item')
      expect(results.length).toBe(1)
      expect(results[0].querySelector('.result-text').textContent).toContain('closures')
    })

    it('displays ancestor breadcrumbs for nested results', async () => {
      createStoreWithMessages()
      wrapper = mount(QuestionSearchModal, {
        props: { visible: true },
        global: { plugins: [pinia] },
        attachTo: root
      })

      const input = document.body.querySelector('.search-input')
      input.value = 'memory'
      input.dispatchEvent(new Event('input'))
      await wrapper.vm.$nextTick()

      const results = document.body.querySelectorAll('.result-item')
      expect(results.length).toBe(1)

      const ancestors = results[0].querySelector('.result-ancestors')
      expect(ancestors).toBeTruthy()
      expect(ancestors.textContent).toContain('JavaScript')
      expect(ancestors.textContent).toContain('closures')
    })

    it('clears search query when modal becomes visible', async () => {
      createStoreWithMessages()
      wrapper = mount(QuestionSearchModal, {
        props: { visible: true },
        global: { plugins: [pinia] },
        attachTo: root
      })

      // Type something
      const input = document.body.querySelector('.search-input')
      input.value = 'test'
      input.dispatchEvent(new Event('input'))
      await wrapper.vm.$nextTick()

      // Hide and show modal
      await wrapper.setProps({ visible: false })
      await wrapper.setProps({ visible: true })

      // Query should be cleared
      const newInput = document.body.querySelector('.search-input')
      expect(newInput.value).toBe('')
    })
  })

  describe('Selection', () => {
    it('emits select event with targetMessageId when clicking a result', async () => {
      createStoreWithMessages()
      wrapper = mount(QuestionSearchModal, {
        props: { visible: true },
        global: { plugins: [pinia] },
        attachTo: root
      })

      const input = document.body.querySelector('.search-input')
      input.value = 'TypeScript'
      input.dispatchEvent(new Event('input'))
      await wrapper.vm.$nextTick()

      const result = document.body.querySelector('.result-item')
      await result.click()

      expect(wrapper.emitted('select')).toBeTruthy()
      expect(wrapper.emitted('select')[0][0]).toEqual({
        targetMessageId: 'root-2',
        targetText: 'What is TypeScript?'
      })
    })

    it('emits select event when pressing Enter on focused result', async () => {
      createStoreWithMessages()
      wrapper = mount(QuestionSearchModal, {
        props: { visible: true },
        global: { plugins: [pinia] },
        attachTo: root
      })

      const input = document.body.querySelector('.search-input')
      input.value = 'TypeScript'
      input.dispatchEvent(new Event('input'))
      await wrapper.vm.$nextTick()

      // Press Enter
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('select')).toBeTruthy()
    })

    it('does not emit select when pressing Enter with no results', async () => {
      createStoreWithMessages()
      wrapper = mount(QuestionSearchModal, {
        props: { visible: true },
        global: { plugins: [pinia] },
        attachTo: root
      })

      const input = document.body.querySelector('.search-input')
      input.value = 'nonexistent123'
      input.dispatchEvent(new Event('input'))
      await wrapper.vm.$nextTick()

      // Press Enter
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('select')).toBeFalsy()
    })
  })

  describe('Keyboard navigation', () => {
    it('focuses next result when pressing Down arrow', async () => {
      createStoreWithMessages()
      wrapper = mount(QuestionSearchModal, {
        props: { visible: true },
        global: { plugins: [pinia] },
        attachTo: root
      })

      const input = document.body.querySelector('.search-input')
      input.value = 'What'
      input.dispatchEvent(new Event('input'))
      await wrapper.vm.$nextTick()

      // Initial state - first result should be focused
      let results = document.body.querySelectorAll('.result-item')
      expect(results[0].classList.contains('focused')).toBe(true)

      // Press Down arrow
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
      await wrapper.vm.$nextTick()

      results = document.body.querySelectorAll('.result-item')
      expect(results[1].classList.contains('focused')).toBe(true)
    })

    it('focuses previous result when pressing Up arrow', async () => {
      createStoreWithMessages()
      wrapper = mount(QuestionSearchModal, {
        props: { visible: true },
        global: { plugins: [pinia] },
        attachTo: root
      })

      const input = document.body.querySelector('.search-input')
      input.value = 'What'
      input.dispatchEvent(new Event('input'))
      await wrapper.vm.$nextTick()

      // Press Down to move to second item
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
      await wrapper.vm.$nextTick()

      // Press Up to go back
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }))
      await wrapper.vm.$nextTick()

      const results = document.body.querySelectorAll('.result-item')
      expect(results[0].classList.contains('focused')).toBe(true)
    })

    it('wraps around when pressing Down on last result', async () => {
      createStoreWithMessages()
      wrapper = mount(QuestionSearchModal, {
        props: { visible: true },
        global: { plugins: [pinia] },
        attachTo: root
      })

      const input = document.body.querySelector('.search-input')
      input.value = 'What is' // Should match only root questions
      input.dispatchEvent(new Event('input'))
      await wrapper.vm.$nextTick()

      const results = document.body.querySelectorAll('.result-item')
      const resultCount = results.length

      // Press Down enough times to wrap
      for (let i = 0; i < resultCount; i++) {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
        await wrapper.vm.$nextTick()
      }

      // Should wrap to first
      const updatedResults = document.body.querySelectorAll('.result-item')
      expect(updatedResults[0].classList.contains('focused')).toBe(true)
    })

    it('wraps around when pressing Up on first result', async () => {
      createStoreWithMessages()
      wrapper = mount(QuestionSearchModal, {
        props: { visible: true },
        global: { plugins: [pinia] },
        attachTo: root
      })

      const input = document.body.querySelector('.search-input')
      input.value = 'What is'
      input.dispatchEvent(new Event('input'))
      await wrapper.vm.$nextTick()

      // First result is focused, press Up
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }))
      await wrapper.vm.$nextTick()

      const results = document.body.querySelectorAll('.result-item')
      // Should wrap to last
      expect(results[results.length - 1].classList.contains('focused')).toBe(true)
    })

    it('selects focused item when pressing Enter', async () => {
      createStoreWithMessages()
      wrapper = mount(QuestionSearchModal, {
        props: { visible: true },
        global: { plugins: [pinia] },
        attachTo: root
      })

      const input = document.body.querySelector('.search-input')
      input.value = 'What is'
      input.dispatchEvent(new Event('input'))
      await wrapper.vm.$nextTick()

      // Navigate to second result
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
      await wrapper.vm.$nextTick()

      // Press Enter
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('select')).toBeTruthy()
      expect(wrapper.emitted('select')[0][0].targetMessageId).toBe('root-2')
    })
  })

  describe('Cancel behavior', () => {
    it('emits cancel when clicking Cancel button', async () => {
      createStoreWithMessages()
      wrapper = mount(QuestionSearchModal, {
        props: { visible: true },
        global: { plugins: [pinia] },
        attachTo: root
      })

      const footer = document.body.querySelector('.modal-footer')
      const cancelBtn = footer.querySelector('button')
      await cancelBtn.click()

      expect(wrapper.emitted('cancel')).toBeTruthy()
    })

    it('emits cancel when pressing Escape', async () => {
      createStoreWithMessages()
      wrapper = mount(QuestionSearchModal, {
        props: { visible: true },
        global: { plugins: [pinia] },
        attachTo: root
      })

      const input = document.body.querySelector('.search-input')
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('cancel')).toBeTruthy()
    })

    it('emits cancel when clicking modal backdrop', async () => {
      createStoreWithMessages()
      wrapper = mount(QuestionSearchModal, {
        props: { visible: true },
        global: { plugins: [pinia] },
        attachTo: root
      })

      const overlay = document.body.querySelector('.modal-overlay')
      // Simulate clicking on backdrop (not on modal content)
      overlay.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('cancel')).toBeTruthy()
    })
  })

  describe('Focus behavior', () => {
    it('focuses search input when modal opens', async () => {
      createStoreWithMessages()
      wrapper = mount(QuestionSearchModal, {
        props: { visible: false },
        global: { plugins: [pinia] },
        attachTo: root
      })

      await wrapper.setProps({ visible: true })
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))

      const input = document.body.querySelector('.search-input')
      expect(document.activeElement).toBe(input)
    })

    it('resets focused index when results change', async () => {
      createStoreWithMessages()
      wrapper = mount(QuestionSearchModal, {
        props: { visible: true },
        global: { plugins: [pinia] },
        attachTo: root
      })

      const input = document.body.querySelector('.search-input')
      input.value = 'What'
      input.dispatchEvent(new Event('input'))
      await wrapper.vm.$nextTick()

      // Navigate down
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
      await wrapper.vm.$nextTick()

      // Change search query
      input.value = 'TypeScript'
      input.dispatchEvent(new Event('input'))
      await wrapper.vm.$nextTick()

      // First result should be focused again
      const results = document.body.querySelectorAll('.result-item')
      expect(results[0].classList.contains('focused')).toBe(true)
    })

    it('updates focused index on mouse hover', async () => {
      createStoreWithMessages()
      wrapper = mount(QuestionSearchModal, {
        props: { visible: true },
        global: { plugins: [pinia] },
        attachTo: root
      })

      const input = document.body.querySelector('.search-input')
      input.value = 'What'
      input.dispatchEvent(new Event('input'))
      await wrapper.vm.$nextTick()

      const results = document.body.querySelectorAll('.result-item')

      // Hover over second result
      results[1].dispatchEvent(new MouseEvent('mouseenter'))
      await wrapper.vm.$nextTick()

      expect(results[1].classList.contains('focused')).toBe(true)
      expect(results[0].classList.contains('focused')).toBe(false)
    })
  })

  describe('Multi-word search', () => {
    it('matches when all words are present', async () => {
      createStoreWithMessages()
      wrapper = mount(QuestionSearchModal, {
        props: { visible: true },
        global: { plugins: [pinia] },
        attachTo: root
      })

      const input = document.body.querySelector('.search-input')
      input.value = 'What JavaScript'
      input.dispatchEvent(new Event('input'))
      await wrapper.vm.$nextTick()

      const results = document.body.querySelectorAll('.result-item')
      expect(results.length).toBe(1)
      expect(results[0].querySelector('.result-text').textContent).toContain('JavaScript')
    })

    it('does not match when not all words are present', async () => {
      createStoreWithMessages()
      wrapper = mount(QuestionSearchModal, {
        props: { visible: true },
        global: { plugins: [pinia] },
        attachTo: root
      })

      const input = document.body.querySelector('.search-input')
      input.value = 'JavaScript Python'
      input.dispatchEvent(new Event('input'))
      await wrapper.vm.$nextTick()

      const emptyState = document.body.querySelector('.empty-state')
      expect(emptyState).toBeTruthy()
      expect(emptyState.textContent.trim()).toBe('No questions found')
    })
  })
})
