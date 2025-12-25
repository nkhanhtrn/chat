import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ApiKeyInput from '../ApiKeyInput.vue'

describe('ApiKeyInput', () => {
  let wrapper

  beforeEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Rendering', () => {
    it('should render with default single empty key', () => {
      wrapper = mount(ApiKeyInput)
      expect(wrapper.find('input').exists()).toBe(true)
      expect(wrapper.find('.key-counter').text()).toBe('1/1')
    })

    it('should render with provided keys', () => {
      wrapper = mount(ApiKeyInput, {
        props: {
          modelValue: ['key1', 'key2', 'key3']
        }
      })
      expect(wrapper.find('.key-counter').text()).toBe('1/3')
    })

    it('should display help URL link', () => {
      wrapper = mount(ApiKeyInput, {
        props: {
          helpUrl: 'https://example.com/get-key'
        }
      })
      const link = wrapper.find('a')
      expect(link.attributes('href')).toBe('https://example.com/get-key')
      expect(link.text()).toBe('Get API key')
    })

    it('should render input as password type', () => {
      wrapper = mount(ApiKeyInput)
      expect(wrapper.find('input').attributes('type')).toBe('password')
    })
  })

  describe('Navigation', () => {
    it('should disable prev button on first key', () => {
      wrapper = mount(ApiKeyInput, {
        props: {
          modelValue: ['key1', 'key2']
        }
      })
      const prevBtn = wrapper.findAll('.nav-btn')[0]
      expect(prevBtn.attributes('disabled')).toBeDefined()
    })

    it('should enable prev button when not on first key', async () => {
      wrapper = mount(ApiKeyInput, {
        props: {
          modelValue: ['key1', 'key2']
        }
      })
      // Navigate to second key first
      const nextBtn = wrapper.findAll('.nav-btn')[1]
      await nextBtn.trigger('click')

      const prevBtn = wrapper.findAll('.nav-btn')[0]
      expect(prevBtn.attributes('disabled')).toBeUndefined()
    })

    it('should navigate to next key when clicking next button', async () => {
      wrapper = mount(ApiKeyInput, {
        props: {
          modelValue: ['key1', 'key2', 'key3']
        }
      })

      expect(wrapper.find('.key-counter').text()).toBe('1/3')

      const nextBtn = wrapper.findAll('.nav-btn')[1]
      await nextBtn.trigger('click')

      expect(wrapper.find('.key-counter').text()).toBe('2/3')
    })

    it('should navigate to previous key when clicking prev button', async () => {
      wrapper = mount(ApiKeyInput, {
        props: {
          modelValue: ['key1', 'key2', 'key3']
        }
      })

      // Navigate to second key
      const nextBtn = wrapper.findAll('.nav-btn')[1]
      await nextBtn.trigger('click')
      expect(wrapper.find('.key-counter').text()).toBe('2/3')

      // Navigate back
      const prevBtn = wrapper.findAll('.nav-btn')[0]
      await prevBtn.trigger('click')
      expect(wrapper.find('.key-counter').text()).toBe('1/3')
    })

    it('should show next button when not on last key', () => {
      wrapper = mount(ApiKeyInput, {
        props: {
          modelValue: ['key1', 'key2']
        }
      })
      const buttons = wrapper.findAll('button')
      // Should have: prev, next (not add)
      expect(buttons.length).toBe(2)
      expect(buttons[1].text()).toBe('>')
    })

    it('should show add button instead of next when on last key', async () => {
      wrapper = mount(ApiKeyInput, {
        props: {
          modelValue: ['key1', 'key2']
        }
      })

      // Navigate to last key
      const nextBtn = wrapper.findAll('.nav-btn')[1]
      await nextBtn.trigger('click')

      const buttons = wrapper.findAll('button')
      expect(buttons[1].text()).toBe('+')
    })
  })

  describe('Adding Keys', () => {
    it('should add a new key when clicking add button', async () => {
      wrapper = mount(ApiKeyInput, {
        props: {
          modelValue: ['existing-key']
        }
      })

      const addBtn = wrapper.find('.add-key-btn')
      await addBtn.trigger('click')

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeTruthy()
      expect(emitted[0][0]).toEqual(['existing-key', ''])
    })

    it('should navigate to new key after adding', async () => {
      wrapper = mount(ApiKeyInput, {
        props: {
          modelValue: ['key1']
        }
      })

      const addBtn = wrapper.find('.add-key-btn')
      await addBtn.trigger('click')

      expect(wrapper.find('.key-counter').text()).toBe('2/2')
    })

    it('should disable add button when current key is empty', () => {
      wrapper = mount(ApiKeyInput, {
        props: {
          modelValue: ['']
        }
      })

      const addBtn = wrapper.find('.add-key-btn')
      expect(addBtn.attributes('disabled')).toBeDefined()
    })

    it('should disable add button when current key is whitespace only', () => {
      wrapper = mount(ApiKeyInput, {
        props: {
          modelValue: ['   ']
        }
      })

      const addBtn = wrapper.find('.add-key-btn')
      expect(addBtn.attributes('disabled')).toBeDefined()
    })

    it('should enable add button when current key has content', () => {
      wrapper = mount(ApiKeyInput, {
        props: {
          modelValue: ['valid-key']
        }
      })

      const addBtn = wrapper.find('.add-key-btn')
      expect(addBtn.attributes('disabled')).toBeUndefined()
    })
  })

  describe('Updating Keys', () => {
    it('should emit update when key value changes', async () => {
      wrapper = mount(ApiKeyInput, {
        props: {
          modelValue: ['initial']
        }
      })

      const input = wrapper.find('input')
      await input.setValue('updated-key')

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeTruthy()
      expect(emitted[0][0]).toEqual(['updated-key'])
    })

    it('should update correct key in array', async () => {
      wrapper = mount(ApiKeyInput, {
        props: {
          modelValue: ['key1', 'key2', 'key3']
        }
      })

      // Navigate to second key
      const nextBtn = wrapper.findAll('.nav-btn')[1]
      await nextBtn.trigger('click')

      // Update it
      const input = wrapper.find('input')
      await input.setValue('updated-key2')

      const emitted = wrapper.emitted('update:modelValue')
      expect(emitted).toBeTruthy()
      expect(emitted[0][0]).toEqual(['key1', 'updated-key2', 'key3'])
    })

    it('should display current key value in input', async () => {
      wrapper = mount(ApiKeyInput, {
        props: {
          modelValue: ['first-key', 'second-key']
        }
      })

      expect(wrapper.find('input').element.value).toBe('first-key')

      // Navigate to second
      const nextBtn = wrapper.findAll('.nav-btn')[1]
      await nextBtn.trigger('click')

      expect(wrapper.find('input').element.value).toBe('second-key')
    })
  })

  describe('Props Reactivity', () => {
    it('should update when modelValue prop changes', async () => {
      wrapper = mount(ApiKeyInput, {
        props: {
          modelValue: ['key1']
        }
      })

      expect(wrapper.find('.key-counter').text()).toBe('1/1')

      await wrapper.setProps({ modelValue: ['key1', 'key2', 'key3'] })

      expect(wrapper.find('.key-counter').text()).toBe('1/3')
    })

    it('should adjust index when keys are removed externally', async () => {
      wrapper = mount(ApiKeyInput, {
        props: {
          modelValue: ['key1', 'key2', 'key3']
        }
      })

      // Navigate to third key
      await wrapper.findAll('.nav-btn')[1].trigger('click')
      await wrapper.findAll('.nav-btn')[1].trigger('click')
      expect(wrapper.find('.key-counter').text()).toBe('3/3')

      // Simulate external removal of keys
      await wrapper.setProps({ modelValue: ['key1'] })

      // Index should be adjusted to valid range
      expect(wrapper.find('.key-counter').text()).toBe('1/1')
    })
  })

  describe('Placeholder', () => {
    it('should show correct placeholder for each key position', async () => {
      wrapper = mount(ApiKeyInput, {
        props: {
          modelValue: ['', '', '']
        }
      })

      expect(wrapper.find('input').attributes('placeholder')).toBe('API key 1')

      await wrapper.findAll('.nav-btn')[1].trigger('click')
      expect(wrapper.find('input').attributes('placeholder')).toBe('API key 2')

      await wrapper.findAll('.nav-btn')[1].trigger('click')
      expect(wrapper.find('input').attributes('placeholder')).toBe('API key 3')
    })
  })
})
