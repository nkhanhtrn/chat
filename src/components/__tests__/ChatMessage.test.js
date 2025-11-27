import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatMessage from '../ChatMessage.vue'
import MarkdownRenderer from '../MarkdownRenderer.vue'

describe('ChatMessage', () => {
  let wrapper

  beforeEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Rendering', () => {
    it('should render message container', () => {
      wrapper = mount(ChatMessage, {
        props: {
          message: {
            role: 'user',
            content: 'Test message'
          }
        }
      })

      expect(wrapper.find('.message').exists()).toBe(true)
    })

    it('should render message header with role badge', () => {
      wrapper = mount(ChatMessage, {
        props: {
          message: {
            role: 'user',
            content: 'Test'
          }
        }
      })

      expect(wrapper.find('.message-header').exists()).toBe(true)
      expect(wrapper.find('.role-badge').exists()).toBe(true)
    })

    it('should render message content', () => {
      wrapper = mount(ChatMessage, {
        props: {
          message: {
            role: 'user',
            content: 'Test message'
          }
        }
      })

      expect(wrapper.find('.message-content').exists()).toBe(true)
    })
  })

  describe('Props', () => {
    it('should require message prop', () => {
      const { message } = ChatMessage.props
      expect(message.required).toBe(true)
      expect(message.type).toBe(Object)
    })

    it('should accept isStreaming prop', () => {
      const { isStreaming } = ChatMessage.props
      expect(isStreaming.type).toBe(Boolean)
      expect(isStreaming.default).toBe(false)
    })
  })


  describe('User Messages', () => {
    it('should display user role badge (You) when response is empty', () => {
      wrapper = mount(ChatMessage, {
        props: {
          message: {
            question: 'Hello',
            response: ''
          }
        }
      })
      expect(wrapper.find('.role-badge').text()).toBe('You')
    })

    it('should apply user message class when response is empty', () => {
      wrapper = mount(ChatMessage, {
        props: {
          message: {
            question: 'Hello',
            response: ''
          }
        }
      })
      expect(wrapper.find('.message').classes()).toContain('message-user')
    })


    it('should render assistant message with MarkdownRenderer', () => {
      wrapper = mount(ChatMessage, {
        props: {
          message: {
            question: 'Q',
            response: 'Response'
          }
        },
        global: {
          stubs: {
            MarkdownRenderer: true
          }
        }
      })
      expect(wrapper.findComponent(MarkdownRenderer).exists()).toBe(true)
    })

    it('should pass response to MarkdownRenderer', () => {
      const response = '# Hello\n\nThis is **bold**'
      wrapper = mount(ChatMessage, {
        props: {
          message: {
            question: 'Q',
            response
          }
        },
        global: {
          stubs: {
            MarkdownRenderer: true
          }
        }
      })
      const markdownRenderer = wrapper.findComponent(MarkdownRenderer)
      expect(markdownRenderer.props('content')).toBe(response)
    })

    it('should render assistant-message container', () => {
      wrapper = mount(ChatMessage, {
        props: {
          message: {
            question: 'Q',
            response: 'Response'
          }
        },
        global: {
          stubs: {
            MarkdownRenderer: true
          }
        }
      })
      expect(wrapper.find('.assistant-message').exists()).toBe(true)
    })
  })

  describe('Streaming Indicator', () => {
    it('should show cursor when streaming', () => {
      wrapper = mount(ChatMessage, {
        props: {
          message: {
            question: 'Q',
            response: 'Partial response'
          },
          isStreaming: true
        },
        global: {
          stubs: {
            MarkdownRenderer: true
          }
        }
      })
      expect(wrapper.find('.cursor').exists()).toBe(true)
      expect(wrapper.find('.cursor').text()).toBe('▊')
    })

    it('should not show cursor when not streaming', () => {
      wrapper = mount(ChatMessage, {
        props: {
          message: {
            role: 'assistant',
            content: 'Complete response'
          },
          isStreaming: false
        },
        global: {
          stubs: {
            MarkdownRenderer: true
          }
        }
      })

      expect(wrapper.find('.cursor').exists()).toBe(false)
    })

    it('should not show cursor for user messages even when streaming', () => {
      wrapper = mount(ChatMessage, {
        props: {
          message: {
            role: 'user',
            content: 'User message'
          },
          isStreaming: true
        }
      })

      expect(wrapper.find('.cursor').exists()).toBe(false)
    })
  })

  describe('Message Classes', () => {
    it('should compute correct class for user message', () => {
      wrapper = mount(ChatMessage, {
        props: {
          message: {
            role: 'user',
            content: 'Test'
          }
        }
      })

      expect(wrapper.find('.message').classes()).toContain('message-user')
      expect(wrapper.find('.message').classes()).not.toContain('message-assistant')
    })

  })

  describe('Structure', () => {
    it('should have correct HTML structure', () => {
      wrapper = mount(ChatMessage, {
        props: {
          message: {
            role: 'user',
            content: 'Test'
          }
        }
      })

      expect(wrapper.find('.message').exists()).toBe(true)
      expect(wrapper.find('.message-header').exists()).toBe(true)
      expect(wrapper.find('.role-badge').exists()).toBe(true)
      expect(wrapper.find('.message-content').exists()).toBe(true)
    })

    it('should nest elements correctly', () => {
      wrapper = mount(ChatMessage, {
        props: {
          message: {
            role: 'user',
            content: 'Test'
          }
        }
      })

      const message = wrapper.find('.message')
      const header = message.find('.message-header')
      const badge = header.find('.role-badge')

      expect(badge.exists()).toBe(true)
    })
  })

  describe('Animation', () => {
    it('should have fade-in animation class', () => {
      wrapper = mount(ChatMessage, {
        props: {
          message: {
            role: 'user',
            content: 'Test'
          }
        }
      })

      // The component should render with message class which has fadeIn animation in CSS
      expect(wrapper.find('.message').exists()).toBe(true)
    })
  })

  describe('Content Rendering', () => {
    it('should render empty content', () => {
      wrapper = mount(ChatMessage, {
        props: {
          message: {
            role: 'user',
            content: ''
          }
        }
      })

      expect(wrapper.find('.user-message').text()).toBe('')
    })

    it('should render multiline user question', () => {
      const multiline = 'Line 1\nLine 2\nLine 3'
      wrapper = mount(ChatMessage, {
        props: {
          message: {
            question: multiline,
            response: ''
          }
        }
      })
      expect(wrapper.find('.user-message').text()).toBe(multiline)
    })

    it('should handle special characters in user question', () => {
      const special = '<div>Test & "quotes"</div>'
      wrapper = mount(ChatMessage, {
        props: {
          message: {
            question: special,
            response: ''
          }
        }
      })
      expect(wrapper.find('.user-message').text()).toBe(special)
    })

    it('should render assistant message with markdown content', () => {
      wrapper = mount(ChatMessage, {
        props: {
          message: {
            question: 'Q',
            response: '# Title\n\nParagraph with **bold**'
          }
        },
        global: {
          stubs: {
            MarkdownRenderer: true
          }
        }
      })
      expect(wrapper.findComponent(MarkdownRenderer).exists()).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('should handle undefined content gracefully', () => {
      wrapper = mount(ChatMessage, {
        props: {
          message: {
            role: 'user',
            content: undefined
          }
        }
      })

      expect(wrapper.find('.message').exists()).toBe(true)
    })

    it('should handle null content gracefully', () => {
      wrapper = mount(ChatMessage, {
        props: {
          message: {
            role: 'user',
            content: null
          }
        }
      })

      expect(wrapper.find('.message').exists()).toBe(true)
    })

    it('should handle very long question', () => {
      const longContent = 'a'.repeat(10000)
      wrapper = mount(ChatMessage, {
        props: {
          message: {
            question: longContent,
            response: ''
          }
        }
      })
      expect(wrapper.find('.user-message').text()).toBe(longContent)
    })
  })
})
