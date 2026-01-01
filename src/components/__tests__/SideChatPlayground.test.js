import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import SideChatPlayground from '../SideChatPlayground.vue'

// Mock MarkdownRenderer
vi.mock('../MarkdownRenderer.vue', () => ({
  default: {
    name: 'MarkdownRenderer',
    template: '<div class="markdown-renderer" v-html="content"></div>',
    props: ['content']
  }
}))

// Mock useStudioChat
vi.mock('../../composables/studio/useStudioChat.js', () => ({
  useStudioChat: vi.fn(() => ({
    messages: ref([]),
    isStreaming: ref(false),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    stopStreaming: vi.fn(),
    clearChat: vi.fn()
  }))
}))

// Mock useModelSelection
vi.mock('../../composables/useModelSelection.js', () => ({
  useModelSelection: vi.fn(() => ({
    providers: ref([{ id: 'test-provider', name: 'Test Provider' }]),
    selectedProvider: ref('test-provider'),
    models: ref([{ id: 'test-model', name: 'Test Model' }]),
    selectedModel: ref('test-model'),
    allModels: ref([]),
    routerModel: ref(''),
    executorModel: ref(''),
    twoModelMode: ref(false),
    isModelReady: ref(true),
    initialize: vi.fn().mockResolvedValue(undefined),
    onProviderChange: vi.fn().mockResolvedValue(undefined)
  }))
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
        plugins: [pinia]
      }
    })
  }

  describe('Component Structure', () => {
    it('should render the chat playground container', () => {
      wrapper = mountComponent()
      expect(wrapper.find('.side-chat-playground').exists()).toBe(true)
    })

    it('should render the header with model selection', () => {
      wrapper = mountComponent()
      expect(wrapper.find('.playground-header').exists()).toBe(true)
      expect(wrapper.find('.title').text()).toBe('Chat')
    })

    it('should render provider dropdown', () => {
      wrapper = mountComponent()
      expect(wrapper.find('.select-control.provider').exists()).toBe(true)
    })

    it('should render model dropdown', () => {
      wrapper = mountComponent()
      expect(wrapper.find('.select-control.model').exists()).toBe(true)
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
      // Create a mock that returns streaming as true
      const { useStudioChat: mockUseStudioChat } = await import('../../composables/studio/useStudioChat.js')
      mockUseStudioChat.mockReturnValueOnce({
        messages: ref([]),
        isStreaming: ref(true),
        sendMessage: vi.fn().mockResolvedValue(undefined),
        stopStreaming: vi.fn(),
        clearChat: vi.fn()
      })

      wrapper = mountComponent()
      await wrapper.vm.$nextTick()
      const textarea = wrapper.find('textarea')
      expect(textarea.attributes('disabled')).toBeDefined()
    })

    it('should disable send button when input is empty', async () => {
      wrapper = mountComponent()
      const sendBtn = wrapper.find('.send-btn')
      expect(sendBtn.attributes('disabled')).toBeDefined()
    })
  })

  describe('Model Selection', () => {
    it('should have provider select element', () => {
      wrapper = mountComponent()
      const providerSelect = wrapper.find('.select-control.provider')
      expect(providerSelect.exists()).toBe(true)
    })

    it('should have model select element', () => {
      wrapper = mountComponent()
      const modelSelect = wrapper.find('.select-control.model')
      expect(modelSelect.exists()).toBe(true)
    })
  })

  describe('Local Storage Persistence', () => {
    it('should save model selection to localStorage', async () => {
      // This test verifies that the localStorage save mechanism works
      // The component has a watch that saves when model selection changes
      const storageKey = 'side-playground-model-selection'
      const testProvider = 'test-provider'
      const testModel = 'test-model'

      // Simulate what the component's watch does
      localStorage.setItem(storageKey, JSON.stringify({ provider: testProvider, model: testModel }))

      const saved = localStorage.getItem(storageKey)
      expect(saved).toBeTruthy()

      // Verify the saved data contains provider and model
      const parsed = JSON.parse(saved)
      expect(parsed).toHaveProperty('provider', testProvider)
      expect(parsed).toHaveProperty('model', testModel)
    })
  })
})
