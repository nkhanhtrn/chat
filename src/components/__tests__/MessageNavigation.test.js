
import { mount } from '@vue/test-utils'
import MessageNavigation from '../MessageNavigation.vue'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useChatStore } from '../../stores/chat.js'
import Button from '../Button.vue'

// Mock vue-router
const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush
  })
}))

describe('MessageNavigation', () => {
  let chatStore

  beforeEach(() => {
    setActivePinia(createPinia())
    chatStore = useChatStore()
    chatStore.currentChatId = 'chat1'
    const Message = require('../../stores/Message.js').default
    // Use Message class instances for correct property behavior
    const msg1 = new Message({ id: '1', question: 'Root', response: '', parentId: null, childIds: ['2'] })
    const msg2 = new Message({ id: '2', question: 'Child', response: '', parentId: '1', childIds: ['3'] })
    const msg3 = new Message({ id: '3', question: 'Last', response: '', parentId: '2', childIds: [] })
    msg1.lastVisitedChild = '2'
    chatStore.messagesById = {
      '1': msg1,
      '2': msg2,
      '3': msg3
    }
    chatStore.saveScrollPosition = vi.fn()
    mockPush.mockClear()
  })

  function mountComponent(currentMessageId = '1') {
    const currentMessage = chatStore.messagesById[currentMessageId]
    chatStore.currentMessageId = currentMessageId
    return mount(MessageNavigation, {
      props: { currentMessage },
      global: {
        provide: {
          getScrollPosition: () => 0
        }
      }
    })
  }

  describe('Home Button (First Breadcrumb Item)', () => {
    it('should render first breadcrumb item with questionSummarized text', () => {
      const wrapper = mountComponent('2')
      const items = wrapper.findAll('.breadcrumb-item')
      expect(items.length).toBeGreaterThan(0)
      const firstItem = items[0]
      expect(firstItem.text()).toContain('Root')
    })

    it('should render first breadcrumb with tertiary variant', () => {
      // Use '2' to test with at least 2 breadcrumb items (component only renders when > 1)
      const wrapper = mountComponent('2')
      const buttons = wrapper.findAllComponents(Button)
      expect(buttons.length).toBeGreaterThan(0)
      expect(buttons[0].props('variant')).toBe('tertiary')
    })

    it('should have correct title attribute on first breadcrumb item', () => {
      const wrapper = mountComponent('2')
      const items = wrapper.findAll('.breadcrumb-item')
      expect(items[0].attributes('title')).toBe('Root')
    })

    it('should navigate to root message when first breadcrumb item is clicked', async () => {
      const wrapper = mountComponent('2')
      const items = wrapper.findAll('.breadcrumb-item')
      await items[0].trigger('click')
      expect(mockPush).toHaveBeenCalledWith({
        name: 'question',
        params: { id: 'chat1', questionId: '1' }
      })
      expect(chatStore.saveScrollPosition).toHaveBeenCalledWith('2', 0)
    })

    it('should render breadcrumb even for root message', () => {
      const wrapper = mountComponent('1')
      // Breadcrumb is rendered for any message (to show children indicator)
      expect(wrapper.find('.breadcrumb-nav').exists()).toBe(true)
      // Only one breadcrumb item (the root itself)
      const items = wrapper.findAll('.breadcrumb-item')
      expect(items.length).toBe(1)
    })
  })

  describe('Breadcrumb Navigation', () => {
    it('should render breadcrumb navigation container', () => {
      // Use '2' to get at least 2 breadcrumb items (component only renders when > 1)
      const wrapper = mountComponent('2')
      expect(wrapper.find('.breadcrumb-nav').exists()).toBe(true)
      expect(wrapper.find('.breadcrumb').exists()).toBe(true)
    })

    it('should render separator between breadcrumb items', () => {
      const wrapper = mountComponent('2')
      const separators = wrapper.findAll('.breadcrumb-sep')
      expect(separators.length).toBeGreaterThan(0)
      expect(separators[0].text()).toBe('>')
    })

    it('should not render separator after last breadcrumb item', () => {
      const wrapper = mountComponent('2')
      const items = wrapper.findAll('.breadcrumb-item')
      const separators = wrapper.findAll('.breadcrumb-sep')

      // Separators should be one less than total items
      expect(separators.length).toBe(items.length - 1)
    })
  })

  describe('Breadcrumb Styles', () => {
    it('current message breadcrumb should not have active class when it has children', async () => {
      // currentMessage is '2', breadcrumb: Root (home icon), Child
      // msg2 has children, so it should NOT have active class
      const wrapper = mountComponent('2')
      const items = wrapper.findAll('.breadcrumb-item')
      expect(items.length).toBe(2) // Root + Child
      const last = items[items.length - 1]
      // The last breadcrumb should NOT be active because it has children
      expect(last.classes()).not.toContain('active')
    })

    it('last breadcrumb is normal if active', async () => {
      const wrapper = mountComponent('3')
      const items = wrapper.findAll('.breadcrumb-item')
      const last = items[items.length - 1]
      expect(last.classes()).toContain('active')
      // Should not be grey (no #aaa inline style)
      expect(last.attributes('style') || '').not.toMatch(/#aaa|170/)
    })

    it('non-active breadcrumb is clickable', async () => {
      // currentMessage is '3', breadcrumb: Root, Child, Last
      // Click on 'Child' which is not active
      const wrapper = mountComponent('3')
      const items = wrapper.findAll('.breadcrumb-item')
      const childItem = items[1] // 'Child' which is not active
      expect(childItem.classes()).not.toContain('active')
      await childItem.trigger('click')
      // Router push is called with the question route
      expect(mockPush).toHaveBeenCalledWith({
        name: 'question',
        params: { id: 'chat1', questionId: '2' }
      })
      expect(chatStore.saveScrollPosition).toHaveBeenCalledWith('3', 0)
    })

    it('breadcrumb items should have questionSummarized text', () => {
      const wrapper = mountComponent('2')
      const items = wrapper.findAll('.breadcrumb-item')
      expect(items.length).toBe(2)
      // Second item (idx=1) shows questionSummarized
      expect(items[1].text()).toContain('Child')
    })

    it('active breadcrumb should have active class when no children', () => {
      // msg3 has no children, so it should have active class
      const wrapper = mountComponent('3')
      const items = wrapper.findAll('.breadcrumb-item')
      const activeItem = items.find(item => item.classes().includes('active'))
      expect(activeItem).toBeDefined()
      expect(activeItem.text()).toContain('Last')
    })
  })

  describe('Navigation Path', () => {
    it('should show full path from root to current message', () => {
      const wrapper = mountComponent('3')
      // Should have: Root + Child + Last
      const items = wrapper.findAll('.breadcrumb-item')

      expect(items.length).toBe(3) // Root, Child, and Last
      // First item shows questionSummarized text
      expect(items[0].text()).toContain('Root')
      expect(items[1].text()).toContain('Child')
      expect(items[2].text()).toContain('Last')
    })

    it('should render breadcrumb for root message', () => {
      const wrapper = mountComponent('1')
      // Breadcrumb is rendered even for root
      expect(wrapper.find('.breadcrumb-nav').exists()).toBe(true)
      const items = wrapper.findAll('.breadcrumb-item')
      expect(items.length).toBe(1)
    })
  })

  describe('Children Popup', () => {
    it('should not show popup initially', () => {
      const wrapper = mountComponent('2')
      expect(wrapper.find('.children-popup').exists()).toBe(false)
    })

    it('should show popup when clicking current message with children', async () => {
      // msg2 has one child (msg3)
      const wrapper = mountComponent('2')
      const items = wrapper.findAll('.breadcrumb-item')
      const currentItem = items[items.length - 1] // Last item is current message

      await currentItem.trigger('click')

      expect(wrapper.find('.children-popup').exists()).toBe(true)
      expect(wrapper.find('.children-popup-content').exists()).toBe(true)
    })

    it('should not show popup when clicking current message with no children', async () => {
      // msg3 has no children
      const wrapper = mountComponent('3')
      const items = wrapper.findAll('.breadcrumb-item')
      const currentItem = items[items.length - 1]

      await currentItem.trigger('click')

      expect(wrapper.find('.children-popup').exists()).toBe(false)
    })

    it('should list all children in popup', async () => {
      const wrapper = mountComponent('2')
      const items = wrapper.findAll('.breadcrumb-item')
      const currentItem = items[items.length - 1]

      await currentItem.trigger('click')

      const popupItems = wrapper.findAll('.children-popup-item')
      expect(popupItems.length).toBe(1) // msg2 has one child (msg3)
      expect(popupItems[0].text()).toBe('Last')
    })

    it('should close popup when clicking backdrop', async () => {
      const wrapper = mountComponent('2')
      const items = wrapper.findAll('.breadcrumb-item')
      const currentItem = items[items.length - 1]

      await currentItem.trigger('click')
      expect(wrapper.find('.children-popup').exists()).toBe(true)

      await wrapper.find('.children-popup-backdrop').trigger('click')
      expect(wrapper.find('.children-popup').exists()).toBe(false)
    })

    it('should toggle popup on repeated clicks', async () => {
      const wrapper = mountComponent('2')
      const items = wrapper.findAll('.breadcrumb-item')
      const currentItem = items[items.length - 1]

      // First click - open
      await currentItem.trigger('click')
      expect(wrapper.find('.children-popup').exists()).toBe(true)

      // Second click - close
      await currentItem.trigger('click')
      expect(wrapper.find('.children-popup').exists()).toBe(false)

      // Third click - open again
      await currentItem.trigger('click')
      expect(wrapper.find('.children-popup').exists()).toBe(true)
    })

    it('should navigate to child when clicking popup item', async () => {
      const wrapper = mountComponent('2')
      const items = wrapper.findAll('.breadcrumb-item')
      const currentItem = items[items.length - 1]

      await currentItem.trigger('click')

      const popupItems = wrapper.findAll('.children-popup-item')
      await popupItems[0].trigger('click')

      expect(mockPush).toHaveBeenCalledWith({
        name: 'question',
        params: { id: 'chat1', questionId: '3' }
      })
      expect(chatStore.saveScrollPosition).toHaveBeenCalledWith('2', 0)
    })

    it('should close popup after navigating to child', async () => {
      const wrapper = mountComponent('2')
      const items = wrapper.findAll('.breadcrumb-item')
      const currentItem = items[items.length - 1]

      await currentItem.trigger('click')
      expect(wrapper.find('.children-popup').exists()).toBe(true)

      const popupItems = wrapper.findAll('.children-popup-item')
      await popupItems[0].trigger('click')

      expect(wrapper.find('.children-popup').exists()).toBe(false)
    })

    it('should show truncated question if questionSummarized is not available', async () => {
      // Create a message with a long question but no questionSummarized
      const Message = require('../../stores/Message.js').default
      const longQuestion = 'This is a very long question that should be truncated in the popup'
      const msg4 = new Message({ id: '4', question: longQuestion, response: '', parentId: '2', childIds: [] })
      // Explicitly set questionSummarized to null to test truncation
      msg4.questionSummarized = null
      chatStore.messagesById['4'] = msg4
      chatStore.messagesById['2'].childIds.push('4')

      const wrapper = mountComponent('2')
      const items = wrapper.findAll('.breadcrumb-item')
      const currentItem = items[items.length - 1]

      await currentItem.trigger('click')

      const popupItems = wrapper.findAll('.children-popup-item')
      // Find the item for msg4 (the one with the long question)
      const msg4Item = popupItems.find(item => item.attributes('title') === longQuestion)
      expect(msg4Item).toBeDefined()
      // Should be truncated to 30 chars + '...'
      expect(msg4Item.text()).toBe('This is a very long question t...')
    })
  })

  describe('Current Message Active State', () => {
    it('should have active class when current message has no children', () => {
      // msg3 has no children
      const wrapper = mountComponent('3')
      const items = wrapper.findAll('.breadcrumb-item')
      const currentItem = items[items.length - 1]
      expect(currentItem.classes()).toContain('active')
    })

    it('should not have active class when current message has children', () => {
      // msg2 has children
      const wrapper = mountComponent('2')
      const items = wrapper.findAll('.breadcrumb-item')
      const currentItem = items[items.length - 1]
      expect(currentItem.classes()).not.toContain('active')
    })
  })

  describe('Streaming Indicator', () => {
    it('should not show streaming indicator when not streaming', () => {
      chatStore.streamingMessageId = null
      const wrapper = mountComponent('2')
      expect(wrapper.find('.streaming-indicator').exists()).toBe(false)
    })

    it('should show streaming indicator on current streaming message', () => {
      chatStore.streamingMessageId = '2'
      const wrapper = mountComponent('2')
      expect(wrapper.find('.streaming-indicator').exists()).toBe(true)
    })

    it('should not show streaming indicator on non-streaming message', () => {
      chatStore.streamingMessageId = '3'
      const wrapper = mountComponent('2')
      // The indicator should only appear on the message that matches streamingMessageId
      const items = wrapper.findAll('.breadcrumb-item')
      // msg1 (Root) should not have indicator
      expect(items[0].find('.streaming-indicator').exists()).toBe(false)
    })

    it('should show streaming indicator on ancestor message in breadcrumb', () => {
      // When viewing msg3, if msg1 is streaming, it should show indicator on msg1
      chatStore.streamingMessageId = '1'
      const wrapper = mountComponent('3')
      const items = wrapper.findAll('.breadcrumb-item')
      // First item is msg1 (Root) which should have indicator
      expect(items[0].find('.streaming-indicator').exists()).toBe(true)
    })

    it('should show streaming indicator on last breadcrumb item when it is streaming', () => {
      chatStore.streamingMessageId = '3'
      const wrapper = mountComponent('3')
      const items = wrapper.findAll('.breadcrumb-item')
      const lastItem = items[items.length - 1]
      expect(lastItem.find('.streaming-indicator').exists()).toBe(true)
    })
  })
})
