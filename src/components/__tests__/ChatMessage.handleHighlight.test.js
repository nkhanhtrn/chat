import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'

import ChatMessage from '../ChatMessage.vue'
import Message from '../../stores/Message.js'
import * as api from '../../services/api.js'

// Helper to access state from setup script
function getState(wrapper) {
  return wrapper.vm.$.setupState.state
}


vi.mock('../../services/api.js')

describe('ChatMessage handleHighlight', () => {
  let wrapper, parentMsg
  beforeEach(() => {
    parentMsg = new Message({ id: 'parent', question: 'Q', response: 'R', children: [] })
    wrapper = mount(ChatMessage, {
      props: { message: parentMsg },
      global: { plugins: [createPinia()] }
    })
    // Patch chatStore.currentModel
    wrapper.vm.chatStore = { currentModel: 'model' }
    // Patch reactive to identity (for test)
    wrapper.vm.reactive = (x) => x
    if (!globalThis.crypto) globalThis.crypto = {};
    globalThis.crypto.randomUUID = () => 'childid'
  })

  it('creates a child message and streams response', async () => {
    const state = getState(wrapper)
    const fakeChunk1 = 'hello'
    const fakeChunk2 = ' world'
    api.sendChatMessage.mockImplementation(async (q, m, cb) => {
      cb(fakeChunk1)
      cb(fakeChunk2)
    })
    await wrapper.vm.handleHighlight('child question')
    // Should add child to parent
    expect(state.currentMessage.parentId).toBe(parentMsg.id)
    expect(state.currentMessage.question).toBe('child question')
    expect(state.currentMessage.response).toBe(fakeChunk1 + fakeChunk2)
    expect(parentMsg.children.length).toBe(1)
    expect(parentMsg.children[0].question).toBe('child question')
  })

  it('sets error if sendChatMessage throws', async () => {
    const state = getState(wrapper)
    api.sendChatMessage.mockImplementation(async () => { throw new Error('fail') })
    await wrapper.vm.handleHighlight('child question')
    expect(state.error).toBe('fail')
    expect(state.isChildStreaming).toBe(false)
  })

  it('does nothing if question is empty', async () => {
    const state = getState(wrapper)
    state.isChildStreaming = false
    await wrapper.vm.handleHighlight('')
    expect(parentMsg.children.length).toBe(0)
  })

  it('does nothing if already streaming', async () => {
    const state = getState(wrapper)
    state.isChildStreaming = true
    await wrapper.vm.handleHighlight('child question')
    expect(parentMsg.children.length).toBe(0)
  })
})
