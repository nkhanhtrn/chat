import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import DevToolbar from '../DevToolbar.vue'
import { useChatStore } from '../../stores/chat.js'

describe('DevToolbar - Backfill createdAt', () => {
  let wrapper
  let chatStore
  let confirmMock
  let alertMock

  beforeEach(() => {
    setActivePinia(createPinia())
    chatStore = useChatStore()
    chatStore.messagesById = {}

    // Stub global window methods
    confirmMock = vi.fn()
    alertMock = vi.fn()
    vi.stubGlobal('confirm', confirmMock)
    vi.stubGlobal('alert', alertMock)
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    vi.unstubAllGlobals()
  })

  const mountToolbar = () => {
    return mount(DevToolbar, {
      global: {
        provide: {
          triggerStaleDataBanner: () => {}
        },
        stubs: {
          Button: {
            template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
            props: ['disabled', 'variant', 'title']
          }
        }
      }
    })
  }

  describe('button display', () => {
    it('shows "All have dates" when no messages without createdAt', () => {
      chatStore.messagesById = {
        msg1: { id: 'msg1', question: 'Q1', createdAt: 1700000000000 }
      }

      wrapper = mountToolbar()
      const buttons = wrapper.findAll('button')
      const backfillButton = buttons.find(b => b.text().includes('dates'))

      expect(backfillButton.text()).toBe('All have dates')
    })

    it('shows count of messages needing backfill', () => {
      chatStore.messagesById = {
        msg1: { id: 'msg1', question: 'Q1' },
        msg2: { id: 'msg2', question: 'Q2' },
        msg3: { id: 'msg3', question: 'Q3', createdAt: 1700000000000 }
      }

      wrapper = mountToolbar()
      const buttons = wrapper.findAll('button')
      const backfillButton = buttons.find(b => b.text().includes('dates'))

      expect(backfillButton.text()).toBe('Backfill 2 dates')
    })

    it('is disabled when no messages need backfill', () => {
      chatStore.messagesById = {
        msg1: { id: 'msg1', question: 'Q1', createdAt: 1700000000000 }
      }

      wrapper = mountToolbar()
      const buttons = wrapper.findAll('button')
      const backfillButton = buttons.find(b => b.text().includes('dates'))

      expect(backfillButton.attributes('disabled')).toBeDefined()
    })

    it('is enabled when messages need backfill', () => {
      chatStore.messagesById = {
        msg1: { id: 'msg1', question: 'Q1' }
      }

      wrapper = mountToolbar()
      const buttons = wrapper.findAll('button')
      const backfillButton = buttons.find(b => b.text().includes('dates'))

      expect(backfillButton.attributes('disabled')).toBeUndefined()
    })
  })

  describe('click behavior', () => {
    it('shows confirmation dialog when clicked', async () => {
      chatStore.messagesById = {
        msg1: { id: 'msg1', question: 'Q1' },
        msg2: { id: 'msg2', question: 'Q2' }
      }

      confirmMock.mockReturnValue(false)

      wrapper = mountToolbar()
      const buttons = wrapper.findAll('button')
      const backfillButton = buttons.find(b => b.text().includes('dates'))

      await backfillButton.trigger('click')

      expect(confirmMock).toHaveBeenCalledWith(
        expect.stringContaining('2 legacy messages')
      )
    })

    it('does not call backfillCreatedAt when user cancels', async () => {
      chatStore.messagesById = {
        msg1: { id: 'msg1', question: 'Q1' }
      }

      confirmMock.mockReturnValue(false)
      const backfillSpy = vi.spyOn(chatStore, 'backfillCreatedAt')

      wrapper = mountToolbar()
      const buttons = wrapper.findAll('button')
      const backfillButton = buttons.find(b => b.text().includes('dates'))

      await backfillButton.trigger('click')

      expect(backfillSpy).not.toHaveBeenCalled()

      backfillSpy.mockRestore()
    })

    it('calls backfillCreatedAt when user confirms', async () => {
      chatStore.messagesById = {
        msg1: { id: 'msg1', question: 'Q1' }
      }

      confirmMock.mockReturnValue(true)
      const backfillSpy = vi.spyOn(chatStore, 'backfillCreatedAt').mockReturnValue({ updated: 1, total: 1 })

      wrapper = mountToolbar()
      const buttons = wrapper.findAll('button')
      const backfillButton = buttons.find(b => b.text().includes('dates'))

      await backfillButton.trigger('click')

      expect(backfillSpy).toHaveBeenCalledWith(3)

      backfillSpy.mockRestore()
    })

    it('shows alert with result after backfill', async () => {
      chatStore.messagesById = {
        msg1: { id: 'msg1', question: 'Q1' },
        msg2: { id: 'msg2', question: 'Q2' }
      }

      confirmMock.mockReturnValue(true)
      vi.spyOn(chatStore, 'backfillCreatedAt').mockReturnValue({ updated: 2, total: 5 })

      wrapper = mountToolbar()
      const buttons = wrapper.findAll('button')
      const backfillButton = buttons.find(b => b.text().includes('dates'))

      await backfillButton.trigger('click')

      expect(alertMock).toHaveBeenCalledWith('Backfilled 2 of 5 messages')
    })

    it('does nothing when button is disabled and clicked', async () => {
      chatStore.messagesById = {
        msg1: { id: 'msg1', question: 'Q1', createdAt: 1700000000000 }
      }

      const backfillSpy = vi.spyOn(chatStore, 'backfillCreatedAt')

      wrapper = mountToolbar()
      const buttons = wrapper.findAll('button')
      const backfillButton = buttons.find(b => b.text().includes('dates'))

      await backfillButton.trigger('click')

      // The handler checks count === 0 before showing confirm
      expect(confirmMock).not.toHaveBeenCalled()
      expect(backfillSpy).not.toHaveBeenCalled()

      backfillSpy.mockRestore()
    })
  })

  describe('reactivity', () => {
    it('updates button text when messages change', async () => {
      chatStore.messagesById = {
        msg1: { id: 'msg1', question: 'Q1' }
      }

      wrapper = mountToolbar()
      let buttons = wrapper.findAll('button')
      let backfillButton = buttons.find(b => b.text().includes('dates'))

      expect(backfillButton.text()).toBe('Backfill 1 dates')

      // Add another message without createdAt
      chatStore.messagesById.msg2 = { id: 'msg2', question: 'Q2' }
      await wrapper.vm.$nextTick()

      buttons = wrapper.findAll('button')
      backfillButton = buttons.find(b => b.text().includes('dates'))

      expect(backfillButton.text()).toBe('Backfill 2 dates')
    })

    it('updates to "All have dates" after backfill completes', async () => {
      chatStore.messagesById = {
        msg1: { id: 'msg1', question: 'Q1' }
      }

      wrapper = mountToolbar()

      // Simulate backfill completing
      chatStore.messagesById.msg1.createdAt = Date.now()
      await wrapper.vm.$nextTick()

      const buttons = wrapper.findAll('button')
      const backfillButton = buttons.find(b => b.text().includes('dates'))

      expect(backfillButton.text()).toBe('All have dates')
    })
  })
})
