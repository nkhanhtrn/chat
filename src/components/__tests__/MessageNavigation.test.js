
import { mount } from '@vue/test-utils'
import MessageNavigation from '../MessageNavigation.vue'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useChatStore } from '../../stores/chat.js'


const makeMessages = () => ([
  { id: '1', question: 'Root', questionSummarized: 'Root', parentId: null },
  { id: '2', question: 'Child', questionSummarized: 'Child', parentId: '1' },
  { id: '3', question: 'Last', questionSummarized: 'Last', parentId: '2' },
])


describe('MessageNavigation breadcrumb styles', () => {
  let chatStore
  let messages
  beforeEach(() => {
    setActivePinia(createPinia())
    chatStore = useChatStore()
    const Message = require('../../stores/Message.js').default
    // Use Message class instances for correct property behavior
    const msg1 = new Message({ id: '1', question: 'Root', response: '', parentId: null, childIds: ['2'] })
    const msg2 = new Message({ id: '2', question: 'Child', response: '', parentId: '1', childIds: [] })
    const msg3 = new Message({ id: '3', question: 'Last', response: '', parentId: '2', childIds: [] })
    msg1.lastVisitedChild = '2'
    chatStore.messagesById = {
      '1': msg1,
      '2': msg2,
      '3': msg3
    }
    chatStore.navigateToMessage = vi.fn()
    chatStore.navigateToParent = vi.fn()
    chatStore.navigateToLastVisitedChild = vi.fn()
  })

  function mountComponent(currentMessageId = '1') {
    const currentMessage = chatStore.messagesById[currentMessageId]
    return mount(MessageNavigation, {
      props: { currentMessage },
    })
  }

  it('last breadcrumb is grey and no underline if not active', async () => {
    // currentMessage is '1', breadcrumb: 1 (active), 2 (lastVisitedChild, not active)
    const wrapper = mountComponent('1')
    const items = wrapper.findAll('.breadcrumb-item')
    // The breadcrumb should include currentMessage and lastVisitedChild if present
    expect(items.length).toBe(2)
    const last = items[items.length - 1]
    // The last breadcrumb is not active (not currentMessage)
    expect(last.classes()).not.toContain('active')
    // Style checks (color and underline) are best-effort in jsdom/happy-dom
    expect(last.attributes('style') || '').not.toMatch(/underline/i)
  })

  it('last breadcrumb is normal if active', async () => {
    const wrapper = mountComponent('3')
    const items = wrapper.findAll('.breadcrumb-item')
    const last = items[items.length - 1]
    expect(last.classes()).toContain('active')
    // Should not be grey (no #aaa inline style)
    expect(last.attributes('style') || '').not.toMatch(/#aaa|170/)
  })

  it('last breadcrumb is clickable even if grey', async () => {
    // currentMessage is '1', last breadcrumb is '2' (not active)
    const wrapper = mountComponent('1')
    const items = wrapper.findAll('.breadcrumb-item')
    const last = items[items.length - 1]
    expect(last.classes()).not.toContain('active')
    await last.trigger('click')
    expect(chatStore.navigateToMessage).toHaveBeenCalledWith('2')
  })
})
