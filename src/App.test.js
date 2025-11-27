import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import App from './App.vue'
import * as api from './services/api.js'

vi.mock('./services/api.js')

const mockModel = { id: 'test-model' }
const mockSendChatMessage = vi.fn()
const mockFetchModels = vi.fn()

api.sendChatMessage = mockSendChatMessage
api.fetchModels = mockFetchModels

describe('App.vue', () => {
  beforeEach(() => {
    mockSendChatMessage.mockReset()
    mockFetchModels.mockReset()
  })

  it('shows welcome message on load', async () => {
    mockFetchModels.mockResolvedValue([mockModel])
    const wrapper = mount(App)
    await flushPromises()
    expect(wrapper.text()).toContain('Welcome to your Study Assistant!')
  })

  it('shows error if no models', async () => {
    mockFetchModels.mockResolvedValue([])
    const wrapper = mount(App)
    await flushPromises()
    expect(wrapper.text()).toContain('No models available')
  })

  it('sends a message and streams response', async () => {
    mockFetchModels.mockResolvedValue([mockModel])
    mockSendChatMessage.mockImplementation(async (history, model, onChunk) => {
      onChunk('Hello')
      onChunk(' world!')
      return 'Hello world!'
    })
    const wrapper = mount(App)
    await flushPromises()
    const textarea = wrapper.find('textarea')
    await textarea.setValue('Test question')
    await textarea.trigger('keydown.enter')
    await flushPromises()
    expect(mockSendChatMessage).toHaveBeenCalled()
    expect(wrapper.text()).toContain('Test question')
    expect(wrapper.text()).toContain('Hello world!')
  })

  it('shows error if sendChatMessage fails', async () => {
    mockFetchModels.mockResolvedValue([mockModel])
    mockSendChatMessage.mockRejectedValue(new Error('API Error'))
    const wrapper = mount(App)
    await flushPromises()
    const textarea = wrapper.find('textarea')
    await textarea.setValue('Test error')
    await textarea.trigger('keydown.enter')
    await flushPromises()
    expect(wrapper.text()).toContain('API Error')
  })
})
