import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import SideChatPlayground from '../SideChatPlayground.vue'
import { useSideChatStore, type SideChatMessage } from '@/stores/sideChat'

function mountPlayground() {
  return mount(SideChatPlayground, {
    global: { stubs: { MarkdownRenderer: true, ExpandableInput: true } },
  })
}

describe('SideChatPlayground', () => {
  let store: ReturnType<typeof useSideChatStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useSideChatStore()
  })

  it('shows the empty state when there are no messages', () => {
    const wrapper = mountPlayground()
    expect(wrapper.find('.empty-state').exists()).toBe(true)
  })

  it('groups a question and its answer into a single turn', async () => {
    store.$patch({
      messages: [
        { id: 'u1', role: 'user', content: 'Hi' },
        { id: 'a1', role: 'assistant', content: 'Hello!' },
      ] as SideChatMessage[],
    })
    const wrapper = mountPlayground()
    await flushPromises()
    expect(wrapper.findAll('.turn')).toHaveLength(1)
    expect(wrapper.findAll('.bubble')).toHaveLength(2)
  })

  it('groups consecutive exchanges into separate turns', async () => {
    store.$patch({
      messages: [
        { id: 'u1', role: 'user', content: 'Q1' },
        { id: 'a1', role: 'assistant', content: 'A1' },
        { id: 'u2', role: 'user', content: 'Q2' },
        { id: 'a2', role: 'assistant', content: 'A2' },
      ] as SideChatMessage[],
    })
    const wrapper = mountPlayground()
    await flushPromises()
    expect(wrapper.findAll('.turn')).toHaveLength(2)
  })

  it('collapses a turn into a question preview on toggle', async () => {
    store.$patch({
      messages: [
        { id: 'u1', role: 'user', content: 'What time is it?' },
        { id: 'a1', role: 'assistant', content: 'Noon.' },
      ] as SideChatMessage[],
    })
    const wrapper = mountPlayground()
    await flushPromises()
    expect(wrapper.find('.turn-preview').exists()).toBe(false)

    await wrapper.find('.turn-toggle').trigger('click')

    expect(wrapper.find('.turn-preview').exists()).toBe(true)
    expect(wrapper.find('.turn-preview').text()).toBe('What time is it?')
    expect(wrapper.findAll('.bubble')).toHaveLength(0)
  })

  it('expands a collapsed turn when toggled again', async () => {
    store.$patch({
      messages: [
        { id: 'u1', role: 'user', content: 'Q1' },
        { id: 'a1', role: 'assistant', content: 'A1' },
      ] as SideChatMessage[],
    })
    const wrapper = mountPlayground()
    await flushPromises()
    await wrapper.find('.turn-toggle').trigger('click')
    await wrapper.find('.turn-toggle').trigger('click')
    expect(wrapper.find('.turn-preview').exists()).toBe(false)
    expect(wrapper.findAll('.bubble').length).toBeGreaterThan(0)
  })

  it('does not render a toggle for the actively-streaming turn', async () => {
    store.$patch({
      messages: [
        { id: 'u1', role: 'user', content: 'Q1' },
        { id: 'a1', role: 'assistant', content: 'A1' },
      ] as SideChatMessage[],
      isStreaming: true,
    })
    const wrapper = mountPlayground()
    await flushPromises()
    expect(wrapper.find('.turn-toggle').exists()).toBe(false)
    expect(wrapper.findAll('.bubble').length).toBeGreaterThan(0)
  })
})
