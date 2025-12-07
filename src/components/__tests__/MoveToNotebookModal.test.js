import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import MoveToNotebookModal from '../MoveToNotebookModal.vue'

describe('MoveToNotebookModal', () => {
  let wrapper
  let root

  const mockNotebooks = [
    { id: 'notebook-1', title: 'JavaScript Notes', messageCount: 5 },
    { id: 'notebook-2', title: 'TypeScript Guide', messageCount: 3 },
    { id: 'notebook-3', title: 'React Tutorial', messageCount: 8 },
    { id: 'current', title: 'Current Notebook', messageCount: 2 }
  ]

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

  describe('Rendering', () => {
    it('renders modal when visible is true', () => {
      wrapper = mount(MoveToNotebookModal, {
        props: { visible: true, notebooks: mockNotebooks, currentNotebookId: 'current' },
        attachTo: root
      })

      const modal = document.body.querySelector('.modal-content')
      expect(modal).toBeTruthy()
    })

    it('does not render modal when visible is false', () => {
      wrapper = mount(MoveToNotebookModal, {
        props: { visible: false, notebooks: mockNotebooks, currentNotebookId: 'current' },
        attachTo: root
      })

      const modal = document.body.querySelector('.modal-content')
      expect(modal).toBeFalsy()
    })

    it('renders search input', () => {
      wrapper = mount(MoveToNotebookModal, {
        props: { visible: true, notebooks: mockNotebooks, currentNotebookId: 'current' },
        attachTo: root
      })

      const input = document.body.querySelector('.search-input')
      expect(input).toBeTruthy()
      expect(input.placeholder).toBe('Search notebooks...')
    })

    it('renders "New notebook" option', () => {
      wrapper = mount(MoveToNotebookModal, {
        props: { visible: true, notebooks: mockNotebooks, currentNotebookId: 'current' },
        attachTo: root
      })

      const newNotebookBtn = document.body.querySelector('.new-notebook')
      expect(newNotebookBtn).toBeTruthy()
      expect(newNotebookBtn.textContent).toContain('New notebook')
    })

    it('renders other notebooks excluding current', () => {
      wrapper = mount(MoveToNotebookModal, {
        props: { visible: true, notebooks: mockNotebooks, currentNotebookId: 'current' },
        attachTo: root
      })

      const results = document.body.querySelectorAll('.result-item:not(.new-notebook)')
      expect(results.length).toBe(3) // All except 'current'

      const titles = Array.from(results).map(r => r.textContent.trim())
      expect(titles).toContain('JavaScript Notes')
      expect(titles).toContain('TypeScript Guide')
      expect(titles).toContain('React Tutorial')
      expect(titles).not.toContain('Current Notebook')
    })
  })

  describe('Search functionality', () => {
    it('filters notebooks by search query', async () => {
      wrapper = mount(MoveToNotebookModal, {
        props: { visible: true, notebooks: mockNotebooks, currentNotebookId: 'current' },
        attachTo: root
      })

      const input = document.body.querySelector('.search-input')
      input.value = 'Script'
      input.dispatchEvent(new Event('input'))
      await wrapper.vm.$nextTick()

      const results = document.body.querySelectorAll('.result-item:not(.new-notebook)')
      expect(results.length).toBe(2) // JavaScript Notes, TypeScript Guide
    })

    it('shows "No notebooks found" when query matches nothing', async () => {
      wrapper = mount(MoveToNotebookModal, {
        props: { visible: true, notebooks: mockNotebooks, currentNotebookId: 'current' },
        attachTo: root
      })

      const input = document.body.querySelector('.search-input')
      input.value = 'xyz123nonexistent'
      input.dispatchEvent(new Event('input'))
      await wrapper.vm.$nextTick()

      const emptyState = document.body.querySelector('.empty-state')
      expect(emptyState).toBeTruthy()
      expect(emptyState.textContent.trim()).toBe('No notebooks found')
    })

    it('is case insensitive', async () => {
      wrapper = mount(MoveToNotebookModal, {
        props: { visible: true, notebooks: mockNotebooks, currentNotebookId: 'current' },
        attachTo: root
      })

      const input = document.body.querySelector('.search-input')
      input.value = 'REACT'
      input.dispatchEvent(new Event('input'))
      await wrapper.vm.$nextTick()

      const results = document.body.querySelectorAll('.result-item:not(.new-notebook)')
      expect(results.length).toBe(1)
      expect(results[0].textContent).toContain('React Tutorial')
    })

    it('clears search query when modal becomes visible', async () => {
      wrapper = mount(MoveToNotebookModal, {
        props: { visible: true, notebooks: mockNotebooks, currentNotebookId: 'current' },
        attachTo: root
      })

      const input = document.body.querySelector('.search-input')
      input.value = 'test'
      input.dispatchEvent(new Event('input'))
      await wrapper.vm.$nextTick()

      await wrapper.setProps({ visible: false })
      await wrapper.setProps({ visible: true })

      const newInput = document.body.querySelector('.search-input')
      expect(newInput.value).toBe('')
    })
  })

  describe('Selection', () => {
    it('emits select-new when clicking New notebook', async () => {
      wrapper = mount(MoveToNotebookModal, {
        props: { visible: true, notebooks: mockNotebooks, currentNotebookId: 'current' },
        attachTo: root
      })

      const newNotebookBtn = document.body.querySelector('.new-notebook')
      await newNotebookBtn.click()

      expect(wrapper.emitted('select-new')).toBeTruthy()
    })

    it('emits select-existing with notebook when clicking a notebook', async () => {
      wrapper = mount(MoveToNotebookModal, {
        props: { visible: true, notebooks: mockNotebooks, currentNotebookId: 'current' },
        attachTo: root
      })

      const results = document.body.querySelectorAll('.result-item:not(.new-notebook)')
      await results[0].click()

      expect(wrapper.emitted('select-existing')).toBeTruthy()
      expect(wrapper.emitted('select-existing')[0][0]).toEqual(mockNotebooks[0])
    })

    it('emits select-existing when pressing Enter on focused result', async () => {
      wrapper = mount(MoveToNotebookModal, {
        props: { visible: true, notebooks: mockNotebooks, currentNotebookId: 'current' },
        attachTo: root
      })

      const input = document.body.querySelector('.search-input')
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('select-existing')).toBeTruthy()
    })

    it('does not emit select-existing when pressing Enter with no results', async () => {
      wrapper = mount(MoveToNotebookModal, {
        props: { visible: true, notebooks: mockNotebooks, currentNotebookId: 'current' },
        attachTo: root
      })

      const input = document.body.querySelector('.search-input')
      input.value = 'nonexistent123'
      input.dispatchEvent(new Event('input'))
      await wrapper.vm.$nextTick()

      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('select-existing')).toBeFalsy()
    })
  })

  describe('Keyboard navigation', () => {
    it('focuses next result when pressing Down arrow', async () => {
      wrapper = mount(MoveToNotebookModal, {
        props: { visible: true, notebooks: mockNotebooks, currentNotebookId: 'current' },
        attachTo: root
      })

      const input = document.body.querySelector('.search-input')

      // Initial state - first result should be focused
      let results = document.body.querySelectorAll('.result-item:not(.new-notebook)')
      expect(results[0].classList.contains('focused')).toBe(true)

      // Press Down arrow
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
      await wrapper.vm.$nextTick()

      results = document.body.querySelectorAll('.result-item:not(.new-notebook)')
      expect(results[1].classList.contains('focused')).toBe(true)
    })

    it('focuses previous result when pressing Up arrow', async () => {
      wrapper = mount(MoveToNotebookModal, {
        props: { visible: true, notebooks: mockNotebooks, currentNotebookId: 'current' },
        attachTo: root
      })

      const input = document.body.querySelector('.search-input')

      // Press Down to move to second item
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
      await wrapper.vm.$nextTick()

      // Press Up to go back
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }))
      await wrapper.vm.$nextTick()

      const results = document.body.querySelectorAll('.result-item:not(.new-notebook)')
      expect(results[0].classList.contains('focused')).toBe(true)
    })

    it('wraps around when pressing Down on last result', async () => {
      wrapper = mount(MoveToNotebookModal, {
        props: { visible: true, notebooks: mockNotebooks, currentNotebookId: 'current' },
        attachTo: root
      })

      const input = document.body.querySelector('.search-input')
      const results = document.body.querySelectorAll('.result-item:not(.new-notebook)')
      const resultCount = results.length

      // Press Down enough times to wrap
      for (let i = 0; i < resultCount; i++) {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
        await wrapper.vm.$nextTick()
      }

      // Should wrap to first
      const updatedResults = document.body.querySelectorAll('.result-item:not(.new-notebook)')
      expect(updatedResults[0].classList.contains('focused')).toBe(true)
    })

    it('wraps around when pressing Up on first result', async () => {
      wrapper = mount(MoveToNotebookModal, {
        props: { visible: true, notebooks: mockNotebooks, currentNotebookId: 'current' },
        attachTo: root
      })

      const input = document.body.querySelector('.search-input')

      // First result is focused, press Up
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }))
      await wrapper.vm.$nextTick()

      const results = document.body.querySelectorAll('.result-item:not(.new-notebook)')
      // Should wrap to last
      expect(results[results.length - 1].classList.contains('focused')).toBe(true)
    })
  })

  describe('Cancel behavior', () => {
    it('emits cancel when pressing Escape', async () => {
      wrapper = mount(MoveToNotebookModal, {
        props: { visible: true, notebooks: mockNotebooks, currentNotebookId: 'current' },
        attachTo: root
      })

      const input = document.body.querySelector('.search-input')
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('cancel')).toBeTruthy()
    })

    it('emits cancel when clicking modal backdrop', async () => {
      wrapper = mount(MoveToNotebookModal, {
        props: { visible: true, notebooks: mockNotebooks, currentNotebookId: 'current' },
        attachTo: root
      })

      const overlay = document.body.querySelector('.modal-overlay')
      overlay.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('cancel')).toBeTruthy()
    })
  })

  describe('Focus behavior', () => {
    it('focuses search input when modal opens', async () => {
      wrapper = mount(MoveToNotebookModal, {
        props: { visible: false, notebooks: mockNotebooks, currentNotebookId: 'current' },
        attachTo: root
      })

      await wrapper.setProps({ visible: true })
      await wrapper.vm.$nextTick()
      await new Promise(resolve => setTimeout(resolve, 10))

      const input = document.body.querySelector('.search-input')
      expect(document.activeElement).toBe(input)
    })

    it('resets focused index when results change', async () => {
      wrapper = mount(MoveToNotebookModal, {
        props: { visible: true, notebooks: mockNotebooks, currentNotebookId: 'current' },
        attachTo: root
      })

      const input = document.body.querySelector('.search-input')

      // Navigate down
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
      await wrapper.vm.$nextTick()

      // Change search query
      input.value = 'React'
      input.dispatchEvent(new Event('input'))
      await wrapper.vm.$nextTick()

      // First result should be focused again
      const results = document.body.querySelectorAll('.result-item:not(.new-notebook)')
      expect(results[0].classList.contains('focused')).toBe(true)
    })

    it('updates focused index on mouse hover', async () => {
      wrapper = mount(MoveToNotebookModal, {
        props: { visible: true, notebooks: mockNotebooks, currentNotebookId: 'current' },
        attachTo: root
      })

      const results = document.body.querySelectorAll('.result-item:not(.new-notebook)')

      // Hover over second result
      results[1].dispatchEvent(new MouseEvent('mouseenter'))
      await wrapper.vm.$nextTick()

      expect(results[1].classList.contains('focused')).toBe(true)
      expect(results[0].classList.contains('focused')).toBe(false)
    })
  })

  describe('Edge cases', () => {
    it('handles empty notebooks list', () => {
      wrapper = mount(MoveToNotebookModal, {
        props: { visible: true, notebooks: [], currentNotebookId: 'current' },
        attachTo: root
      })

      const results = document.body.querySelectorAll('.result-item:not(.new-notebook)')
      expect(results.length).toBe(0)

      // New notebook option should still be available
      const newNotebookBtn = document.body.querySelector('.new-notebook')
      expect(newNotebookBtn).toBeTruthy()
    })

    it('handles all notebooks being current', () => {
      wrapper = mount(MoveToNotebookModal, {
        props: {
          visible: true,
          notebooks: [{ id: 'current', title: 'Only Notebook', messageCount: 1 }],
          currentNotebookId: 'current'
        },
        attachTo: root
      })

      const results = document.body.querySelectorAll('.result-item:not(.new-notebook)')
      expect(results.length).toBe(0)
    })

    it('still shows New notebook when no other notebooks exist', () => {
      wrapper = mount(MoveToNotebookModal, {
        props: {
          visible: true,
          notebooks: [{ id: 'current', title: 'Only Notebook', messageCount: 1 }],
          currentNotebookId: 'current'
        },
        attachTo: root
      })

      const newNotebookBtn = document.body.querySelector('.new-notebook')
      expect(newNotebookBtn).toBeTruthy()
    })
  })
})
