import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import DevToolbar from '../DevToolbar.vue'

// Mock the storage module
vi.mock('../../services/storage.js', () => ({
  clearAllStorage: vi.fn()
}))

import { clearAllStorage } from '../../services/storage.js'

describe('DevToolbar', () => {
  let wrapper

  // Mock window.confirm and window.location.reload
  const originalConfirm = window.confirm
  const originalReload = window.location.reload

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Mock window.confirm
    window.confirm = vi.fn()

    // Mock window.location.reload
    delete window.location
    window.location = { reload: vi.fn() }

    if (wrapper) {
      wrapper.unmount()
    }
  })

  afterEach(() => {
    // Restore original functions
    window.confirm = originalConfirm
    window.location.reload = originalReload

    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Rendering', () => {
    it('should render the dev toolbar container', () => {
      wrapper = mount(DevToolbar)
      expect(wrapper.find('.dev-toolbar').exists()).toBe(true)
    })

    it('should render the reset localStorage button', () => {
      wrapper = mount(DevToolbar)
      const button = wrapper.find('.dev-button')
      expect(button.exists()).toBe(true)
      expect(button.text()).toBe('Reset localStorage')
    })

    it('should have correct title attribute on button', () => {
      wrapper = mount(DevToolbar)
      const button = wrapper.find('.dev-button')
      expect(button.attributes('title')).toBe('Clear localStorage cache')
    })
  })

  describe('Clear Cache Functionality', () => {
    it('should call confirm when reset button is clicked', async () => {
      window.confirm.mockReturnValue(false)
      wrapper = mount(DevToolbar)

      const button = wrapper.find('.dev-button')
      await button.trigger('click')

      expect(window.confirm).toHaveBeenCalledTimes(1)
      expect(window.confirm).toHaveBeenCalledWith(
        'Are you sure you want to clear all localStorage cache? This will delete all your chat history.'
      )
    })

    it('should not clear storage when user cancels confirmation', async () => {
      window.confirm.mockReturnValue(false)
      wrapper = mount(DevToolbar)

      const button = wrapper.find('.dev-button')
      await button.trigger('click')

      expect(clearAllStorage).not.toHaveBeenCalled()
      expect(window.location.reload).not.toHaveBeenCalled()
    })

    it('should clear storage and reload when user confirms', async () => {
      window.confirm.mockReturnValue(true)
      wrapper = mount(DevToolbar)

      const button = wrapper.find('.dev-button')
      await button.trigger('click')

      expect(clearAllStorage).toHaveBeenCalledTimes(1)
      expect(window.location.reload).toHaveBeenCalledTimes(1)
    })

    it('should clear storage before reloading the page', async () => {
      window.confirm.mockReturnValue(true)
      const callOrder = []

      clearAllStorage.mockImplementation(() => {
        callOrder.push('clearStorage')
      })

      window.location.reload = vi.fn(() => {
        callOrder.push('reload')
      })

      wrapper = mount(DevToolbar)

      const button = wrapper.find('.dev-button')
      await button.trigger('click')

      expect(callOrder).toEqual(['clearStorage', 'reload'])
    })
  })

  describe('Error Handling', () => {
    it('should not reload if clearAllStorage throws an error', async () => {
      window.confirm.mockReturnValue(true)
      clearAllStorage.mockImplementation(() => {
        throw new Error('Storage error')
      })

      wrapper = mount(DevToolbar)

      const button = wrapper.find('.dev-button')

      // Should throw error
      await expect(async () => {
        await button.trigger('click')
      }).rejects.toThrow('Storage error')

      // Reload should not have been called
      expect(window.location.reload).not.toHaveBeenCalled()
    })
  })
})
