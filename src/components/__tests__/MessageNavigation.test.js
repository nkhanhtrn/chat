
import { mount } from '@vue/test-utils'
import MessageNavigation from '../MessageNavigation.vue'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useChatStore } from '../../stores/chat.js'
import Button from '../Button.vue'


describe('MessageNavigation', () => {
  let chatStore

  beforeEach(() => {
    setActivePinia(createPinia())
    chatStore = useChatStore()
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
    chatStore.navigateToMessage = vi.fn().mockReturnValue(0)
    chatStore.navigateToParent = vi.fn().mockReturnValue(0)
    chatStore.navigateToLastVisitedChild = vi.fn().mockReturnValue(0)
  })

  function mountComponent(currentMessageId = '1') {
    const currentMessage = chatStore.messagesById[currentMessageId]
    return mount(MessageNavigation, {
      props: { currentMessage },
      global: {
        provide: {
          getScrollPosition: () => 0,
          setScrollPosition: () => {}
        }
      }
    })
  }

  describe('Home Button (First Breadcrumb Item)', () => {
    it('should render first breadcrumb item with home icon (SVG)', () => {
      const wrapper = mountComponent('2')
      const items = wrapper.findAll('.breadcrumb-item')
      expect(items.length).toBeGreaterThan(0)
      const firstItem = items[0]
      const svg = firstItem.find('svg')
      expect(svg.exists()).toBe(true)
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
      expect(chatStore.navigateToMessage).toHaveBeenCalledWith('1', expect.any(Number))
    })

    it('should not render breadcrumb when viewing root message (only 1 item)', () => {
      const wrapper = mountComponent('1')
      // Component only renders when breadcrumbMessages.length > 1
      expect(wrapper.find('.breadcrumb-nav').exists()).toBe(false)
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
    it('current message breadcrumb should have active class', async () => {
      // currentMessage is '2', breadcrumb: Root (home icon), Child (active)
      const wrapper = mountComponent('2')
      const items = wrapper.findAll('.breadcrumb-item')
      expect(items.length).toBe(2) // Root + Child
      const last = items[items.length - 1]
      // The last breadcrumb is active (currentMessage)
      expect(last.classes()).toContain('active')
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
      // navigateToMessage is called with messageId and current scroll position
      expect(chatStore.navigateToMessage).toHaveBeenCalledWith('2', expect.any(Number))
    })

    it('breadcrumb items should have questionSummarized text', () => {
      const wrapper = mountComponent('2')
      const items = wrapper.findAll('.breadcrumb-item')
      expect(items.length).toBe(2)
      // Second item (idx=1) shows questionSummarized
      expect(items[1].text()).toBe('Child')
    })

    it('active breadcrumb should have active class', () => {
      const wrapper = mountComponent('2')
      const items = wrapper.findAll('.breadcrumb-item')
      const activeItem = items.find(item => item.classes().includes('active'))
      expect(activeItem).toBeDefined()
      expect(activeItem.text()).toBe('Child')
    })
  })

  describe('Navigation Path', () => {
    it('should show full path from root to current message', () => {
      const wrapper = mountComponent('3')
      // Should have: Root (home icon) + Child + Last
      const items = wrapper.findAll('.breadcrumb-item')

      expect(items.length).toBe(3) // Root, Child, and Last
      // First item has SVG (home icon)
      expect(items[0].find('svg').exists()).toBe(true)
      expect(items[1].text()).toBe('Child')
      expect(items[2].text()).toBe('Last')
    })

    it('should not render breadcrumb for root message (only 1 item in path)', () => {
      const wrapper = mountComponent('1')
      // msg1.lastVisitedChild = '2', but we only show path to current message
      // Component only renders when breadcrumbMessages.length > 1
      expect(wrapper.find('.breadcrumb-nav').exists()).toBe(false)
    })
  })
})
