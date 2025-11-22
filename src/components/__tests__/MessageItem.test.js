import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import MessageItem from '../MessageItem.vue'
import MessageContent from '../MessageContent.vue'

describe('MessageItem', () => {
  let wrapper

  beforeEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Rendering', () => {
    it('should render user message', () => {
      const message = {
        role: 'user',
        displayContent: 'Hello!',
        thinking: null
      }

      wrapper = mount(MessageItem, {
        props: {
          message,
          isLoading: false
        },
        global: {
          stubs: {
            MessageContent: true
          }
        }
      })

      expect(wrapper.find('.message').exists()).toBe(true)
      expect(wrapper.find('.message').classes()).toContain('user')
      expect(wrapper.find('.message-role').text()).toBe('You')
    })

    it('should render assistant message', () => {
      const message = {
        role: 'assistant',
        displayContent: 'Hi there!',
        thinking: null
      }

      wrapper = mount(MessageItem, {
        props: {
          message,
          isLoading: false
        },
        global: {
          stubs: {
            MessageContent: true
          }
        }
      })

      expect(wrapper.find('.message').classes()).toContain('assistant')
      expect(wrapper.find('.message-role').text()).toBe('Assistant')
    })

    it('should show loading class when message is loading', () => {
      const message = {
        role: 'assistant',
        displayContent: '',
        loading: true
      }

      wrapper = mount(MessageItem, {
        props: {
          message,
          isLoading: true
        },
        global: {
          stubs: {
            MessageContent: true
          }
        }
      })

      expect(wrapper.find('.message').classes()).toContain('loading')
    })
  })

  describe('Thinking Section', () => {
    it('should render thinking section when thinking exists', () => {
      const message = {
        role: 'assistant',
        displayContent: 'Answer',
        thinking: 'Let me think...',
        showThinking: false
      }

      wrapper = mount(MessageItem, {
        props: {
          message,
          isLoading: false
        },
        global: {
          stubs: {
            MessageContent: true
          }
        }
      })

      expect(wrapper.find('.thinking-section').exists()).toBe(true)
      expect(wrapper.find('.thinking-header').exists()).toBe(true)
    })

    it('should not render thinking section when no thinking', () => {
      const message = {
        role: 'user',
        displayContent: 'Hello',
        thinking: null
      }

      wrapper = mount(MessageItem, {
        props: {
          message,
          isLoading: false
        },
        global: {
          stubs: {
            MessageContent: true
          }
        }
      })

      expect(wrapper.find('.thinking-section').exists()).toBe(false)
    })

    it('should show collapsed thinking by default', () => {
      const message = {
        role: 'assistant',
        displayContent: 'Answer',
        thinking: 'Thinking process',
        showThinking: false
      }

      wrapper = mount(MessageItem, {
        props: {
          message,
          isLoading: false
        },
        global: {
          stubs: {
            MessageContent: true
          }
        }
      })

      expect(wrapper.find('.thinking-content').exists()).toBe(false)
      expect(wrapper.find('.thinking-icon').text()).toBe('▶')
    })

    it('should show thinking content when expanded', () => {
      const message = {
        role: 'assistant',
        displayContent: 'Answer',
        thinking: 'Thinking process',
        showThinking: true
      }

      wrapper = mount(MessageItem, {
        props: {
          message,
          isLoading: false
        },
        global: {
          stubs: {
            MessageContent: true
          }
        }
      })

      expect(wrapper.find('.thinking-content').exists()).toBe(true)
      expect(wrapper.find('.thinking-content').text()).toBe('Thinking process')
      expect(wrapper.find('.thinking-icon').text()).toBe('▼')
    })

    it('should toggle thinking when header is clicked', async () => {
      const message = {
        role: 'assistant',
        displayContent: 'Answer',
        thinking: 'Thinking process',
        showThinking: false
      }

      wrapper = mount(MessageItem, {
        props: {
          message,
          isLoading: false
        },
        global: {
          stubs: {
            MessageContent: true
          }
        }
      })

      const header = wrapper.find('.thinking-header')
      await header.trigger('click')

      expect(message.showThinking).toBe(true)
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.thinking-content').exists()).toBe(true)

      await header.trigger('click')
      expect(message.showThinking).toBe(false)
    })

    it('should show "Thinking..." label for normal messages', () => {
      const message = {
        role: 'assistant',
        displayContent: 'Answer',
        thinking: 'Process',
        showThinking: false,
        compressed: false
      }

      wrapper = mount(MessageItem, {
        props: {
          message,
          isLoading: false
        },
        global: {
          stubs: {
            MessageContent: true
          }
        }
      })

      expect(wrapper.find('.thinking-label').text()).toBe('Thinking...')
    })

    it('should show compressed message label for compressed messages', () => {
      const message = {
        role: 'assistant',
        displayContent: 'Summary',
        thinking: 'Compressed content',
        showThinking: false,
        compressed: true,
        compressedCount: 5
      }

      wrapper = mount(MessageItem, {
        props: {
          message,
          isLoading: false
        },
        global: {
          stubs: {
            MessageContent: true
          }
        }
      })

      expect(wrapper.find('.thinking-label').text()).toBe('Compressed previous conversation (5 messages)')
    })
  })

  describe('Compressed Messages', () => {
    it('should not show MessageContent for compressed messages with thinking', () => {
      const message = {
        role: 'assistant',
        displayContent: 'Summary',
        thinking: 'Compressed content',
        compressed: true,
        compressedCount: 3
      }

      wrapper = mount(MessageItem, {
        props: {
          message,
          isLoading: false
        },
        global: {
          components: {
            MessageContent
          }
        }
      })

      expect(wrapper.findComponent(MessageContent).exists()).toBe(false)
    })

    it('should show MessageContent for non-compressed messages', () => {
      const message = {
        role: 'assistant',
        displayContent: 'Regular answer',
        thinking: 'Process'
      }

      wrapper = mount(MessageItem, {
        props: {
          message,
          isLoading: false
        },
        global: {
          components: {
            MessageContent
          }
        }
      })

      expect(wrapper.findComponent(MessageContent).exists()).toBe(true)
    })
  })

  describe('Retry Functionality', () => {
    it('should show retry button for last user message', () => {
      const message = {
        role: 'user',
        displayContent: 'Hello',
        thinking: null
      }

      wrapper = mount(MessageItem, {
        props: {
          message,
          isLoading: false,
          isLastUserMessage: true
        },
        global: {
          stubs: {
            MessageContent: true
          }
        }
      })

      expect(wrapper.find('.message-actions').exists()).toBe(true)
      expect(wrapper.find('.retry-btn').exists()).toBe(true)
      expect(wrapper.find('.retry-btn').text()).toBe('↻')
    })

    it('should not show retry button for non-user messages', () => {
      const message = {
        role: 'assistant',
        displayContent: 'Answer',
        thinking: null
      }

      wrapper = mount(MessageItem, {
        props: {
          message,
          isLoading: false,
          isLastUserMessage: false
        },
        global: {
          stubs: {
            MessageContent: true
          }
        }
      })

      expect(wrapper.find('.message-actions').exists()).toBe(false)
    })

    it('should not show retry button if not last user message', () => {
      const message = {
        role: 'user',
        displayContent: 'Hello',
        thinking: null
      }

      wrapper = mount(MessageItem, {
        props: {
          message,
          isLoading: false,
          isLastUserMessage: false
        },
        global: {
          stubs: {
            MessageContent: true
          }
        }
      })

      expect(wrapper.find('.message-actions').exists()).toBe(false)
    })

    it('should emit retry event when retry button is clicked', async () => {
      const message = {
        role: 'user',
        displayContent: 'Hello',
        thinking: null
      }

      wrapper = mount(MessageItem, {
        props: {
          message,
          isLoading: false,
          isLastUserMessage: true
        },
        global: {
          stubs: {
            MessageContent: true
          }
        }
      })

      const retryBtn = wrapper.find('.retry-btn')
      await retryBtn.trigger('click')

      expect(wrapper.emitted('retry')).toBeTruthy()
      expect(wrapper.emitted('retry')).toHaveLength(1)
    })

    it('should disable retry button when loading', () => {
      const message = {
        role: 'user',
        displayContent: 'Hello',
        thinking: null
      }

      wrapper = mount(MessageItem, {
        props: {
          message,
          isLoading: true,
          isLastUserMessage: true
        },
        global: {
          stubs: {
            MessageContent: true
          }
        }
      })

      const retryBtn = wrapper.find('.retry-btn')
      expect(retryBtn.attributes('disabled')).toBeDefined()
    })

    it('should have title attribute on retry button', () => {
      const message = {
        role: 'user',
        displayContent: 'Hello',
        thinking: null
      }

      wrapper = mount(MessageItem, {
        props: {
          message,
          isLoading: false,
          isLastUserMessage: true
        },
        global: {
          stubs: {
            MessageContent: true
          }
        }
      })

      const retryBtn = wrapper.find('.retry-btn')
      expect(retryBtn.attributes('title')).toBe('Retry this message')
    })
  })

  describe('Props', () => {
    it('should require message prop', () => {
      const { message } = MessageItem.props
      expect(message.required).toBe(true)
      expect(message.type).toBe(Object)
    })

    it('should have default values for optional props', () => {
      const { isLoading, isLastUserMessage } = MessageItem.props
      expect(isLoading.default).toBe(false)
      expect(isLastUserMessage.default).toBe(false)
    })
  })

  describe('Structure', () => {
    it('should have correct HTML structure', () => {
      const message = {
        role: 'user',
        displayContent: 'Hello',
        thinking: null
      }

      wrapper = mount(MessageItem, {
        props: {
          message,
          isLoading: false
        },
        global: {
          stubs: {
            MessageContent: true
          }
        }
      })

      expect(wrapper.find('.message').exists()).toBe(true)
      expect(wrapper.find('.message-role').exists()).toBe(true)
      expect(wrapper.find('.message-content').exists()).toBe(true)
    })
  })
})
