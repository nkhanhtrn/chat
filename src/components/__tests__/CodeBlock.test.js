import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import CodeBlock from '../CodeBlock.vue'

describe('CodeBlock', () => {
  let wrapper

  beforeEach(() => {
    // Clean up any previous wrappers
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Rendering', () => {
    it('should render code block with default language', () => {
      wrapper = mount(CodeBlock, {
        props: {
          code: 'console.log("hello")'
        }
      })

      expect(wrapper.find('.code-block').exists()).toBe(true)
      expect(wrapper.find('.code-header span').text()).toBe('plaintext')
      expect(wrapper.find('pre code').text()).toBe('console.log("hello")')
    })

    it('should render code block with specified language', () => {
      wrapper = mount(CodeBlock, {
        props: {
          language: 'javascript',
          code: 'const x = 42;'
        }
      })

      expect(wrapper.find('.code-header span').text()).toBe('javascript')
      expect(wrapper.find('pre code').text()).toBe('const x = 42;')
    })

    it('should render copy button', () => {
      wrapper = mount(CodeBlock, {
        props: {
          code: 'test'
        }
      })

      const copyBtn = wrapper.find('.copy-btn')
      expect(copyBtn.exists()).toBe(true)
      expect(copyBtn.attributes('title')).toBe('Copy code')
    })

    it('should render SVG icon in copy button', () => {
      wrapper = mount(CodeBlock, {
        props: {
          code: 'test'
        }
      })

      const svg = wrapper.find('.copy-btn svg')
      expect(svg.exists()).toBe(true)
      expect(svg.attributes('width')).toBe('16')
      expect(svg.attributes('height')).toBe('16')
    })
  })

  describe('Props', () => {
    it('should accept language prop', () => {
      wrapper = mount(CodeBlock, {
        props: {
          language: 'python',
          code: 'print("hello")'
        }
      })

      expect(wrapper.find('.code-header span').text()).toBe('python')
    })

    it('should require code prop', () => {
      const { code } = CodeBlock.props
      expect(code.required).toBe(true)
    })

    it('should have default plaintext language', () => {
      const { language } = CodeBlock.props
      expect(language.default).toBe('plaintext')
    })

    it('should handle multiline code', () => {
      const multilineCode = `function test() {
  return true;
}`
      wrapper = mount(CodeBlock, {
        props: {
          language: 'javascript',
          code: multilineCode
        }
      })

      expect(wrapper.find('pre code').text()).toBe(multilineCode)
    })

    it('should handle empty code', () => {
      wrapper = mount(CodeBlock, {
        props: {
          code: ''
        }
      })

      expect(wrapper.find('pre code').text()).toBe('')
    })
  })

  describe('Copy Functionality', () => {
    it('should copy code to clipboard when copy button is clicked', async () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', {
        clipboard: {
          writeText: mockWriteText
        }
      })

      const testCode = 'console.log("test")'
      wrapper = mount(CodeBlock, {
        props: {
          code: testCode
        }
      })

      const copyBtn = wrapper.find('.copy-btn')
      await copyBtn.trigger('click')

      expect(mockWriteText).toHaveBeenCalledWith(testCode)
      expect(mockWriteText).toHaveBeenCalledTimes(1)
      
      vi.unstubAllGlobals()
    })

    it('should add flashing class to pre element when copy button is clicked', async () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', {
        clipboard: {
          writeText: mockWriteText
        }
      })

      wrapper = mount(CodeBlock, {
        props: {
          code: 'test'
        }
      })

      const pre = wrapper.find('pre')
      expect(pre.classes()).not.toContain('flashing')

      const copyBtn = wrapper.find('.copy-btn')
      await copyBtn.trigger('click')
      await wrapper.vm.$nextTick()

      expect(pre.classes()).toContain('flashing')
      
      vi.unstubAllGlobals()
    })

    it('should remove flashing class from pre element after animation duration', async () => {
      vi.useFakeTimers()
      const mockWriteText = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', {
        clipboard: {
          writeText: mockWriteText
        }
      })

      wrapper = mount(CodeBlock, {
        props: {
          code: 'test'
        }
      })

      const copyBtn = wrapper.find('.copy-btn')
      await copyBtn.trigger('click')
      await wrapper.vm.$nextTick()

      const pre = wrapper.find('pre')
      expect(pre.classes()).toContain('flashing')

      vi.advanceTimersByTime(200)
      await wrapper.vm.$nextTick()

      expect(pre.classes()).not.toContain('flashing')
      
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

      wrapper = mount(CodeBlock, {
        props: {
          code: 'test'
        }
      })

      const copyBtn = wrapper.find('.copy-btn')
      await copyBtn.trigger('click')
      await wrapper.vm.$nextTick()

      // Wait for async error handling
      await new Promise(resolve => setTimeout(resolve, 0))

      const pre = wrapper.find('pre')
      expect(pre.classes()).not.toContain('flashing')
      
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

      wrapper = mount(CodeBlock, {
        props: {
          code: 'test code'
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

    it('should copy multiline code correctly', async () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', {
        clipboard: {
          writeText: mockWriteText
        }
      })

      const multilineCode = `line 1
line 2
line 3`
      
      wrapper = mount(CodeBlock, {
        props: {
          code: multilineCode
        }
      })

      const copyBtn = wrapper.find('.copy-btn')
      await copyBtn.trigger('click')

      expect(mockWriteText).toHaveBeenCalledWith(multilineCode)
      
      vi.unstubAllGlobals()
    })

    it('should copy code with special characters', async () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', {
        clipboard: {
          writeText: mockWriteText
        }
      })

      const codeWithSpecialChars = '<script>alert("test")</script>'
      
      wrapper = mount(CodeBlock, {
        props: {
          code: codeWithSpecialChars
        }
      })

      const copyBtn = wrapper.find('.copy-btn')
      await copyBtn.trigger('click')

      expect(mockWriteText).toHaveBeenCalledWith(codeWithSpecialChars)
      
      vi.unstubAllGlobals()
    })
  })

  describe('Different Languages', () => {
    const languages = [
      'javascript',
      'python',
      'java',
      'cpp',
      'rust',
      'go',
      'typescript',
      'html',
      'css',
      'sql'
    ]

    languages.forEach(lang => {
      it(`should display ${lang} as language label`, () => {
        wrapper = mount(CodeBlock, {
          props: {
            language: lang,
            code: 'test code'
          }
        })

        expect(wrapper.find('.code-header span').text()).toBe(lang)
      })
    })
  })

  describe('Structure', () => {
    it('should have correct HTML structure', () => {
      wrapper = mount(CodeBlock, {
        props: {
          language: 'javascript',
          code: 'test'
        }
      })

      expect(wrapper.find('.code-block').exists()).toBe(true)
      expect(wrapper.find('.code-header').exists()).toBe(true)
      expect(wrapper.find('pre').exists()).toBe(true)
      expect(wrapper.find('code').exists()).toBe(true)
      expect(wrapper.find('.copy-btn').exists()).toBe(true)
    })

    it('should nest code inside pre tag', () => {
      wrapper = mount(CodeBlock, {
        props: {
          code: 'test'
        }
      })

      const pre = wrapper.find('pre')
      const code = pre.find('code')
      
      expect(code.exists()).toBe(true)
    })
  })
})
