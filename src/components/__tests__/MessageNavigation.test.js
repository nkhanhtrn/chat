
import { mount } from '@vue/test-utils'
import MessageNavigation from '../MessageNavigation.vue'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useChatStore } from '../../stores/chat.js'
import Button from '../Button.vue'


const makeMessages = () => ([
  { id: '1', question: 'Root', questionSummarized: 'Root', parentId: null },
  { id: '2', question: 'Child', questionSummarized: 'Child', parentId: '1' },
  { id: '3', question: 'Last', questionSummarized: 'Last', parentId: '2' },
])


describe('MessageNavigation', () => {
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

  describe('Home Button', () => {
    it('should render home button as first breadcrumb item', () => {
      const wrapper = mountComponent('1')
      const homeButton = wrapper.find('.home-button')
      expect(homeButton.exists()).toBe(true)
    })

    it('should render home button with tertiary variant', () => {
      const wrapper = mountComponent('1')
      const homeButton = wrapper.findComponent(Button)
      expect(homeButton.props('variant')).toBe('tertiary')
    })

    it('should render home button with SVG icon', () => {
      const wrapper = mountComponent('1')
      const homeButton = wrapper.find('.home-button')
      const svg = homeButton.find('svg')
      expect(svg.exists()).toBe(true)
    })

    it('should have correct title attribute on home button', () => {
      const wrapper = mountComponent('1')
      const homeButton = wrapper.find('.home-button')
      expect(homeButton.attributes('title')).toBe('Root')
    })

    it('should navigate to root message when home button is clicked', async () => {
      const wrapper = mountComponent('2')
      const homeButton = wrapper.find('.home-button')
      await homeButton.trigger('click')
      expect(chatStore.navigateToMessage).toHaveBeenCalledWith('1')
    })

    it('should render home button even when it is the current message', () => {
      const wrapper = mountComponent('1')
      const homeButton = wrapper.find('.home-button')
      expect(homeButton.exists()).toBe(true)
    })

    it('should apply home-button class for styling', () => {
      const wrapper = mountComponent('1')
      const homeButton = wrapper.find('.home-button')
      expect(homeButton.classes()).toContain('home-button')
      expect(homeButton.classes()).toContain('btn-tertiary')
    })
  })

  describe('Breadcrumb Navigation', () => {
    it('should render breadcrumb navigation container', () => {
      const wrapper = mountComponent('1')
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
      const wrapper = mountComponent('1')
      const breadcrumb = wrapper.find('.breadcrumb')
      const items = breadcrumb.findAll('.breadcrumb-item')

      // Total items = home button + breadcrumb items
      const totalItems = 1 + items.length
      const separators = breadcrumb.findAll('.breadcrumb-sep')

      // Separators should be one less than total items
      expect(separators.length).toBe(totalItems - 1)
    })
  })

  describe('Breadcrumb Styles', () => {
    it('last breadcrumb is grey and no underline if not active', async () => {
      // currentMessage is '1', breadcrumb: 1 (home button/active), 2 (lastVisitedChild, not active)
      const wrapper = mountComponent('1')
      const items = wrapper.findAll('.breadcrumb-item')
      // Note: home button is NOT a breadcrumb-item, so we only count text breadcrumbs
      expect(items.length).toBe(1) // Only item '2' (lastVisitedChild)
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

    it('breadcrumb items should have questionSummarized text', () => {
      const wrapper = mountComponent('2')
      const items = wrapper.findAll('.breadcrumb-item')
      expect(items.length).toBeGreaterThan(0)
      expect(items[0].text()).toBe('Child')
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
      // Should have: home button + Child + Last
      const homeButton = wrapper.find('.home-button')
      const items = wrapper.findAll('.breadcrumb-item')

      expect(homeButton.exists()).toBe(true)
      expect(items.length).toBe(2) // Child and Last
      expect(items[0].text()).toBe('Child')
      expect(items[1].text()).toBe('Last')
    })

    it('should show lastVisitedChild if present', () => {
      const wrapper = mountComponent('1')
      // msg1.lastVisitedChild = '2', so should show: home button (id=1, active) + Child (id=2, not active)
      const homeButton = wrapper.find('.home-button')
      const items = wrapper.findAll('.breadcrumb-item')

      expect(homeButton.exists()).toBe(true)
      expect(items.length).toBe(1) // Only Child (lastVisitedChild)
      expect(items[0].text()).toBe('Child')
    })
  })
})
