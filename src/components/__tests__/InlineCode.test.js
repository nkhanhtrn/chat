import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import InlineCode from '../InlineCode.vue'

describe('InlineCode', () => {
  let wrapper

  beforeEach(() => {
    // Clean up any previous wrappers
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Rendering', () => {
    it('should render inline code with text', () => {
      wrapper = mount(InlineCode, {
        props: {
          text: 'console.log("hello")'
        }
      })

      expect(wrapper.find('.inline-code-wrapper').exists()).toBe(true)
      expect(wrapper.find('.inline-code').exists()).toBe(true)
      expect(wrapper.find('.inline-code').text()).toBe('console.log("hello")')
    })

    it('should render code inside span wrapper', () => {
      wrapper = mount(InlineCode, {
        props: {
          text: 'test'
        }
      })

      const wrapper_el = wrapper.find('.inline-code-wrapper')
      const code = wrapper_el.find('code')
      
      expect(code.exists()).toBe(true)
      expect(code.classes()).toContain('inline-code')
    })

    it('should render copy button', () => {
      wrapper = mount(InlineCode, {
        props: {
          text: 'test'
        }
      })

      const copyBtn = wrapper.find('.copy-btn')
      expect(copyBtn.exists()).toBe(true)
      expect(copyBtn.attributes('title')).toBe('Copy code')
    })

    it('should render SVG icon in copy button', () => {
      wrapper = mount(InlineCode, {
        props: {
          text: 'test'
        }
      })

      const svg = wrapper.find('.copy-btn svg')
      expect(svg.exists()).toBe(true)
      expect(svg.attributes('width')).toBe('12')
      expect(svg.attributes('height')).toBe('12')
    })
  })

  describe('Props', () => {
    it('should require text prop', () => {
      const { text } = InlineCode.props
      expect(text.required).toBe(true)
      expect(text.type).toBe(String)
    })

    it('should display provided text', () => {
      const testText = 'const x = 42;'
      wrapper = mount(InlineCode, {
        props: {
          text: testText
        }
      })

      expect(wrapper.find('.inline-code').text()).toBe(testText)
    })

    it('should handle empty text', () => {
      wrapper = mount(InlineCode, {
        props: {
          text: ''
        }
      })

      expect(wrapper.find('.inline-code').text()).toBe('')
    })

    it('should handle special characters', () => {
      const specialText = '<script>alert("xss")</script>'
      wrapper = mount(InlineCode, {
        props: {
          text: specialText
        }
      })

      expect(wrapper.find('.inline-code').text()).toBe(specialText)
    })

    it('should handle long text', () => {
      const longText = 'a'.repeat(200)
      wrapper = mount(InlineCode, {
        props: {
          text: longText
        }
      })

      expect(wrapper.find('.inline-code').text()).toBe(longText)
    })
  })

  describe('Copy Functionality', () => {
    it('should copy text to clipboard when copy button is clicked', async () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', {
        clipboard: {
          writeText: mockWriteText
        }
      })

      const testText = 'npm install'
      wrapper = mount(InlineCode, {
        props: {
          text: testText
        }
      })

      const copyBtn = wrapper.find('.copy-btn')
      await copyBtn.trigger('click')

      expect(mockWriteText).toHaveBeenCalledWith(testText)
      expect(mockWriteText).toHaveBeenCalledTimes(1)
      
      vi.unstubAllGlobals()
    })

    it('should add flashing class to code element when copy button is clicked', async () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', {
        clipboard: {
          writeText: mockWriteText
        }
      })

      wrapper = mount(InlineCode, {
        props: {
          text: 'test'
        }
      })

      const code = wrapper.find('.inline-code')
      expect(code.classes()).not.toContain('flashing')

      const copyBtn = wrapper.find('.copy-btn')
      await copyBtn.trigger('click')
      await wrapper.vm.$nextTick()

      expect(code.classes()).toContain('flashing')
      
      vi.unstubAllGlobals()
    })

    it('should remove flashing class from code element after animation duration', async () => {
      vi.useFakeTimers()
      const mockWriteText = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', {
        clipboard: {
          writeText: mockWriteText
        }
      })

      wrapper = mount(InlineCode, {
        props: {
          text: 'test'
        }
      })

      const copyBtn = wrapper.find('.copy-btn')
      await copyBtn.trigger('click')
      await wrapper.vm.$nextTick()

      const code = wrapper.find('.inline-code')
      expect(code.classes()).toContain('flashing')

      vi.advanceTimersByTime(200)
      await wrapper.vm.$nextTick()

      expect(code.classes()).not.toContain('flashing')
      
      vi.unstubAllGlobals()
      vi.useRealTimers()
    })

    it('should not add flashing class on copy failure', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const mockError = new Error('Clipboard access denied')
      const mockWriteText = vi.fn().mockRejectedValue(mockError)
      
      vi.stubGlobal('navigator', {
        clipboard: {
          writeText: mockWriteText
        }
      })

      wrapper = mount(InlineCode, {
        props: {
          text: 'test'
        }
      })

      const copyBtn = wrapper.find('.copy-btn')
      await copyBtn.trigger('click')
      await wrapper.vm.$nextTick()

      // Wait for async error handling
      await new Promise(resolve => setTimeout(resolve, 0))

      const code = wrapper.find('.inline-code')
      expect(code.classes()).not.toContain('flashing')
      
      consoleErrorSpy.mockRestore()
      vi.unstubAllGlobals()
    })

    it('should handle copy failure gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const mockError = new Error('Clipboard access denied')
      const mockWriteText = vi.fn().mockRejectedValue(mockError)
      
      vi.stubGlobal('navigator', {
        clipboard: {
          writeText: mockWriteText
        }
      })

      wrapper = mount(InlineCode, {
        props: {
          text: 'test'
        }
      })

      const copyBtn = wrapper.find('.copy-btn')
      await copyBtn.trigger('click')

      // Wait for async error handling
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to copy code:', mockError)
      
      consoleErrorSpy.mockRestore()
      vi.unstubAllGlobals()
    })

    it('should copy text with special characters', async () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', {
        clipboard: {
          writeText: mockWriteText
        }
      })

      const specialText = '<div class="test">'
      wrapper = mount(InlineCode, {
        props: {
          text: specialText
        }
      })

      const copyBtn = wrapper.find('.copy-btn')
      await copyBtn.trigger('click')

      expect(mockWriteText).toHaveBeenCalledWith(specialText)
      
      vi.unstubAllGlobals()
    })

    it('should copy empty text', async () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', {
        clipboard: {
          writeText: mockWriteText
        }
      })

      wrapper = mount(InlineCode, {
        props: {
          text: ''
        }
      })

      const copyBtn = wrapper.find('.copy-btn')
      await copyBtn.trigger('click')

      expect(mockWriteText).toHaveBeenCalledWith('')
      
      vi.unstubAllGlobals()
    })
  })

  describe('Structure', () => {
    it('should have correct HTML structure', () => {
      wrapper = mount(InlineCode, {
        props: {
          text: 'test'
        }
      })

      expect(wrapper.find('span.inline-code-wrapper').exists()).toBe(true)
      expect(wrapper.find('code.inline-code').exists()).toBe(true)
      expect(wrapper.find('button.copy-btn').exists()).toBe(true)
    })

    it('should use span wrapper as root element', () => {
      wrapper = mount(InlineCode, {
        props: {
          text: 'test'
        }
      })

      expect(wrapper.element.tagName.toLowerCase()).toBe('span')
      expect(wrapper.classes()).toContain('inline-code-wrapper')
    })

    it('should contain both code and button as direct children', () => {
      wrapper = mount(InlineCode, {
        props: {
          text: 'test'
        }
      })

      const wrapperEl = wrapper.find('.inline-code-wrapper')
      const children = wrapperEl.element.children
      
      expect(children.length).toBe(2)
      expect(children[0].tagName.toLowerCase()).toBe('code')
      expect(children[1].tagName.toLowerCase()).toBe('button')
    })
  })

  describe('Common Use Cases', () => {
    const commonCodes = [
      'npm install',
      'git commit -m "message"',
      'const x = 10',
      'function test() {}',
      'import React from "react"',
      'SELECT * FROM users',
      'docker run -p 8080:80',
      'curl https://api.example.com'
    ]

    commonCodes.forEach(code => {
      it(`should render and copy: ${code}`, async () => {
        const mockWriteText = vi.fn().mockResolvedValue(undefined)
        vi.stubGlobal('navigator', {
          clipboard: {
            writeText: mockWriteText
          }
        })

        wrapper = mount(InlineCode, {
          props: {
            text: code
          }
        })

        expect(wrapper.find('.inline-code').text()).toBe(code)

        const copyBtn = wrapper.find('.copy-btn')
        await copyBtn.trigger('click')

        expect(mockWriteText).toHaveBeenCalledWith(code)
        
        vi.unstubAllGlobals()
      })
    })
  })
})
