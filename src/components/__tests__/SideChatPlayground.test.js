import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import SideChatPlayground from '../SideChatPlayground.vue'

// Mock MarkdownRenderer
vi.mock('../MarkdownRenderer.vue', () => ({
  default: {
    name: 'MarkdownRenderer',
    template: '<div class="markdown-renderer" v-html="content"></div>',
    props: ['content']
  }
}))

// Mock UrlAttachmentsPreview
vi.mock('../UrlAttachmentsPreview.vue', () => ({
  default: {
    name: 'UrlAttachmentsPreview',
    template: '<div class="url-attachments-preview"></div>',
    props: ['urls', 'size']
  }
}))

// Mock LMService
vi.mock('../../services/llm/LMService.js', () => ({
  Category: {
    FREE: 'free',
    QUICK: 'quick',
    DETAILS: 'details',
    REASONING: 'reasoning'
  },
  default: {
    listProviders: vi.fn(() => [
      { id: 'lmstudio', name: 'LM Studio', requiresApiKey: false },
      { id: 'cerebras', name: 'Cerebras', requiresApiKey: true },
      { id: 'google', name: 'Google AI', requiresApiKey: true }
    ]),
    sendStream: vi.fn((_providerId, _messages, onChunk, _signal) => {
      // Simulate streaming
      if (onChunk) {
        setTimeout(() => onChunk('Hello'), 0)
        setTimeout(() => onChunk(' World'), 10)
      }
      return new Promise((resolve) => setTimeout(resolve, 20))
    })
  }
}))

// Mock Settings
vi.mock('../../services/Settings.js', () => ({
  Settings: {
    getAll: vi.fn(() => ({
      currentModels: {
        lmstudio: 'local-model',
        cerebras: 'cerebras-model',
        google: 'gemini-model'
      }
    }))
  }
}))

describe('SideChatPlayground', () => {
  let wrapper
  let pinia

  beforeEach(() => {
    // Clear localStorage
    localStorage.clear()

    // Create fresh pinia instance
    pinia = createPinia()
    setActivePinia(pinia)
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  const mountComponent = () => {
    return mount(SideChatPlayground, {
      global: {
        plugins: [pinia],
        stubs: {
          MarkdownRenderer: true,
          UrlAttachmentsPreview: true
        }
      }
    })
  }

  describe('Component Structure', () => {
    it('should render the chat playground container', () => {
      wrapper = mountComponent()
      expect(wrapper.find('.side-chat-playground').exists()).toBe(true)
    })

    it('should render the header with title', () => {
      wrapper = mountComponent()
      expect(wrapper.find('.playground-header').exists()).toBe(true)
      expect(wrapper.find('.title').text()).toBe('Quick Chat')
    })

    it('should render provider dropdown', () => {
      wrapper = mountComponent()
      expect(wrapper.find('.select-control.provider').exists()).toBe(true)
    })

    it('should render clear chat button', () => {
      wrapper = mountComponent()
      expect(wrapper.find('.clear-btn').exists()).toBe(true)
    })

    it('should render messages container', () => {
      wrapper = mountComponent()
      expect(wrapper.find('.messages-container').exists()).toBe(true)
    })

    it('should render input area', () => {
      wrapper = mountComponent()
      expect(wrapper.find('.input-area').exists()).toBe(true)
    })

    it('should render textarea', () => {
      wrapper = mountComponent()
      expect(wrapper.find('textarea').exists()).toBe(true)
    })

    it('should render send button', () => {
      wrapper = mountComponent()
      expect(wrapper.find('.send-btn').exists()).toBe(true)
    })
  })

  describe('Provider Selection', () => {
    it('should populate provider options', () => {
      wrapper = mountComponent()
      const options = wrapper.findAll('.select-control.provider option')
      expect(options.length).toBe(3)
      expect(options[0].text()).toBe('LM Studio')
      expect(options[1].text()).toBe('Cerebras')
      expect(options[2].text()).toBe('Google AI')
    })

    it('should default to lmstudio provider', () => {
      wrapper = mountComponent()
      const select = wrapper.find('.select-control.provider')
      expect(select.element.value).toBe('lmstudio')
    })

    it('should load saved provider from localStorage', () => {
      localStorage.setItem('side-playground-provider-id', 'cerebras')
      wrapper = mountComponent()
      const select = wrapper.find('.select-control.provider')
      expect(select.element.value).toBe('cerebras')
    })

    it('should save provider selection to localStorage', async () => {
      wrapper = mountComponent()
      const select = wrapper.find('.select-control.provider')

      await select.setValue('google')
      expect(localStorage.getItem('side-playground-provider-id')).toBe('google')
    })
  })

  describe('Empty State', () => {
    it('should show empty state when no messages', () => {
      wrapper = mountComponent()
      expect(wrapper.find('.empty-state').exists()).toBe(true)
      expect(wrapper.find('.empty-state p').text()).toBe('Quick chat')
    })
  })

  describe('Input Handling', () => {
    it('should accept user input', async () => {
      wrapper = mountComponent()
      const textarea = wrapper.find('textarea')
      await textarea.setValue('Hello, AI!')
      expect(textarea.element.value).toBe('Hello, AI!')
    })

    it('should disable textarea when streaming', async () => {
      wrapper = mountComponent()
      wrapper.vm.isStreaming = true
      await wrapper.vm.$nextTick()
      const textarea = wrapper.find('textarea')
      expect(textarea.attributes('disabled')).toBeDefined()
    })

    it('should disable send button when input is empty', async () => {
      wrapper = mountComponent()
      const sendBtn = wrapper.find('.send-btn')
      expect(sendBtn.attributes('disabled')).toBeDefined()
    })

    it('should enable send button when input has text', async () => {
      wrapper = mountComponent()
      const textarea = wrapper.find('textarea')
      await textarea.setValue('Hello')
      await wrapper.vm.$nextTick()
      const sendBtn = wrapper.find('.send-btn')
      expect(sendBtn.attributes('disabled')).toBeUndefined()
    })

    it('should disable send button when model is not ready', async () => {
      // Mock settings without currentModels
      const { Settings } = require('../../services/Settings.js')
      Settings.getAll.mockReturnValueOnce({ currentModels: {} })

      wrapper = mountComponent()
      const textarea = wrapper.find('textarea')
      await textarea.setValue('Hello')
      await wrapper.vm.$nextTick()

      // isModelReady should be false when no models are configured
      expect(wrapper.vm.isModelReady).toBe(false)
    })
  })

  describe('Local Storage Persistence', () => {
    it('should save messages to localStorage', async () => {
      wrapper = mountComponent()
      wrapper.vm.messages.value.push({ role: 'user', content: 'Test message' })
      await wrapper.vm.$nextTick()

      const saved = localStorage.getItem('side-playground-chat-history')
      expect(saved).toBeTruthy()
      const parsed = JSON.parse(saved)
      expect(parsed).toEqual([{ role: 'user', content: 'Test message' }])
    })

    it('should load messages from localStorage on mount', () => {
      const testMessages = [{ role: 'user', content: 'Saved message' }]
      localStorage.setItem('side-playground-chat-history', JSON.stringify(testMessages))

      wrapper = mountComponent()
      expect(wrapper.vm.messages.value).toEqual(testMessages)
    })

    it('should clear localStorage when clearChat is called', () => {
      localStorage.setItem('side-playground-chat-history', JSON.stringify([{ role: 'user', content: 'Test' }]))
      wrapper = mountComponent()

      wrapper.vm.clearChat()
      expect(wrapper.vm.messages.value).toEqual([])
      expect(localStorage.getItem('side-playground-chat-history')).toBeNull()
    })
  })

  describe('Clear Chat', () => {
    it('should clear all messages when clear button is clicked', async () => {
      wrapper = mountComponent()
      wrapper.vm.messages.value = [
        { role: 'user', content: 'Test' },
        { role: 'assistant', content: 'Response' }
      ]
      await wrapper.vm.$nextTick()

      await wrapper.find('.clear-btn').trigger('click')
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.messages.value).toEqual([])
    })
  })
})
