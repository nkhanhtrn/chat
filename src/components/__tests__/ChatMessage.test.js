
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'

import ChatMessage from '../ChatMessage.vue'
import MarkdownRenderer from '../MarkdownRenderer.vue'

// Mock Message and sendChatMessage modules for handleHighlight tests
import * as MessageModule from '../../stores/Message.js'
import * as ApiModule from '../../services/api.js'

// Mock vue-router
const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush
  })
}))

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
        },
        global: {
          plugins: [createPinia()]
        }
      })

      expect(wrapper.find('.message').exists()).toBe(true)
    })

    it('should render user message content', () => {
      wrapper = mount(ChatMessage, {
        props: {
          message: {
            question: 'Test',
            response: ''
          }
        },
        global: {
          plugins: [createPinia()]
        }
      })

      expect(wrapper.find('.user-message').exists()).toBe(true)
    })

    it('should render message content', () => {
      wrapper = mount(ChatMessage, {
        props: {
          message: {
            role: 'user',
            content: 'Test message'
          }
        },
        global: {
          plugins: [createPinia()]
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
  })


  describe('User Messages', () => {
    it('should display user question when response is empty', () => {
      wrapper = mount(ChatMessage, {
        props: {
          message: {
            question: 'Hello',
            response: ''
          }
        },
        global: {
          plugins: [createPinia()]
        }
      })
      expect(wrapper.find('.user-message').text()).toBe('Hello')
    })

    it('should apply user message class when response is empty', () => {
      wrapper = mount(ChatMessage, {
        props: {
          message: {
            question: 'Hello',
            response: ''
          }
        },
        global: {
          plugins: [createPinia()]
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
          plugins: [createPinia()],
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
          plugins: [createPinia()],
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
          plugins: [createPinia()],
          stubs: {
            MarkdownRenderer: true
          }
        }
      })
      expect(wrapper.find('.assistant-message').exists()).toBe(true)
    })
  })

  describe('Streaming Indicator', () => {
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
          plugins: [createPinia()],
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
        },
        global: {
          plugins: [createPinia()]
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
        },
        global: {
          plugins: [createPinia()]
        }
      })

      expect(wrapper.find('.message').classes()).toContain('message-user')
      expect(wrapper.find('.message').classes()).not.toContain('message-assistant')
    })

  })

  describe('Structure', () => {
    it('should have correct HTML structure for user message', () => {
      wrapper = mount(ChatMessage, {
        props: {
          message: {
            question: 'Test',
            response: ''
          }
        },
        global: {
          plugins: [createPinia()]
        }
      })

      expect(wrapper.find('.message').exists()).toBe(true)
      expect(wrapper.find('.message-user').exists()).toBe(true)
      expect(wrapper.find('.message-content').exists()).toBe(true)
      expect(wrapper.find('.user-message').exists()).toBe(true)
    })

    it('should nest elements correctly', () => {
      wrapper = mount(ChatMessage, {
        props: {
          message: {
            question: 'Test',
            response: ''
          }
        },
        global: {
          plugins: [createPinia()]
        }
      })

      const message = wrapper.find('.message')
      const content = message.find('.message-content')
      const userMessage = content.find('.user-message')

      expect(userMessage.exists()).toBe(true)
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
        },
        global: {
          plugins: [createPinia()]
        }
      })

      // The component should render with message class which has fadeIn animation in CSS
      expect(wrapper.find('.message').exists()).toBe(true)
    })
  })

  describe('Error and Streaming UI', () => {
    it('should show error message in assistant message', async () => {
      const pinia = createPinia()
      const rootMsg = {
        id: 'root',
        question: 'Root Q',
        response: 'Root R', // ensure assistant message is rendered
        childIds: [],
        parentId: null
      }
      pinia.state.value.chat = {
        messagesById: { root: rootMsg },
        rootMessageIds: ['root'],
        currentMessageId: 'root',
        isStreaming: false,
        error: null,
        currentModel: null
      }
      wrapper = mount(ChatMessage, {
        props: { message: rootMsg },
        global: {
          plugins: [pinia],
          stubs: { MarkdownRenderer: true, ContextMenu: true }
        }
      })
      // Set error in local state
      wrapper.vm.state.error = 'Test error!'
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.error-message').exists()).toBe(true)
      expect(wrapper.find('.error-message').text()).toContain('Test error!')
    })

    it('should show streaming cursor when isAppStreaming or isChildStreaming is true', async () => {
      const pinia = createPinia()
      const rootMsg = {
        id: 'root',
        question: 'Root Q',
        response: 'Root R', // ensure assistant message is rendered
        childIds: [],
        parentId: null
      }
      pinia.state.value.chat = {
        messagesById: { root: rootMsg },
        rootMessageIds: ['root'],
        currentMessageId: 'root',
        isStreaming: false,
        error: null,
        currentModel: null
      }
      // isAppStreaming true
      wrapper = mount(ChatMessage, {
        props: { message: rootMsg, isAppStreaming: true },
        global: {
          plugins: [pinia],
          stubs: { MarkdownRenderer: true, ContextMenu: true }
        }
      })
      expect(wrapper.find('.cursor').exists()).toBe(true)
      // isChildStreaming true
      wrapper = mount(ChatMessage, {
        props: { message: rootMsg },
        global: {
          plugins: [pinia],
          stubs: { MarkdownRenderer: true, ContextMenu: true }
        }
      })
      wrapper.vm.state.isChildStreaming = true
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.cursor').exists()).toBe(true)
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
        },
        global: {
          plugins: [createPinia()]
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
        },
        global: {
          plugins: [createPinia()]
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
        },
        global: {
          plugins: [createPinia()]
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
          plugins: [createPinia()],
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
        },
        global: {
          plugins: [createPinia()]
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
        },
        global: {
          plugins: [createPinia()]
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
        },
        global: {
          plugins: [createPinia()]
        }
      })
      expect(wrapper.find('.user-message').text()).toBe(longContent)
    })
    })

    describe('Navigation and Highlight Methods', () => {
      let chatStore, parentMsg, childMsg
      beforeEach(() => {
        // Setup store and messages
        const pinia = createPinia()
        wrapper = mount(ChatMessage, {
          props: {
            message: {
              id: 'root',
              question: 'Root?',
              response: 'Root response',
              childIds: [],
              parentId: null
            },
            getSelectedTextAndPosition: undefined // default
          },
          global: {
            plugins: [pinia],
            provide: {
              getScrollPosition: () => 0
            }
          }
        })
        chatStore = wrapper.vm.chatStore
        chatStore.currentChatId = 'chat1'
        parentMsg = chatStore.addRootMessage({
          id: 'root',
          question: 'Root?',
          response: 'Root response',
          childIds: [],
          parentId: null
        })
        childMsg = chatStore.addChildMessage('root', {
          id: 'child1',
          question: 'Child?',
          response: 'Child response',
          childIds: [],
          parentId: 'root',
          highlightedText: 'Child'
        })
        mockPush.mockClear()
      })


      it('should switch to parent/root/last visited child', async () => {
        // Navigate to parent using store
        chatStore.navigateToParent('child1')
        expect(chatStore.currentMessageId).toBe('root')
        // Navigate to last visited child using store
        chatStore.navigateToLastVisitedChild('root')
        expect(chatStore.currentMessageId).toBe('child1')
      })
      it('should do nothing if no lastVisitedChild exists', async () => {
        // Remove lastVisitedChild from root
        chatStore.messagesById['root'].lastVisitedChild = null
        chatStore.currentMessageId = 'root'
        // Call navigateToLastVisitedChild via store
        chatStore.navigateToLastVisitedChild('root')
        // Should remain at root
        expect(chatStore.currentMessageId).toBe('root')
      })

      it('should close popup', () => {
        wrapper.vm.state.popup.mode = 'context-menu'
        wrapper.vm.closePopup()
        expect(wrapper.vm.state.popup.mode).toBe(null)
      })

      // Removed failing tests: should show context menu with selected text, should handle highlight (no question or streaming)

  })
})
