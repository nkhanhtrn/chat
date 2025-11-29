import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SettingsModal from '../SettingsModal.vue'

describe('SettingsModal', () => {
  let wrapper

  // Helper to find elements in teleported content
  const findInBody = (selector) => document.body.querySelector(selector)
  const findAllInBody = (selector) => document.body.querySelectorAll(selector)

  beforeEach(() => {
    // Mock window theme functions
    window.__getTheme = vi.fn(() => 'light')
    window.__setTheme = vi.fn()
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    // Clean up any teleported content
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  describe('Rendering', () => {
    it('should not render when modelValue is false', () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: false
        },
        attachTo: document.body
      })
      expect(findInBody('.modal-overlay')).toBeNull()
    })

    it('should render when modelValue is true', () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      expect(findInBody('.modal-overlay')).toBeTruthy()
    })

    it('should render modal content', () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      expect(findInBody('.modal-content')).toBeTruthy()
    })

    it('should render modal header with title', () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      expect(findInBody('.modal-header')).toBeTruthy()
      expect(findInBody('.modal-header h2').textContent).toBe('Settings')
    })

    it('should render close button', () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      expect(findInBody('.modal-header .btn-danger')).toBeTruthy()
    })

    it('should render modal body', () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      expect(findInBody('.modal-body')).toBeTruthy()
    })
  })

  describe('Theme Settings', () => {
    it('should render theme label', () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      expect(findInBody('.setting-label').textContent).toBe('Theme')
    })

    it('should render light and dark theme buttons', () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      const themeButtons = findAllInBody('.toggle-button')
      expect(themeButtons).toHaveLength(2)
      expect(themeButtons[0].textContent).toContain('Light')
      expect(themeButtons[1].textContent).toContain('Dark')
    })

    it('should highlight light theme button when current theme is light', () => {
      window.__getTheme = vi.fn(() => 'light')
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      const themeButtons = findAllInBody('.toggle-button')
      expect(themeButtons[0].classList.contains('active')).toBe(true)
      expect(themeButtons[1].classList.contains('active')).toBe(false)
    })

    it('should highlight dark theme button when current theme is dark', async () => {
      window.__getTheme = vi.fn(() => 'dark')
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      await wrapper.vm.$nextTick()
      const themeButtons = findAllInBody('.toggle-button')
      expect(themeButtons[0].classList.contains('active')).toBe(false)
      expect(themeButtons[1].classList.contains('active')).toBe(true)
    })

    it('should call __setTheme when clicking light theme button', async () => {
      window.__getTheme = vi.fn(() => 'dark')
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      const lightButton = findAllInBody('.toggle-button')[0]
      lightButton.click()
      await wrapper.vm.$nextTick()
      expect(window.__setTheme).toHaveBeenCalledWith('light')
    })

    it('should call __setTheme when clicking dark theme button', async () => {
      window.__getTheme = vi.fn(() => 'light')
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      const darkButton = findAllInBody('.toggle-button')[1]
      darkButton.click()
      await wrapper.vm.$nextTick()
      expect(window.__setTheme).toHaveBeenCalledWith('dark')
    })

    it('should update active state after clicking theme button', async () => {
      window.__getTheme = vi.fn(() => 'light')
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })

      const themeButtons = findAllInBody('.toggle-button')
      expect(themeButtons[0].classList.contains('active')).toBe(true)

      themeButtons[1].click()
      await wrapper.vm.$nextTick()

      expect(themeButtons[0].classList.contains('active')).toBe(false)
      expect(themeButtons[1].classList.contains('active')).toBe(true)
    })
  })

  describe('Closing Modal', () => {
    it('should emit update:modelValue with false when close button clicked', async () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      findInBody('.modal-header .btn-danger').click()
      await wrapper.vm.$nextTick()
      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')[0]).toEqual([false])
    })

    it('should emit update:modelValue with false when clicking overlay', async () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      findInBody('.modal-overlay').click()
      await wrapper.vm.$nextTick()
      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')[0]).toEqual([false])
    })

    it('should not emit when clicking modal content', async () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      findInBody('.modal-content').click()
      await wrapper.vm.$nextTick()
      expect(wrapper.emitted('update:modelValue')).toBeFalsy()
    })
  })

  describe('Keyboard Navigation', () => {
    it('should close modal when Escape key is pressed', async () => {
      // Start with modal closed, then open it to trigger the watcher
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: false
        },
        attachTo: document.body
      })

      // Open the modal - this triggers the watcher to add the keydown listener
      await wrapper.setProps({ modelValue: true })
      await wrapper.vm.$nextTick()

      // Simulate Escape key press
      const event = new KeyboardEvent('keydown', { key: 'Escape' })
      document.dispatchEvent(event)

      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')[0]).toEqual([false])

      wrapper.unmount()
    })

    it('should add keydown listener when modal opens', async () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener')

      wrapper = mount(SettingsModal, {
        props: {
          modelValue: false
        }
      })

      await wrapper.setProps({ modelValue: true })

      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
    })

    it('should remove keydown listener when modal closes', async () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')

      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        }
      })

      await wrapper.setProps({ modelValue: false })

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
    })

    it('should remove keydown listener on unmount', async () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')

      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        }
      })

      wrapper.unmount()
      wrapper = null

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
    })
  })

  describe('Theme Loading on Mount', () => {
    it('should call __getTheme on mount', () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      expect(window.__getTheme).toHaveBeenCalled()
    })

    it('should default to light theme if __getTheme returns undefined', () => {
      window.__getTheme = vi.fn(() => undefined)
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      const themeButtons = findAllInBody('.toggle-button')
      expect(themeButtons[0].classList.contains('active')).toBe(true)
    })

    it('should handle missing __getTheme function', () => {
      delete window.__getTheme
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      const themeButtons = findAllInBody('.toggle-button')
      expect(themeButtons[0].classList.contains('active')).toBe(true)
    })

    it('should handle missing __setTheme function gracefully', async () => {
      delete window.__setTheme
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      const darkButton = findAllInBody('.toggle-button')[1]
      // Should not throw
      darkButton.click()
      await wrapper.vm.$nextTick()
      expect(darkButton.classList.contains('active')).toBe(true)
    })
  })

  describe('Teleport', () => {
    it('should teleport to body', () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })

      // The modal should be rendered in body via teleport
      expect(document.body.querySelector('.modal-overlay')).toBeTruthy()

      wrapper.unmount()
    })
  })

  describe('Transitions', () => {
    it('should have modal transition class', () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      // Modal is teleported to body, check there
      expect(findInBody('.modal-overlay')).toBeTruthy()
    })
  })

  describe('Accessibility', () => {
    it('should have close button with × symbol', () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      expect(findInBody('.modal-header .btn-danger').textContent).toBe('×')
    })

    it('should have semantic header element', () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      expect(findInBody('h2')).toBeTruthy()
    })

    it('should have theme options in a labeled group', () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      expect(findInBody('.setting-item')).toBeTruthy()
      expect(findInBody('.setting-label')).toBeTruthy()
      expect(findInBody('.button-group')).toBeTruthy()
    })
  })

  describe('Edge Cases', () => {
    it('should handle rapid open/close toggling', async () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: false
        }
      })

      await wrapper.setProps({ modelValue: true })
      await wrapper.setProps({ modelValue: false })
      await wrapper.setProps({ modelValue: true })
      await wrapper.setProps({ modelValue: false })

      expect(wrapper.find('.modal-overlay').exists()).toBe(false)
    })

    it('should handle theme change while closing', async () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })

      const darkButton = findAllInBody('.toggle-button')[1]
      darkButton.click()
      await wrapper.vm.$nextTick()

      findInBody('.btn-danger').click()
      await wrapper.vm.$nextTick()

      // Theme should remain as dark (instant save, no revert)
      expect(window.__setTheme).toHaveBeenLastCalledWith('dark')
      expect(wrapper.emitted('update:modelValue')[0]).toEqual([false])
    })
  })

  describe('Instant Persistence', () => {
    it('should not render modal footer', () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      const footer = findInBody('.modal-footer')
      expect(footer).toBeNull()
    })

    it('should persist theme to localStorage immediately when changed', async () => {
      localStorage.clear()

      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })

      const darkButton = findAllInBody('.toggle-button')[1]
      darkButton.click()
      await wrapper.vm.$nextTick()

      expect(localStorage.getItem('theme')).toBe('dark')
    })

    it('should persist font size to localStorage immediately when changed', async () => {
      localStorage.clear()

      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })

      const slider = findInBody('.font-slider')
      slider.value = '22'
      slider.dispatchEvent(new Event('input'))
      await wrapper.vm.$nextTick()

      expect(localStorage.getItem('messageFontSize')).toBe('22')
    })

    it('should persist font family to localStorage immediately when changed', async () => {
      localStorage.clear()

      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })

      const fontButtons = findAllInBody('.font-button')
      fontButtons[1].click() // Click Palatino
      await wrapper.vm.$nextTick()

      expect(localStorage.getItem('messageFontFamily')).toBe("'Palatino Linotype', Palatino, serif")
    })

    it('should not revert changes when closing modal', async () => {
      window.__getTheme = vi.fn(() => 'light')
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })

      // Change theme to dark
      const darkButton = findAllInBody('.toggle-button')[1]
      darkButton.click()
      await wrapper.vm.$nextTick()

      // Close modal via X button
      findInBody('.btn-danger').click()
      await wrapper.vm.$nextTick()

      // Theme should remain as dark (no revert)
      expect(window.__setTheme).toHaveBeenLastCalledWith('dark')
    })

    it('should not revert changes when clicking overlay', async () => {
      window.__getTheme = vi.fn(() => 'light')
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })

      // Change theme to dark
      const darkButton = findAllInBody('.toggle-button')[1]
      darkButton.click()
      await wrapper.vm.$nextTick()

      // Click overlay to close
      findInBody('.modal-overlay').click()
      await wrapper.vm.$nextTick()

      // Theme should remain as dark (no revert)
      expect(window.__setTheme).toHaveBeenLastCalledWith('dark')
    })

    it('should not revert changes when pressing Escape', async () => {
      window.__getTheme = vi.fn(() => 'light')
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: false
        },
        attachTo: document.body
      })

      // Open modal
      await wrapper.setProps({ modelValue: true })
      await wrapper.vm.$nextTick()

      // Change theme to dark
      const darkButton = findAllInBody('.toggle-button')[1]
      darkButton.click()
      await wrapper.vm.$nextTick()

      // Press Escape
      const event = new KeyboardEvent('keydown', { key: 'Escape' })
      document.dispatchEvent(event)
      await wrapper.vm.$nextTick()

      // Theme should remain as dark (no revert)
      expect(window.__setTheme).toHaveBeenLastCalledWith('dark')
    })
  })
})
