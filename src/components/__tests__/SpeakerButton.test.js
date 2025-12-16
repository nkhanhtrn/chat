import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SpeakerButton from '../SpeakerButton.vue'

// Mock the Web Speech API
const mockSpeak = vi.fn()
const mockCancel = vi.fn()
const mockGetVoices = vi.fn(() => [
  { lang: 'en-US', name: 'Google US English' },
  { lang: 'en-GB', name: 'British English' },
  { lang: 'fr-FR', name: 'French' }
])

const mockUtterance = vi.fn(function (text) {
  this.text = text
  this.rate = 1
  this.voice = null
  this.onend = null
  this.onerror = null
})

describe('SpeakerButton', () => {
  let wrapper

  beforeEach(() => {
    // Setup Speech Synthesis mock
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        speak: mockSpeak,
        cancel: mockCancel,
        getVoices: mockGetVoices
      },
      writable: true,
      configurable: true
    })

    global.SpeechSynthesisUtterance = mockUtterance

    // Reset mocks
    mockSpeak.mockClear()
    mockCancel.mockClear()
    mockGetVoices.mockClear()
    mockUtterance.mockClear()
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Rendering', () => {
    it('should render a button element', () => {
      wrapper = mount(SpeakerButton, {
        props: { text: 'hello' }
      })
      expect(wrapper.find('button').exists()).toBe(true)
    })

    it('should render an SVG speaker icon', () => {
      wrapper = mount(SpeakerButton, {
        props: { text: 'hello' }
      })
      expect(wrapper.find('svg').exists()).toBe(true)
      expect(wrapper.find('polygon').exists()).toBe(true)
    })

    it('should have speaker-btn class', () => {
      wrapper = mount(SpeakerButton, {
        props: { text: 'hello' }
      })
      expect(wrapper.classes()).toContain('speaker-btn')
    })
  })

  describe('Size Prop', () => {
    it('should default to medium size', () => {
      wrapper = mount(SpeakerButton, {
        props: { text: 'hello' }
      })
      expect(wrapper.classes()).toContain('medium')
      expect(wrapper.find('svg').attributes('width')).toBe('18')
      expect(wrapper.find('svg').attributes('height')).toBe('18')
    })

    it('should apply small size', () => {
      wrapper = mount(SpeakerButton, {
        props: { text: 'hello', size: 'small' }
      })
      expect(wrapper.classes()).toContain('small')
      expect(wrapper.find('svg').attributes('width')).toBe('14')
      expect(wrapper.find('svg').attributes('height')).toBe('14')
    })

    it('should apply large size', () => {
      wrapper = mount(SpeakerButton, {
        props: { text: 'hello', size: 'large' }
      })
      expect(wrapper.classes()).toContain('large')
      expect(wrapper.find('svg').attributes('width')).toBe('22')
      expect(wrapper.find('svg').attributes('height')).toBe('22')
    })
  })

  describe('Disabled State', () => {
    it('should be disabled when text is empty', () => {
      wrapper = mount(SpeakerButton, {
        props: { text: '' }
      })
      expect(wrapper.attributes('disabled')).toBeDefined()
    })

    it('should be disabled when text is not provided', () => {
      wrapper = mount(SpeakerButton)
      expect(wrapper.attributes('disabled')).toBeDefined()
    })

    it('should not be disabled when text is provided', () => {
      wrapper = mount(SpeakerButton, {
        props: { text: 'hello' }
      })
      expect(wrapper.attributes('disabled')).toBeUndefined()
    })
  })

  describe('Speaking Functionality', () => {
    it('should call speechSynthesis.speak when clicked', async () => {
      wrapper = mount(SpeakerButton, {
        props: { text: 'hello world' }
      })

      await wrapper.trigger('click')

      expect(mockSpeak).toHaveBeenCalledTimes(1)
    })

    it('should create utterance with correct text', async () => {
      wrapper = mount(SpeakerButton, {
        props: { text: 'test phrase' }
      })

      await wrapper.trigger('click')

      expect(mockUtterance).toHaveBeenCalledWith('test phrase')
    })

    it('should set utterance rate to 0.9', async () => {
      wrapper = mount(SpeakerButton, {
        props: { text: 'hello' }
      })

      await wrapper.trigger('click')

      const utteranceInstance = mockUtterance.mock.instances[0]
      expect(utteranceInstance.rate).toBe(0.9)
    })

    it('should cancel any existing speech before speaking', async () => {
      wrapper = mount(SpeakerButton, {
        props: { text: 'hello' }
      })

      await wrapper.trigger('click')

      expect(mockCancel).toHaveBeenCalled()
    })

    it('should add speaking class when speaking', async () => {
      wrapper = mount(SpeakerButton, {
        props: { text: 'hello' }
      })

      await wrapper.trigger('click')

      expect(wrapper.classes()).toContain('speaking')
    })

    it('should be disabled while speaking', async () => {
      wrapper = mount(SpeakerButton, {
        props: { text: 'hello' }
      })

      await wrapper.trigger('click')

      expect(wrapper.attributes('disabled')).toBeDefined()
    })

    it('should not speak when already speaking', async () => {
      wrapper = mount(SpeakerButton, {
        props: { text: 'hello' }
      })

      await wrapper.trigger('click')
      mockSpeak.mockClear()

      // Try clicking again while speaking
      await wrapper.trigger('click')

      expect(mockSpeak).not.toHaveBeenCalled()
    })
  })

  describe('Voice Selection', () => {
    it('should prefer Google voice when available', async () => {
      wrapper = mount(SpeakerButton, {
        props: { text: 'hello' }
      })

      await wrapper.trigger('click')

      const utteranceInstance = mockUtterance.mock.instances[0]
      expect(utteranceInstance.voice).toEqual({ lang: 'en-US', name: 'Google US English' })
    })

    it('should fallback to any English voice when Google not available', async () => {
      mockGetVoices.mockReturnValue([
        { lang: 'en-GB', name: 'British English' },
        { lang: 'fr-FR', name: 'French' }
      ])

      wrapper = mount(SpeakerButton, {
        props: { text: 'hello' }
      })

      await wrapper.trigger('click')

      const utteranceInstance = mockUtterance.mock.instances[0]
      expect(utteranceInstance.voice).toEqual({ lang: 'en-GB', name: 'British English' })
    })

    it('should not set voice if no English voice available', async () => {
      mockGetVoices.mockReturnValue([
        { lang: 'fr-FR', name: 'French' },
        { lang: 'de-DE', name: 'German' }
      ])

      wrapper = mount(SpeakerButton, {
        props: { text: 'hello' }
      })

      await wrapper.trigger('click')

      const utteranceInstance = mockUtterance.mock.instances[0]
      expect(utteranceInstance.voice).toBeNull()
    })
  })

  describe('Speech End Handling', () => {
    it('should remove speaking class when speech ends', async () => {
      wrapper = mount(SpeakerButton, {
        props: { text: 'hello' }
      })

      await wrapper.trigger('click')
      expect(wrapper.classes()).toContain('speaking')

      // Simulate speech end
      const utteranceInstance = mockUtterance.mock.instances[0]
      utteranceInstance.onend()

      await wrapper.vm.$nextTick()
      expect(wrapper.classes()).not.toContain('speaking')
    })

    it('should remove speaking class when speech errors', async () => {
      wrapper = mount(SpeakerButton, {
        props: { text: 'hello' }
      })

      await wrapper.trigger('click')
      expect(wrapper.classes()).toContain('speaking')

      // Simulate speech error
      const utteranceInstance = mockUtterance.mock.instances[0]
      utteranceInstance.onerror()

      await wrapper.vm.$nextTick()
      expect(wrapper.classes()).not.toContain('speaking')
    })

    it('should enable button after speech ends', async () => {
      wrapper = mount(SpeakerButton, {
        props: { text: 'hello' }
      })

      await wrapper.trigger('click')
      expect(wrapper.attributes('disabled')).toBeDefined()

      // Simulate speech end
      const utteranceInstance = mockUtterance.mock.instances[0]
      utteranceInstance.onend()

      await wrapper.vm.$nextTick()
      expect(wrapper.attributes('disabled')).toBeUndefined()
    })
  })

  describe('Stop Method', () => {
    it('should expose stop method', () => {
      wrapper = mount(SpeakerButton, {
        props: { text: 'hello' }
      })

      expect(typeof wrapper.vm.stop).toBe('function')
    })

    it('should cancel speech when stop is called', async () => {
      wrapper = mount(SpeakerButton, {
        props: { text: 'hello' }
      })

      await wrapper.trigger('click')
      mockCancel.mockClear()

      wrapper.vm.stop()

      expect(mockCancel).toHaveBeenCalled()
    })

    it('should remove speaking class when stop is called', async () => {
      wrapper = mount(SpeakerButton, {
        props: { text: 'hello' }
      })

      await wrapper.trigger('click')
      expect(wrapper.classes()).toContain('speaking')

      wrapper.vm.stop()

      await wrapper.vm.$nextTick()
      expect(wrapper.classes()).not.toContain('speaking')
    })
  })

  describe('Title Attribute', () => {
    it('should show "Pronounce" title when not speaking', () => {
      wrapper = mount(SpeakerButton, {
        props: { text: 'hello' }
      })

      expect(wrapper.attributes('title')).toBe('Pronounce')
    })

    it('should show "Speaking..." title when speaking', async () => {
      wrapper = mount(SpeakerButton, {
        props: { text: 'hello' }
      })

      await wrapper.trigger('click')

      expect(wrapper.attributes('title')).toBe('Speaking...')
    })
  })

  describe('No Speech Synthesis Support', () => {
    it('should handle missing speechSynthesis gracefully', async () => {
      // Remove speechSynthesis
      delete window.speechSynthesis

      wrapper = mount(SpeakerButton, {
        props: { text: 'hello' }
      })

      // Should not throw
      await wrapper.trigger('click')

      // Should not have speaking class since it failed
      await wrapper.vm.$nextTick()
      expect(wrapper.classes()).not.toContain('speaking')
    })
  })

  describe('Cleanup on Unmount', () => {
    it('should cancel speech when component is unmounted', async () => {
      wrapper = mount(SpeakerButton, {
        props: { text: 'hello' }
      })

      await wrapper.trigger('click')
      mockCancel.mockClear()

      wrapper.unmount()
      wrapper = null // Prevent afterEach from trying to unmount again

      expect(mockCancel).toHaveBeenCalled()
    })
  })
})
