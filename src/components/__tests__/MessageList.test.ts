import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import MessageList from '../project/MessageList.vue'
import type { ProjectMessage } from '@/types/project'

function msg(id: string, role: 'user' | 'assistant', content: string): ProjectMessage {
  return { id, role, content, timestamp: Date.now() }
}

// Stub that exposes the message role/content and forwards the edit event.
const MessageStub = defineComponent({
  name: 'ProjectChatMessage',
  props: {
    msg: { type: Object as () => ProjectMessage, required: true },
    isLastMessage: Boolean,
    isLastUserMessage: Boolean,
    isStreaming: Boolean,
  },
  emits: ['edit'],
  template: `<div class="msg-stub" :data-role="msg.role" @click="$emit('edit', 'edited')">{{ msg.content }}</div>`,
})

function mountList(messages: ProjectMessage[], props: Record<string, unknown> = {}) {
  return mount(MessageList, {
    props: { messages, ...props },
    global: { stubs: { ProjectChatMessage: MessageStub } },
  })
}

describe('MessageList', () => {
  it('shows the empty state when there are no messages', () => {
    const wrapper = mountList([])
    expect(wrapper.find('.empty-state').exists()).toBe(true)
    expect(wrapper.findAll('.turn')).toHaveLength(0)
  })

  it('groups a question and its answer into a single turn', () => {
    const wrapper = mountList([
      msg('u1', 'user', 'What is Vue?'),
      msg('a1', 'assistant', 'A framework.'),
    ])
    expect(wrapper.findAll('.turn')).toHaveLength(1)
    expect(wrapper.findAll('.msg-stub')).toHaveLength(2)
  })

  it('groups consecutive exchanges into separate turns', () => {
    const wrapper = mountList([
      msg('u1', 'user', 'Q1'),
      msg('a1', 'assistant', 'A1'),
      msg('u2', 'user', 'Q2'),
      msg('a2', 'assistant', 'A2'),
    ])
    expect(wrapper.findAll('.turn')).toHaveLength(2)
    expect(wrapper.findAll('.msg-stub')).toHaveLength(4)
  })

  it('starts a new turn at every user message', () => {
    const wrapper = mountList([
      msg('u1', 'user', 'Q1'),
      msg('u2', 'user', 'Q2'),
      msg('a1', 'assistant', 'A1'),
    ])
    const turns = wrapper.findAll('.turn')
    expect(turns).toHaveLength(2)
    expect(turns[0].findAll('.msg-stub')).toHaveLength(1)
    expect(turns[1].findAll('.msg-stub')).toHaveLength(2)
  })

  it('collapses a turn into a question preview on toggle', async () => {
    const wrapper = mountList([
      msg('u1', 'user', 'What is Vue?'),
      msg('a1', 'assistant', 'A framework.'),
    ])
    expect(wrapper.find('.turn-body').exists()).toBe(true)
    expect(wrapper.find('.turn-preview').exists()).toBe(false)

    await wrapper.find('.turn-toggle').trigger('click')

    expect(wrapper.find('.turn-preview').exists()).toBe(true)
    expect(wrapper.find('.turn-preview').text()).toBe('What is Vue?')
    expect(wrapper.find('.turn-body').exists()).toBe(false)
    expect(wrapper.findAll('.msg-stub')).toHaveLength(0)
  })

  it('expands a collapsed turn when toggled again', async () => {
    const wrapper = mountList([
      msg('u1', 'user', 'Q1'),
      msg('a1', 'assistant', 'A1'),
    ])
    await wrapper.find('.turn-toggle').trigger('click')
    await wrapper.find('.turn-toggle').trigger('click')
    expect(wrapper.find('.turn-body').exists()).toBe(true)
    expect(wrapper.find('.turn-preview').exists()).toBe(false)
  })

  it('only collapses the targeted turn', async () => {
    const wrapper = mountList([
      msg('u1', 'user', 'Q1'),
      msg('a1', 'assistant', 'A1'),
      msg('u2', 'user', 'Q2'),
      msg('a2', 'assistant', 'A2'),
    ])
    const toggles = wrapper.findAll('.turn-toggle')
    await toggles[0].trigger('click')
    expect(wrapper.findAll('.turn-preview')).toHaveLength(1)
    expect(wrapper.findAll('.turn-body')).toHaveLength(1)
  })

  it('forwards edit events with the original message index', async () => {
    const wrapper = mountList([
      msg('u1', 'user', 'Q1'),
      msg('a1', 'assistant', 'A1'),
      msg('u2', 'user', 'Q2'),
      msg('a2', 'assistant', 'A2'),
    ])
    const stubs = wrapper.findAll('.msg-stub')
    await stubs[3].trigger('click') // a2 -> original index 3
    expect(wrapper.emitted('edit')).toBeTruthy()
    expect(wrapper.emitted('edit')![0]).toEqual([3, 'edited'])
  })

  it('does not render a toggle for the actively-streaming turn', () => {
    const wrapper = mountList(
      [msg('u1', 'user', 'Q1'), msg('a1', 'assistant', 'A1')],
      { isStreaming: true }
    )
    expect(wrapper.find('.turn-toggle').exists()).toBe(false)
    expect(wrapper.find('.turn-body').exists()).toBe(true)
  })
})
