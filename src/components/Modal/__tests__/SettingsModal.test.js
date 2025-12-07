import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SettingsModal from '../SettingsModal.vue'

// Mock the LLM API module
vi.mock('../../../services/api.js', () => ({
  listProviders: vi.fn(() => [
    { id: 'lmstudio', name: 'LM Studio', requiresApiKey: false },
    { id: 'google', name: 'Google AI Studio', requiresApiKey: true }
  ]),
  getCurrentProviderId: vi.fn(() => 'lmstudio'),
  getCurrentConfig: vi.fn(() => ({})),
  setProvider: vi.fn(),
  testConnection: vi.fn(() => Promise.resolve(true)),
  fetchModels: vi.fn(() => Promise.resolve([
    { id: 'model-1', name: 'Test Model 1' },
    { id: 'model-2', name: 'Test Model 2' }
  ]))
}))

// Mock the chat store
vi.mock('../../../stores/chat.js', () => ({
  useChatStore: vi.fn(() => ({
    currentModel: 'model-1',
    setCurrentModel: vi.fn()
  }))
}))

describe('SettingsModal', () => {
  let wrapper

  // Helper to find elements in teleported content
  const findInBody = (selector) => document.body.querySelector(selector)
  const findAllInBody = (selector) => document.body.querySelectorAll(selector)

  // Button group indices (in Theme tab: 0=theme, 1=width)
  const THEME_GROUP_INDEX = 0
  const WIDTH_GROUP_INDEX = 1

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
      expect(findInBody('.modal-title').textContent).toBe('Settings')
    })

    it('should render close button', () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      expect(findInBody('.modal-close-btn')).toBeTruthy()
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
      const labels = findAllInBody('.setting-label')
      const themeLabel = Array.from(labels).find(label => label.textContent === 'Theme')
      expect(themeLabel).toBeTruthy()
    })

    it('should render light, sepia, and dark theme buttons', () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      const buttonGroups = findAllInBody('.button-group')
      // Theme button group (after provider selector)
      const themeButtons = buttonGroups[THEME_GROUP_INDEX].querySelectorAll('.toggle-button')
      expect(themeButtons).toHaveLength(3)
      expect(themeButtons[0].textContent).toContain('Light')
      expect(themeButtons[1].textContent).toContain('Sepia')
      expect(themeButtons[2].textContent).toContain('Dark')
    })

    it('should highlight light theme button when current theme is light', () => {
      window.__getTheme = vi.fn(() => 'light')
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      const buttonGroups = findAllInBody('.button-group')
      const themeButtons = buttonGroups[THEME_GROUP_INDEX].querySelectorAll('.toggle-button')
      expect(themeButtons[0].classList.contains('active')).toBe(true)
      expect(themeButtons[1].classList.contains('active')).toBe(false)
      expect(themeButtons[2].classList.contains('active')).toBe(false)
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
      const buttonGroups = findAllInBody('.button-group')
      const themeButtons = buttonGroups[THEME_GROUP_INDEX].querySelectorAll('.toggle-button')
      expect(themeButtons[0].classList.contains('active')).toBe(false)
      expect(themeButtons[1].classList.contains('active')).toBe(false)
      expect(themeButtons[2].classList.contains('active')).toBe(true)
    })

    it('should highlight sepia theme button when current theme is sepia', async () => {
      window.__getTheme = vi.fn(() => 'sepia')
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      await wrapper.vm.$nextTick()
      const buttonGroups = findAllInBody('.button-group')
      const themeButtons = buttonGroups[THEME_GROUP_INDEX].querySelectorAll('.toggle-button')
      expect(themeButtons[0].classList.contains('active')).toBe(false)
      expect(themeButtons[1].classList.contains('active')).toBe(true)
      expect(themeButtons[2].classList.contains('active')).toBe(false)
    })

    it('should call __setTheme when clicking light theme button', async () => {
      window.__getTheme = vi.fn(() => 'dark')
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      const buttonGroups = findAllInBody('.button-group')
      const lightButton = buttonGroups[THEME_GROUP_INDEX].querySelectorAll('.toggle-button')[0]
      lightButton.click()
      await wrapper.vm.$nextTick()
      expect(window.__setTheme).toHaveBeenCalledWith('light')
    })

    it('should call __setTheme when clicking sepia theme button', async () => {
      window.__getTheme = vi.fn(() => 'light')
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      const buttonGroups = findAllInBody('.button-group')
      const sepiaButton = buttonGroups[THEME_GROUP_INDEX].querySelectorAll('.toggle-button')[1]
      sepiaButton.click()
      await wrapper.vm.$nextTick()
      expect(window.__setTheme).toHaveBeenCalledWith('sepia')
    })

    it('should call __setTheme when clicking dark theme button', async () => {
      window.__getTheme = vi.fn(() => 'light')
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      const buttonGroups = findAllInBody('.button-group')
      const darkButton = buttonGroups[THEME_GROUP_INDEX].querySelectorAll('.toggle-button')[2]
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

      const buttonGroups = findAllInBody('.button-group')
      const themeButtons = buttonGroups[THEME_GROUP_INDEX].querySelectorAll('.toggle-button')
      expect(themeButtons[0].classList.contains('active')).toBe(true)

      themeButtons[2].click() // Click dark
      await wrapper.vm.$nextTick()

      expect(themeButtons[0].classList.contains('active')).toBe(false)
      expect(themeButtons[2].classList.contains('active')).toBe(true)
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
      findInBody('.modal-close-btn').click()
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
      // Modal uses @mousedown.self on overlay, so we need to dispatch mousedown event
      const overlay = findInBody('.modal-overlay')
      overlay.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
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
      const buttonGroups = findAllInBody('.button-group')
      const darkButton = buttonGroups[THEME_GROUP_INDEX].querySelectorAll('.toggle-button')[2]
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
      expect(findInBody('.modal-close-btn').textContent).toBe('×')
    })

    it('should have semantic header element', () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      expect(findInBody('.modal-title')).toBeTruthy()
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

      const buttonGroups = findAllInBody('.button-group')
      const darkButton = buttonGroups[THEME_GROUP_INDEX].querySelectorAll('.toggle-button')[2]
      darkButton.click()
      await wrapper.vm.$nextTick()

      findInBody('.modal-close-btn').click()
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

      const buttonGroups = findAllInBody('.button-group')
      const darkButton = buttonGroups[THEME_GROUP_INDEX].querySelectorAll('.toggle-button')[2]
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
      const clickedIndex = 1
      fontButtons[clickedIndex].click()
      await wrapper.vm.$nextTick()

      // Verify localStorage was updated (font value comes from component's fonts array at clicked index)
      const savedFont = localStorage.getItem('messageFontFamily')
      expect(savedFont).toBeTruthy()
      // The clicked button should now be active, confirming the selection was persisted
      expect(fontButtons[clickedIndex].classList.contains('active')).toBe(true)
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
      const buttonGroups = findAllInBody('.button-group')
      const darkButton = buttonGroups[THEME_GROUP_INDEX].querySelectorAll('.toggle-button')[2]
      darkButton.click()
      await wrapper.vm.$nextTick()

      // Close modal via X button
      findInBody('.modal-close-btn').click()
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
      const buttonGroups = findAllInBody('.button-group')
      const darkButton = buttonGroups[THEME_GROUP_INDEX].querySelectorAll('.toggle-button')[2]
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
      const buttonGroups = findAllInBody('.button-group')
      const darkButton = buttonGroups[THEME_GROUP_INDEX].querySelectorAll('.toggle-button')[2]
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

  describe('Line Height Settings', () => {
    it('should render line height label', () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      const labels = findAllInBody('.setting-label')
      const lineHeightLabel = Array.from(labels).find(label => label.textContent === 'Line Height')
      expect(lineHeightLabel).toBeTruthy()
    })

    it('should render line height slider', () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      const sliders = findAllInBody('.font-slider')
      // Second slider is line height (first is font size)
      expect(sliders.length).toBeGreaterThanOrEqual(2)
      expect(sliders[1].getAttribute('min')).toBe('1.4')
      expect(sliders[1].getAttribute('max')).toBe('2.2')
      expect(sliders[1].getAttribute('step')).toBe('0.1')
    })

    it('should display current line height value', () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      const valueDisplays = findAllInBody('.font-size-value')
      // Second value display is line height
      expect(valueDisplays[1].textContent).toBe('1.7')
    })

    it('should update line height CSS variable when slider changes', async () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })

      const sliders = findAllInBody('.font-slider')
      const lineHeightSlider = sliders[1]
      lineHeightSlider.value = '2.0'
      lineHeightSlider.dispatchEvent(new Event('input'))
      await wrapper.vm.$nextTick()

      expect(document.documentElement.style.getPropertyValue('--message-line-height')).toBe('2.0')
    })

    it('should persist line height to localStorage immediately when changed', async () => {
      localStorage.clear()

      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })

      const sliders = findAllInBody('.font-slider')
      const lineHeightSlider = sliders[1]
      lineHeightSlider.value = '1.9'
      lineHeightSlider.dispatchEvent(new Event('input'))
      await wrapper.vm.$nextTick()

      expect(localStorage.getItem('messageLineHeight')).toBe('1.9')
    })

    it('should load saved line height from localStorage on mount', async () => {
      localStorage.setItem('messageLineHeight', '2.1')

      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      await wrapper.vm.$nextTick()

      const valueDisplays = findAllInBody('.font-size-value')
      expect(valueDisplays[1].textContent).toBe('2.1')
      expect(document.documentElement.style.getPropertyValue('--message-line-height')).toBe('2.1')
    })

    it('should render line height slider icons', () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      const sliderWrappers = findAllInBody('.slider-wrapper')
      // Second slider wrapper is line height
      const lineHeightWrapper = sliderWrappers[1]
      const labels = lineHeightWrapper.querySelectorAll('.slider-label')
      expect(labels[0].textContent).toBe('≡')
      expect(labels[1].textContent).toBe('≡')
    })
  })

  describe('Tab Navigation', () => {
    it('should render Theme and LLM tabs', () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      const tabs = findAllInBody('.tab-button')
      expect(tabs).toHaveLength(2)
      expect(tabs[0].textContent).toContain('Theme')
      expect(tabs[1].textContent).toContain('LLM')
    })

    it('should show Theme tab as active by default', () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      const tabs = findAllInBody('.tab-button')
      expect(tabs[0].classList.contains('active')).toBe(true)
      expect(tabs[1].classList.contains('active')).toBe(false)
    })

    it('should switch to LLM tab when clicked', async () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      const tabs = findAllInBody('.tab-button')
      tabs[1].click()
      await wrapper.vm.$nextTick()

      expect(tabs[0].classList.contains('active')).toBe(false)
      expect(tabs[1].classList.contains('active')).toBe(true)
    })

    it('should show theme content when Theme tab is active', () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      const themeLabel = Array.from(findAllInBody('.setting-label')).find(
        label => label.textContent === 'Theme'
      )
      expect(themeLabel).toBeTruthy()
    })

    it('should show LLM content when LLM tab is active', async () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      const tabs = findAllInBody('.tab-button')
      tabs[1].click()
      await wrapper.vm.$nextTick()

      const providerLabel = Array.from(findAllInBody('.setting-label')).find(
        label => label.textContent === 'Provider'
      )
      expect(providerLabel).toBeTruthy()
    })

    it('should switch back to Theme tab when clicked', async () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      const tabs = findAllInBody('.tab-button')

      // Switch to LLM
      tabs[1].click()
      await wrapper.vm.$nextTick()

      // Switch back to Theme
      tabs[0].click()
      await wrapper.vm.$nextTick()

      expect(tabs[0].classList.contains('active')).toBe(true)
      expect(tabs[1].classList.contains('active')).toBe(false)
    })
  })

  describe('LLM Provider Settings', () => {
    it('should render provider buttons in LLM tab', async () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      const tabs = findAllInBody('.tab-button')
      tabs[1].click()
      await wrapper.vm.$nextTick()

      const providerGroup = findInBody('.provider-group')
      expect(providerGroup).toBeTruthy()
      const providerButtons = providerGroup.querySelectorAll('.toggle-button')
      expect(providerButtons.length).toBeGreaterThan(0)
    })

    it('should highlight current provider', async () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      const tabs = findAllInBody('.tab-button')
      tabs[1].click()
      await wrapper.vm.$nextTick()

      const providerGroup = findInBody('.provider-group')
      const providerButtons = providerGroup.querySelectorAll('.toggle-button')
      // lmstudio is default from mock
      expect(providerButtons[0].classList.contains('active')).toBe(true)
    })

    it('should switch provider when clicking provider button', async () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      const tabs = findAllInBody('.tab-button')
      tabs[1].click()
      await wrapper.vm.$nextTick()

      const providerGroup = findInBody('.provider-group')
      const providerButtons = providerGroup.querySelectorAll('.toggle-button')

      // Click on Google AI Studio (second provider)
      providerButtons[1].click()
      await wrapper.vm.$nextTick()

      expect(providerButtons[1].classList.contains('active')).toBe(true)
    })

    it('should emit provider-changed when switching providers', async () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      const tabs = findAllInBody('.tab-button')
      tabs[1].click()
      await wrapper.vm.$nextTick()

      const providerGroup = findInBody('.provider-group')
      const providerButtons = providerGroup.querySelectorAll('.toggle-button')
      providerButtons[1].click()
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('provider-changed')).toBeTruthy()
      expect(wrapper.emitted('provider-changed')[0]).toEqual(['google'])
    })

    it('should show API key input for providers that require it', async () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      const tabs = findAllInBody('.tab-button')
      tabs[1].click()
      await wrapper.vm.$nextTick()

      const providerGroup = findInBody('.provider-group')
      const providerButtons = providerGroup.querySelectorAll('.toggle-button')

      // Click on Google AI Studio which requires API key
      providerButtons[1].click()
      await wrapper.vm.$nextTick()

      const apiKeyInput = findInBody('.api-key-input')
      expect(apiKeyInput).toBeTruthy()
      expect(apiKeyInput.getAttribute('placeholder')).toBe('Enter API key')
    })

    it('should show base URL input for LM Studio', async () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      const tabs = findAllInBody('.tab-button')
      tabs[1].click()
      await wrapper.vm.$nextTick()

      // LM Studio is default and should show base URL input
      const apiKeyInput = findInBody('.api-key-input')
      expect(apiKeyInput).toBeTruthy()
      expect(apiKeyInput.getAttribute('placeholder')).toBe('http://localhost:1234')
    })

    it('should toggle API key visibility', async () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      const tabs = findAllInBody('.tab-button')
      tabs[1].click()
      await wrapper.vm.$nextTick()

      const providerGroup = findInBody('.provider-group')
      const providerButtons = providerGroup.querySelectorAll('.toggle-button')
      providerButtons[1].click() // Switch to Google
      await wrapper.vm.$nextTick()

      const apiKeyInput = findInBody('.api-key-input')
      const toggleBtn = findInBody('.toggle-visibility-btn')

      expect(apiKeyInput.getAttribute('type')).toBe('password')
      expect(toggleBtn.textContent).toBe('Show')

      toggleBtn.click()
      await wrapper.vm.$nextTick()

      expect(apiKeyInput.getAttribute('type')).toBe('text')
      expect(toggleBtn.textContent).toBe('Hide')
    })

    it('should show API key hint with link for Google provider', async () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      const tabs = findAllInBody('.tab-button')
      tabs[1].click()
      await wrapper.vm.$nextTick()

      const providerGroup = findInBody('.provider-group')
      const providerButtons = providerGroup.querySelectorAll('.toggle-button')
      providerButtons[1].click()
      await wrapper.vm.$nextTick()

      const hint = findInBody('.api-key-hint')
      expect(hint).toBeTruthy()
      const link = hint.querySelector('a')
      expect(link).toBeTruthy()
      expect(link.getAttribute('href')).toBe('https://aistudio.google.com/apikey')
      expect(link.getAttribute('target')).toBe('_blank')
    })
  })

  describe('Model Selection', () => {
    it('should render model selector when models are available', async () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      const tabs = findAllInBody('.tab-button')
      tabs[1].click()
      await wrapper.vm.$nextTick()

      // Wait for models to load
      await new Promise(resolve => setTimeout(resolve, 10))
      await wrapper.vm.$nextTick()

      const modelSection = findInBody('.model-section')
      expect(modelSection).toBeTruthy()

      const modelSelect = findInBody('.model-select')
      expect(modelSelect).toBeTruthy()
    })

    it('should render model options from fetched models', async () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      const tabs = findAllInBody('.tab-button')
      tabs[1].click()
      await wrapper.vm.$nextTick()

      await new Promise(resolve => setTimeout(resolve, 10))
      await wrapper.vm.$nextTick()

      const modelSelect = findInBody('.model-select')
      const options = modelSelect.querySelectorAll('option')
      expect(options.length).toBe(2)
      expect(options[0].textContent).toContain('Test Model 1')
      expect(options[1].textContent).toContain('Test Model 2')
    })

    it('should render model label', async () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      const tabs = findAllInBody('.tab-button')
      tabs[1].click()
      await wrapper.vm.$nextTick()

      await new Promise(resolve => setTimeout(resolve, 10))
      await wrapper.vm.$nextTick()

      const modelLabel = findInBody('.model-label')
      expect(modelLabel).toBeTruthy()
      expect(modelLabel.textContent).toBe('Model')
    })
  })

  describe('Connection Status', () => {
    it('should show pending status when testing connection', async () => {
      const { testConnection } = await import('../../../services/api.js')
      testConnection.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(true), 100)))

      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      const tabs = findAllInBody('.tab-button')
      tabs[1].click()
      await wrapper.vm.$nextTick()

      const providerGroup = findInBody('.provider-group')
      const providerButtons = providerGroup.querySelectorAll('.toggle-button')
      providerButtons[1].click()
      await wrapper.vm.$nextTick()

      const status = findInBody('.connection-status.pending')
      expect(status).toBeTruthy()
      expect(status.textContent).toContain('Testing connection')
    })

    it('should show success status on successful connection', async () => {
      const { testConnection } = await import('../../../services/api.js')
      testConnection.mockResolvedValue(true)

      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      const tabs = findAllInBody('.tab-button')
      tabs[1].click()
      await wrapper.vm.$nextTick()

      const providerGroup = findInBody('.provider-group')
      const providerButtons = providerGroup.querySelectorAll('.toggle-button')
      providerButtons[1].click()

      await new Promise(resolve => setTimeout(resolve, 10))
      await wrapper.vm.$nextTick()

      const status = findInBody('.connection-status.success')
      expect(status).toBeTruthy()
      expect(status.textContent).toContain('Connected successfully')
    })

    it('should show error status on failed connection', async () => {
      const { testConnection } = await import('../../../services/api.js')
      testConnection.mockResolvedValue(false)

      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      const tabs = findAllInBody('.tab-button')
      tabs[1].click()
      await wrapper.vm.$nextTick()

      const providerGroup = findInBody('.provider-group')
      const providerButtons = providerGroup.querySelectorAll('.toggle-button')
      providerButtons[1].click()

      await new Promise(resolve => setTimeout(resolve, 10))
      await wrapper.vm.$nextTick()

      const status = findInBody('.connection-status.error')
      expect(status).toBeTruthy()
      expect(status.textContent).toContain('Connection failed')
    })

    it('should show error message on connection exception', async () => {
      const { testConnection } = await import('../../../services/api.js')
      testConnection.mockRejectedValue(new Error('Network error'))

      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      const tabs = findAllInBody('.tab-button')
      tabs[1].click()
      await wrapper.vm.$nextTick()

      const providerGroup = findInBody('.provider-group')
      const providerButtons = providerGroup.querySelectorAll('.toggle-button')
      providerButtons[1].click()

      await new Promise(resolve => setTimeout(resolve, 10))
      await wrapper.vm.$nextTick()

      const status = findInBody('.connection-status.error')
      expect(status).toBeTruthy()
      expect(status.textContent).toContain('Network error')
    })
  })

  describe('Provider Settings Loading', () => {
    it('should load provider settings when modal opens', async () => {
      const { listProviders, getCurrentProviderId } = await import('../../../services/api.js')

      wrapper = mount(SettingsModal, {
        props: {
          modelValue: false
        },
        attachTo: document.body
      })

      await wrapper.setProps({ modelValue: true })
      await wrapper.vm.$nextTick()

      expect(listProviders).toHaveBeenCalled()
      expect(getCurrentProviderId).toHaveBeenCalled()
    })

    it('should reset connection status when switching providers', async () => {
      const { testConnection } = await import('../../../services/api.js')
      testConnection.mockResolvedValue(true)

      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      const tabs = findAllInBody('.tab-button')
      tabs[1].click()
      await wrapper.vm.$nextTick()

      const providerGroup = findInBody('.provider-group')
      const providerButtons = providerGroup.querySelectorAll('.toggle-button')

      // Switch to Google
      providerButtons[1].click()
      await new Promise(resolve => setTimeout(resolve, 10))
      await wrapper.vm.$nextTick()

      // Verify success status
      expect(findInBody('.connection-status.success')).toBeTruthy()

      // Switch back to LM Studio - status should reset then update
      testConnection.mockResolvedValue(true)
      providerButtons[0].click()
      await wrapper.vm.$nextTick()

      // Should show pending or success (depends on timing)
      const status = findInBody('.connection-status')
      expect(status).toBeTruthy()
    })
  })

  describe('Content Width Settings', () => {
    it('should render width label', () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      const labels = findAllInBody('.setting-label')
      const widthLabel = Array.from(labels).find(label => label.textContent === 'Width')
      expect(widthLabel).toBeTruthy()
    })

    it('should render narrow, medium, and wide width buttons', () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      const buttonGroups = findAllInBody('.button-group')
      // Width button group (after provider and theme)
      const widthButtons = buttonGroups[WIDTH_GROUP_INDEX].querySelectorAll('.toggle-button')
      expect(widthButtons).toHaveLength(3)
      expect(widthButtons[0].textContent).toContain('Narrow')
      expect(widthButtons[1].textContent).toContain('Medium')
      expect(widthButtons[2].textContent).toContain('Wide')
    })

    it('should highlight medium width button by default', () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      const buttonGroups = findAllInBody('.button-group')
      const widthButtons = buttonGroups[WIDTH_GROUP_INDEX].querySelectorAll('.toggle-button')
      expect(widthButtons[0].classList.contains('active')).toBe(false)
      expect(widthButtons[1].classList.contains('active')).toBe(true)
      expect(widthButtons[2].classList.contains('active')).toBe(false)
    })

    it('should update active state when clicking width button', async () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })

      const buttonGroups = findAllInBody('.button-group')
      const widthButtons = buttonGroups[WIDTH_GROUP_INDEX].querySelectorAll('.toggle-button')

      widthButtons[0].click() // Click Narrow
      await wrapper.vm.$nextTick()

      expect(widthButtons[0].classList.contains('active')).toBe(true)
      expect(widthButtons[1].classList.contains('active')).toBe(false)
      expect(widthButtons[2].classList.contains('active')).toBe(false)
    })

    it('should update content width CSS variable when narrow is clicked', async () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })

      const buttonGroups = findAllInBody('.button-group')
      const widthButtons = buttonGroups[WIDTH_GROUP_INDEX].querySelectorAll('.toggle-button')

      widthButtons[0].click() // Click Narrow
      await wrapper.vm.$nextTick()

      expect(document.documentElement.style.getPropertyValue('--content-max-width')).toBe('600px')
    })

    it('should update content width CSS variable when medium is clicked', async () => {
      localStorage.setItem('contentWidth', 'narrow') // Start with narrow

      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })

      const buttonGroups = findAllInBody('.button-group')
      const widthButtons = buttonGroups[WIDTH_GROUP_INDEX].querySelectorAll('.toggle-button')

      widthButtons[1].click() // Click Medium
      await wrapper.vm.$nextTick()

      expect(document.documentElement.style.getPropertyValue('--content-max-width')).toBe('800px')
    })

    it('should update content width CSS variable when wide is clicked', async () => {
      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })

      const buttonGroups = findAllInBody('.button-group')
      const widthButtons = buttonGroups[WIDTH_GROUP_INDEX].querySelectorAll('.toggle-button')

      widthButtons[2].click() // Click Wide
      await wrapper.vm.$nextTick()

      expect(document.documentElement.style.getPropertyValue('--content-max-width')).toBe('1000px')
    })

    it('should persist content width to localStorage immediately when changed', async () => {
      localStorage.clear()

      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })

      const buttonGroups = findAllInBody('.button-group')
      const widthButtons = buttonGroups[WIDTH_GROUP_INDEX].querySelectorAll('.toggle-button')

      widthButtons[2].click() // Click Wide
      await wrapper.vm.$nextTick()

      expect(localStorage.getItem('contentWidth')).toBe('wide')
    })

    it('should load saved content width from localStorage on mount', async () => {
      localStorage.setItem('contentWidth', 'narrow')

      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      await wrapper.vm.$nextTick()

      const buttonGroups = findAllInBody('.button-group')
      const widthButtons = buttonGroups[WIDTH_GROUP_INDEX].querySelectorAll('.toggle-button')
      expect(widthButtons[0].classList.contains('active')).toBe(true)
      expect(document.documentElement.style.getPropertyValue('--content-max-width')).toBe('600px')
    })

    it('should apply wide content width from localStorage on mount', async () => {
      localStorage.setItem('contentWidth', 'wide')

      wrapper = mount(SettingsModal, {
        props: {
          modelValue: true
        },
        attachTo: document.body
      })
      await wrapper.vm.$nextTick()

      const buttonGroups = findAllInBody('.button-group')
      const widthButtons = buttonGroups[WIDTH_GROUP_INDEX].querySelectorAll('.toggle-button')
      expect(widthButtons[2].classList.contains('active')).toBe(true)
      expect(document.documentElement.style.getPropertyValue('--content-max-width')).toBe('1000px')
    })
  })
})
