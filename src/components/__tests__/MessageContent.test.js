import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MessageContent from '../MessageContent.vue'

describe('MessageContent', () => {
  describe('Blockquote Rendering', () => {
    it('should render blockquote with proper styling', () => {
      const content = '> This is a blockquote'
      const wrapper = mount(MessageContent, {
        props: { content }
      })

      const blockquote = wrapper.find('.markdown-blockquote')
      expect(blockquote.exists()).toBe(true)
    })

    it('should render blockquote with formatting', () => {
      const content = '> Tip: Work through the *"Math for Machine Learning"* playlist on Coursera or edX; they use Jupyter notebooks to tie math to code.'
      const wrapper = mount(MessageContent, {
        props: { content }
      })

      const blockquote = wrapper.find('.markdown-blockquote')
      expect(blockquote.exists()).toBe(true)
      
      // Check that italic formatting is preserved
      const italic = blockquote.find('em')
      expect(italic.exists()).toBe(true)
      expect(italic.text()).toContain('Math for Machine Learning')
    })

    it('should render blockquote with bold and code', () => {
      const content = '> This has **bold** and `code` inside'
      const wrapper = mount(MessageContent, {
        props: { content }
      })

      const blockquote = wrapper.find('.markdown-blockquote')
      expect(blockquote.exists()).toBe(true)
      
      // Check for bold
      const bold = blockquote.find('strong')
      expect(bold.exists()).toBe(true)
      expect(bold.text()).toBe('bold')
      
      // Check for code
      const code = blockquote.findComponent({ name: 'InlineCode' })
      expect(code.exists()).toBe(true)
    })

    it('should render multiple blockquotes', () => {
      const content = `> First quote
      
> Second quote`
      const wrapper = mount(MessageContent, {
        props: { content }
      })

      const blockquotes = wrapper.findAll('.markdown-blockquote')
      expect(blockquotes.length).toBeGreaterThan(0)
    })
  })

  describe('Mixed Content', () => {
    it('should render blockquote alongside other elements', () => {
      const content = `Regular text

> A blockquote

More text`
      const wrapper = mount(MessageContent, {
        props: { content }
      })

      const blockquote = wrapper.find('.markdown-blockquote')
      expect(blockquote.exists()).toBe(true)
      
      // Should also have text elements
      const textElements = wrapper.findAll('.message-text')
      expect(textElements.length).toBeGreaterThan(0)
    })
  })
})
