import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import CodeDisplay from '../CodeDisplay.vue'

describe('CodeDisplay', () => {
  let wrapper

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Rendering', () => {
    it('should render the code display container', () => {
      wrapper = mount(CodeDisplay, {
        props: { code: 'const x = 1' }
      })
      expect(wrapper.find('.code-display').exists()).toBe(true)
    })

    it('should render the code content', () => {
      const code = 'function test() { return true; }'
      wrapper = mount(CodeDisplay, {
        props: { code }
      })
      expect(wrapper.find('.code-content code').text()).toBe(code)
    })

    it('should render the language label', () => {
      wrapper = mount(CodeDisplay, {
        props: { code: '{}', language: 'json' }
      })
      expect(wrapper.find('.code-language').text()).toBe('json')
    })

    it('should default language to json', () => {
      wrapper = mount(CodeDisplay, {
        props: { code: '{}' }
      })
      expect(wrapper.find('.code-language').text()).toBe('json')
    })

    it('should render custom language', () => {
      wrapper = mount(CodeDisplay, {
        props: { code: 'print("hi")', language: 'python' }
      })
      expect(wrapper.find('.code-language').text()).toBe('python')
    })

    it('should render the copy button', () => {
      wrapper = mount(CodeDisplay, {
        props: { code: 'test' }
      })
      expect(wrapper.find('.copy-btn').exists()).toBe(true)
    })

    it('should render header section', () => {
      wrapper = mount(CodeDisplay, {
        props: { code: 'test' }
      })
      expect(wrapper.find('.code-header').exists()).toBe(true)
    })
  })

  describe('Copy Functionality', () => {
    let writeTextMock

    beforeEach(() => {
      // Mock clipboard API using vi.stubGlobal
      writeTextMock = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', {
        clipboard: {
          writeText: writeTextMock
        }
      })
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('should copy code when copy button is clicked', async () => {
      const code = 'const data = { key: "value" }'
      wrapper = mount(CodeDisplay, {
        props: { code }
      })

      await wrapper.find('.copy-btn').trigger('click')

      expect(writeTextMock).toHaveBeenCalledWith(code)
    })

    it('should show copy icon initially', () => {
      wrapper = mount(CodeDisplay, {
        props: { code: 'test' }
      })

      const svg = wrapper.find('.copy-btn svg')
      expect(svg.exists()).toBe(true)
      // Copy icon has a rect element
      expect(svg.find('rect').exists()).toBe(true)
    })

    it('should show checkmark icon after copying', async () => {
      vi.useFakeTimers()
      wrapper = mount(CodeDisplay, {
        props: { code: 'test' }
      })

      await wrapper.find('.copy-btn').trigger('click')
      await wrapper.vm.$nextTick()

      const svg = wrapper.find('.copy-btn svg')
      // Checkmark icon has a polyline element
      expect(svg.find('polyline').exists()).toBe(true)

      vi.useRealTimers()
    })

    it('should revert to copy icon after timeout', async () => {
      vi.useFakeTimers()
      wrapper = mount(CodeDisplay, {
        props: { code: 'test' }
      })

      await wrapper.find('.copy-btn').trigger('click')
      await wrapper.vm.$nextTick()

      // Fast-forward 2 seconds
      vi.advanceTimersByTime(2000)
      await wrapper.vm.$nextTick()

      const svg = wrapper.find('.copy-btn svg')
      // Should be back to copy icon with rect
      expect(svg.find('rect').exists()).toBe(true)

      vi.useRealTimers()
    })

    it('should handle clipboard errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      writeTextMock.mockRejectedValue(new Error('Failed'))

      wrapper = mount(CodeDisplay, {
        props: { code: 'test' }
      })

      await wrapper.find('.copy-btn').trigger('click')
      await wrapper.vm.$nextTick()

      expect(consoleSpy).toHaveBeenCalledWith('Failed to copy:', expect.any(Error))
      consoleSpy.mockRestore()
    })
  })

  describe('JSON Display', () => {
    it('should display formatted JSON', () => {
      const jsonObj = { name: 'test', value: 123 }
      const formattedJson = JSON.stringify(jsonObj, null, 2)

      wrapper = mount(CodeDisplay, {
        props: { code: formattedJson, language: 'json' }
      })

      expect(wrapper.find('.code-content code').text()).toBe(formattedJson)
    })

    it('should preserve whitespace in code', () => {
      const code = '{\n  "key": "value"\n}'
      wrapper = mount(CodeDisplay, {
        props: { code }
      })

      // The pre element should preserve whitespace
      expect(wrapper.find('.code-content').exists()).toBe(true)
    })
  })

  describe('Styling', () => {
    it('should have proper structure with header and content', () => {
      wrapper = mount(CodeDisplay, {
        props: { code: 'test' }
      })

      const display = wrapper.find('.code-display')
      expect(display.find('.code-header').exists()).toBe(true)
      expect(display.find('.code-content').exists()).toBe(true)
    })

    it('should render code in pre > code structure', () => {
      wrapper = mount(CodeDisplay, {
        props: { code: 'test code' }
      })

      const pre = wrapper.find('pre.code-content')
      expect(pre.exists()).toBe(true)
      expect(pre.find('code').exists()).toBe(true)
    })
  })
})
