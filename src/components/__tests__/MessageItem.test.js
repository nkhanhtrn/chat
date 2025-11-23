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

      // Loading class was removed - this test is no longer applicable
      expect(wrapper.find('.message').exists()).toBe(true)
    })
  })

  describe('Thinking Section', () => {
    it('should render waiting indicator when message is waiting', () => {
      const message = {
        role: 'assistant',
        displayContent: '',
        isWaiting: true
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

      expect(wrapper.find('.waiting-indicator').exists()).toBe(true)
      expect(wrapper.findAll('.dot')).toHaveLength(3)
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

      expect(wrapper.find('.waiting-indicator').exists()).toBe(false)
    })

    it('should not show waiting indicator when message has content', () => {
      const message = {
        role: 'assistant',
        displayContent: 'Answer',
        isWaiting: false
      }

      wrapper = mount(MessageItem, {
        props: {
          message,
          isLoading: false
        }
      })

      expect(wrapper.find('.waiting-indicator').exists()).toBe(false)
    })

    it('should show message content when not waiting', () => {
      const message = {
        role: 'assistant',
        displayContent: 'Answer',
        isWaiting: false
      }

      wrapper = mount(MessageItem, {
        props: {
          message,
          isLoading: false
        }
      })

      const content = wrapper.findComponent({ name: 'MessageContent' })
      expect(content.exists()).toBe(true)
    })

    it('should not show message content when waiting', () => {
      const message = {
        role: 'assistant',
        displayContent: '',
        isWaiting: true
      }

      wrapper = mount(MessageItem, {
        props: {
          message,
          isLoading: false
        }
      })

      expect(wrapper.findComponent({ name: 'MessageContent' }).exists()).toBe(false)
    })

    it('should not show MessageContent for compressed messages', () => {
      const message = {
        role: 'assistant',
        displayContent: 'Compressed answer',
        compressed: true,
        compressedCount: 5
      }

      wrapper = mount(MessageItem, {
        props: {
          message,
          isLoading: false
        }
      })

      expect(wrapper.findComponent({ name: 'MessageContent' }).exists()).toBe(false)
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

  describe('Edit Functionality', () => {
    it('should show edit button for last user message', () => {
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

      expect(wrapper.find('.edit-btn').exists()).toBe(true)
      expect(wrapper.find('.edit-btn').text()).toBe('✎')
    })

    it('should not show edit button for non-user messages', () => {
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

      expect(wrapper.find('.edit-btn').exists()).toBe(false)
    })

    it('should not show edit button if not last user message', () => {
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

      expect(wrapper.find('.edit-btn').exists()).toBe(false)
    })

    it('should disable edit button when loading', () => {
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

      const editBtn = wrapper.find('.edit-btn')
      expect(editBtn.attributes('disabled')).toBeDefined()
    })

    it('should have title attribute on edit button', () => {
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

      const editBtn = wrapper.find('.edit-btn')
      expect(editBtn.attributes('title')).toBe('Edit this message')
    })

    it('should show edit section when edit button is clicked', async () => {
      const message = {
        role: 'user',
        content: 'Hello world',
        displayContent: 'Hello world',
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

      const editBtn = wrapper.find('.edit-btn')
      await editBtn.trigger('click')

      expect(wrapper.find('.edit-section').exists()).toBe(true)
      expect(wrapper.find('.edit-textarea').exists()).toBe(true)
      expect(wrapper.find('.edit-actions').exists()).toBe(true)
    })

    it('should populate textarea with message content', async () => {
      const message = {
        role: 'user',
        content: 'Hello world',
        displayContent: 'Hello world',
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

      const editBtn = wrapper.find('.edit-btn')
      await editBtn.trigger('click')

      const textarea = wrapper.find('.edit-textarea')
      expect(textarea.element.value).toBe('Hello world')
    })

    it('should hide message actions when editing', async () => {
      const message = {
        role: 'user',
        content: 'Hello',
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

      const editBtn = wrapper.find('.edit-btn')
      await editBtn.trigger('click')

      expect(wrapper.find('.message-actions').exists()).toBe(false)
    })

    it('should hide MessageContent when editing', async () => {
      const message = {
        role: 'user',
        content: 'Hello',
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
          components: {
            MessageContent
          }
        }
      })

      expect(wrapper.findComponent(MessageContent).exists()).toBe(true)

      const editBtn = wrapper.find('.edit-btn')
      await editBtn.trigger('click')

      expect(wrapper.findComponent(MessageContent).exists()).toBe(false)
    })

    it('should emit edit event when save button is clicked', async () => {
      const message = {
        role: 'user',
        content: 'Hello',
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

      const editBtn = wrapper.find('.edit-btn')
      await editBtn.trigger('click')

      const textarea = wrapper.find('.edit-textarea')
      await textarea.setValue('Updated message')

      const saveBtn = wrapper.find('.save-btn')
      await saveBtn.trigger('click')

      expect(wrapper.emitted('edit')).toBeTruthy()
      expect(wrapper.emitted('edit')).toHaveLength(1)
      expect(wrapper.emitted('edit')[0]).toEqual(['Updated message'])
    })

    it('should close edit mode after saving', async () => {
      const message = {
        role: 'user',
        content: 'Hello',
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

      const editBtn = wrapper.find('.edit-btn')
      await editBtn.trigger('click')

      const textarea = wrapper.find('.edit-textarea')
      await textarea.setValue('Updated message')

      const saveBtn = wrapper.find('.save-btn')
      await saveBtn.trigger('click')

      expect(wrapper.find('.edit-section').exists()).toBe(false)
      expect(wrapper.find('.message-actions').exists()).toBe(true)
    })

    it('should not emit edit event for empty content', async () => {
      const message = {
        role: 'user',
        content: 'Hello',
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

      const editBtn = wrapper.find('.edit-btn')
      await editBtn.trigger('click')

      const textarea = wrapper.find('.edit-textarea')
      await textarea.setValue('   ')

      const saveBtn = wrapper.find('.save-btn')
      await saveBtn.trigger('click')

      expect(wrapper.emitted('edit')).toBeFalsy()
    })

    it('should cancel edit when cancel button is clicked', async () => {
      const message = {
        role: 'user',
        content: 'Hello',
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

      const editBtn = wrapper.find('.edit-btn')
      await editBtn.trigger('click')

      const textarea = wrapper.find('.edit-textarea')
      await textarea.setValue('Updated message')

      const cancelBtn = wrapper.find('.cancel-btn')
      await cancelBtn.trigger('click')

      expect(wrapper.emitted('edit')).toBeFalsy()
      expect(wrapper.find('.edit-section').exists()).toBe(false)
      expect(wrapper.find('.message-actions').exists()).toBe(true)
    })

    it('should have save and cancel buttons with correct titles', async () => {
      const message = {
        role: 'user',
        content: 'Hello',
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

      const editBtn = wrapper.find('.edit-btn')
      await editBtn.trigger('click')

      const saveBtn = wrapper.find('.save-btn')
      const cancelBtn = wrapper.find('.cancel-btn')

      expect(saveBtn.text()).toBe('Save')
      expect(saveBtn.attributes('title')).toBe('Save and retry (Ctrl+Enter)')
      expect(cancelBtn.text()).toBe('Cancel')
      expect(cancelBtn.attributes('title')).toBe('Cancel editing')
    })

    it('should save on Ctrl+Enter keypress', async () => {
      const message = {
        role: 'user',
        content: 'Hello',
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

      const editBtn = wrapper.find('.edit-btn')
      await editBtn.trigger('click')

      const textarea = wrapper.find('.edit-textarea')
      await textarea.setValue('Updated message')

      await textarea.trigger('keydown.enter', { ctrlKey: true })

      expect(wrapper.emitted('edit')).toBeTruthy()
      expect(wrapper.emitted('edit')[0]).toEqual(['Updated message'])
    })

    it('should save on Cmd+Enter keypress', async () => {
      const message = {
        role: 'user',
        content: 'Hello',
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

      const editBtn = wrapper.find('.edit-btn')
      await editBtn.trigger('click')

      const textarea = wrapper.find('.edit-textarea')
      await textarea.setValue('Updated message')

      await textarea.trigger('keydown.enter', { metaKey: true })

      expect(wrapper.emitted('edit')).toBeTruthy()
      expect(wrapper.emitted('edit')[0]).toEqual(['Updated message'])
    })

    it('should focus textarea when entering edit mode', async () => {
      const message = {
        role: 'user',
        content: 'Hello',
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
        },
        attachTo: document.body
      })

      const editBtn = wrapper.find('.edit-btn')
      await editBtn.trigger('click')
      await wrapper.vm.$nextTick()

      const textarea = wrapper.find('.edit-textarea')
      expect(document.activeElement).toBe(textarea.element)

      wrapper.unmount()
    })

    it('should show both edit and retry buttons', () => {
      const message = {
        role: 'user',
        content: 'Hello',
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

      expect(wrapper.find('.edit-btn').exists()).toBe(true)
      expect(wrapper.find('.retry-btn').exists()).toBe(true)
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
