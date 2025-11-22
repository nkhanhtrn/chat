import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ApiConfigModal from '../ApiConfigModal.vue'

describe('ApiConfigModal', () => {
  let wrapper

  beforeEach(() => {
    // Clean up any previous wrappers
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Rendering', () => {
    it('should not render when show is false', () => {
      wrapper = mount(ApiConfigModal, {
        props: {
          show: false,
          hostname: '',
          port: ''
        }
      })

      expect(wrapper.find('.modal-overlay').exists()).toBe(false)
    })

    it('should render when show is true', () => {
      wrapper = mount(ApiConfigModal, {
        props: {
          show: true,
          hostname: '',
          port: ''
        }
      })

      expect(wrapper.find('.modal-overlay').exists()).toBe(true)
      expect(wrapper.find('.modal').exists()).toBe(true)
      expect(wrapper.find('h2').text()).toBe('LM Studio Server Configuration')
    })

    it('should render input fields with labels', () => {
      wrapper = mount(ApiConfigModal, {
        props: {
          show: true,
          hostname: '',
          port: ''
        }
      })

      const hostnameLabel = wrapper.find('label[for="hostname"]')
      const portLabel = wrapper.find('label[for="port"]')
      const hostnameInput = wrapper.find('#hostname')
      const portInput = wrapper.find('#port')

      expect(hostnameLabel.text()).toBe('Hostname:')
      expect(portLabel.text()).toBe('Port:')
      expect(hostnameInput.exists()).toBe(true)
      expect(portInput.exists()).toBe(true)
    })

    it('should display correct placeholders', () => {
      wrapper = mount(ApiConfigModal, {
        props: {
          show: true,
          hostname: '',
          port: ''
        }
      })

      const hostnameInput = wrapper.find('#hostname')
      const portInput = wrapper.find('#port')

      expect(hostnameInput.attributes('placeholder')).toBe('localhost')
      expect(portInput.attributes('placeholder')).toBe('1234')
    })
  })

  describe('Props', () => {
    it('should display hostname prop value', () => {
      wrapper = mount(ApiConfigModal, {
        props: {
          show: true,
          hostname: 'example.com',
          port: ''
        }
      })

      const hostnameInput = wrapper.find('#hostname')
      expect(hostnameInput.element.value).toBe('example.com')
    })

    it('should display port prop value', () => {
      wrapper = mount(ApiConfigModal, {
        props: {
          show: true,
          hostname: '',
          port: '8080'
        }
      })

      const portInput = wrapper.find('#port')
      expect(portInput.element.value).toBe('8080')
    })

    it('should update input values when props change', async () => {
      wrapper = mount(ApiConfigModal, {
        props: {
          show: true,
          hostname: 'localhost',
          port: '1234'
        }
      })

      await wrapper.setProps({
        hostname: 'newhost',
        port: '5678'
      })

      const hostnameInput = wrapper.find('#hostname')
      const portInput = wrapper.find('#port')

      expect(hostnameInput.element.value).toBe('newhost')
      expect(portInput.element.value).toBe('5678')
    })
  })

  describe('User Interactions', () => {
    it('should update local values when typing', async () => {
      wrapper = mount(ApiConfigModal, {
        props: {
          show: true,
          hostname: '',
          port: ''
        }
      })

      const hostnameInput = wrapper.find('#hostname')
      const portInput = wrapper.find('#port')

      await hostnameInput.setValue('test.com')
      await portInput.setValue('9999')

      expect(hostnameInput.element.value).toBe('test.com')
      expect(portInput.element.value).toBe('9999')
    })

    it('should emit save event when save button is clicked', async () => {
      wrapper = mount(ApiConfigModal, {
        props: {
          show: true,
          hostname: 'localhost',
          port: '1234'
        }
      })

      const hostnameInput = wrapper.find('#hostname')
      const portInput = wrapper.find('#port')

      await hostnameInput.setValue('newhost.com')
      await portInput.setValue('8080')

      const saveButton = wrapper.find('.modal-btn')
      await saveButton.trigger('click')

      expect(wrapper.emitted('save')).toBeTruthy()
      expect(wrapper.emitted('save')[0]).toEqual([
        {
          hostname: 'newhost.com',
          port: '8080'
        }
      ])
    })

    it('should emit save event when Enter is pressed in hostname input', async () => {
      wrapper = mount(ApiConfigModal, {
        props: {
          show: true,
          hostname: 'localhost',
          port: '1234'
        }
      })

      const hostnameInput = wrapper.find('#hostname')
      await hostnameInput.setValue('test.com')
      await hostnameInput.trigger('keydown.enter')

      expect(wrapper.emitted('save')).toBeTruthy()
      expect(wrapper.emitted('save')[0]).toEqual([
        {
          hostname: 'test.com',
          port: '1234'
        }
      ])
    })

    it('should emit save event when Enter is pressed in port input', async () => {
      wrapper = mount(ApiConfigModal, {
        props: {
          show: true,
          hostname: 'localhost',
          port: '1234'
        }
      })

      const portInput = wrapper.find('#port')
      await portInput.setValue('8080')
      await portInput.trigger('keydown.enter')

      expect(wrapper.emitted('save')).toBeTruthy()
      expect(wrapper.emitted('save')[0]).toEqual([
        {
          hostname: 'localhost',
          port: '8080'
        }
      ])
    })

    it('should emit close event when close button is clicked', async () => {
      wrapper = mount(ApiConfigModal, {
        props: {
          show: true,
          hostname: '',
          port: ''
        }
      })

      const closeButton = wrapper.find('.modal-close-btn')
      await closeButton.trigger('click')

      expect(wrapper.emitted('close')).toBeTruthy()
      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('should emit close event when clicking outside the modal', async () => {
      wrapper = mount(ApiConfigModal, {
        props: {
          show: true,
          hostname: '',
          port: ''
        }
      })

      const overlay = wrapper.find('.modal-overlay')
      await overlay.trigger('click')

      expect(wrapper.emitted('close')).toBeTruthy()
      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('should not emit close when clicking inside the modal', async () => {
      wrapper = mount(ApiConfigModal, {
        props: {
          show: true,
          hostname: '',
          port: ''
        }
      })

      const modal = wrapper.find('.modal')
      await modal.trigger('click')

      expect(wrapper.emitted('close')).toBeFalsy()
    })
  })

  describe('Keyboard Events', () => {
    it('should emit close event when Escape key is pressed', async () => {
      wrapper = mount(ApiConfigModal, {
        props: {
          show: true,
          hostname: '',
          port: ''
        },
        attachTo: document.body
      })

      // Simulate Escape key press
      const event = new KeyboardEvent('keydown', { key: 'Escape' })
      window.dispatchEvent(event)

      // Wait for Vue to process the event
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('close')).toBeTruthy()
      
      wrapper.unmount()
    })

    it('should not emit close when Escape is pressed and show is false', async () => {
      wrapper = mount(ApiConfigModal, {
        props: {
          show: false,
          hostname: '',
          port: ''
        },
        attachTo: document.body
      })

      // Simulate Escape key press
      const event = new KeyboardEvent('keydown', { key: 'Escape' })
      window.dispatchEvent(event)

      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('close')).toBeFalsy()
      
      wrapper.unmount()
    })

    it('should not emit close when other keys are pressed', async () => {
      wrapper = mount(ApiConfigModal, {
        props: {
          show: true,
          hostname: '',
          port: ''
        },
        attachTo: document.body
      })

      // Simulate other key presses
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' })
      const spaceEvent = new KeyboardEvent('keydown', { key: ' ' })
      
      window.dispatchEvent(enterEvent)
      window.dispatchEvent(spaceEvent)

      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('close')).toBeFalsy()
      
      wrapper.unmount()
    })
  })

  describe('Event Cleanup', () => {
    it('should remove keydown listener when component is unmounted', async () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

      wrapper = mount(ApiConfigModal, {
        props: {
          show: true,
          hostname: '',
          port: ''
        }
      })

      wrapper.unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
      
      removeEventListenerSpy.mockRestore()
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty values', async () => {
      wrapper = mount(ApiConfigModal, {
        props: {
          show: true,
          hostname: '',
          port: ''
        }
      })

      const saveButton = wrapper.find('.modal-btn')
      await saveButton.trigger('click')

      expect(wrapper.emitted('save')).toBeTruthy()
      expect(wrapper.emitted('save')[0]).toEqual([
        {
          hostname: '',
          port: ''
        }
      ])
    })

    it('should preserve input values when modal is hidden and shown again', async () => {
      wrapper = mount(ApiConfigModal, {
        props: {
          show: true,
          hostname: 'localhost',
          port: '1234'
        }
      })

      const hostnameInput = wrapper.find('#hostname')
      await hostnameInput.setValue('test.com')

      await wrapper.setProps({ show: false })
      await wrapper.setProps({ show: true })

      const newHostnameInput = wrapper.find('#hostname')
      expect(newHostnameInput.element.value).toBe('test.com')
    })
  })
})
