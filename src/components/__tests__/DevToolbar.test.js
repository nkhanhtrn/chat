import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import DevToolbar from '../DevToolbar.vue'
import { useChatStore } from '../../stores/chat.js'
import Message from '../../stores/Message.js'

// Mock storage
vi.mock('../../services/storage.js', () => ({
  saveChatState: vi.fn(),
  loadChatState: vi.fn(() => null),
  clearAllStorage: vi.fn(),
  resolveConflict: vi.fn()
}))

describe('DevToolbar', () => {
  let wrapper
  let store

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useChatStore()
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    vi.useRealTimers()
  })

  const mountComponent = (options = {}) => {
    return mount(DevToolbar, {
      global: {
        provide: {
          triggerStaleDataBanner: vi.fn()
        },
        stubs: {
          Button: {
            template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
            props: ['disabled', 'variant', 'title']
          }
        }
      },
      ...options
    })
  }

  describe('Set createdAt Button', () => {
    it('renders set createdAt button', () => {
      wrapper = mountComponent()
      const buttons = wrapper.findAll('button')
      const setCreatedAtButton = buttons.find(btn => btn.text().includes('Set createdAt'))
      expect(setCreatedAtButton).toBeDefined()
    })

    it('shows count of messages missing createdAt in button text', () => {
      store.messagesById = {
        'msg-1': new Message({ id: 'msg-1', question: 'Q1', response: 'R1' }), // no createdAt
        'msg-2': new Message({ id: 'msg-2', question: 'Q2', response: 'R2' }) // no createdAt
      }

      wrapper = mountComponent()
      const buttons = wrapper.findAll('button')
      const setCreatedAtButton = buttons.find(btn => btn.text().includes('Set createdAt'))
      expect(setCreatedAtButton.text()).toContain('(2)')
    })

    it('is disabled when all messages have createdAt', () => {
      store.messagesById = {
        'msg-1': new Message({ id: 'msg-1', question: 'Q1', response: 'R1', createdAt: Date.now() })
      }

      wrapper = mountComponent()
      const buttons = wrapper.findAll('button')
      const setCreatedAtButton = buttons.find(btn => btn.text().includes('Set createdAt'))
      expect(setCreatedAtButton.attributes('disabled')).toBeDefined()
    })

    it('is enabled when some messages are missing createdAt', () => {
      store.messagesById = {
        'msg-1': new Message({ id: 'msg-1', question: 'Q1', response: 'R1' }) // no createdAt
      }

      wrapper = mountComponent()
      const buttons = wrapper.findAll('button')
      const setCreatedAtButton = buttons.find(btn => btn.text().includes('Set createdAt'))
      expect(setCreatedAtButton.attributes('disabled')).toBeUndefined()
    })

    it('sets createdAt for messages missing it when confirmed', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-15T12:00:00'))
      const now = Date.now()

      // Mock confirm to return true
      vi.stubGlobal('confirm', vi.fn(() => true))

      store.messagesById = {
        'msg-1': new Message({ id: 'msg-1', question: 'Q1', response: 'R1' }),
        'msg-2': new Message({ id: 'msg-2', question: 'Q2', response: 'R2' }),
        'msg-3': new Message({ id: 'msg-3', question: 'Q3', response: 'R3', createdAt: now }) // already has createdAt
      }

      wrapper = mountComponent()
      const buttons = wrapper.findAll('button')
      const setCreatedAtButton = buttons.find(btn => btn.text().includes('Set createdAt'))

      await setCreatedAtButton.trigger('click')

      // Messages without createdAt should now have it
      expect(store.messagesById['msg-1'].createdAt).toBeDefined()
      expect(store.messagesById['msg-2'].createdAt).toBeDefined()
      // Message that already had createdAt should be unchanged
      expect(store.messagesById['msg-3'].createdAt).toBe(now)
    })

    it('does not set createdAt when user cancels confirmation', async () => {
      // Mock confirm to return false
      vi.stubGlobal('confirm', vi.fn(() => false))

      store.messagesById = {
        'msg-1': new Message({ id: 'msg-1', question: 'Q1', response: 'R1' })
      }

      wrapper = mountComponent()
      const buttons = wrapper.findAll('button')
      const setCreatedAtButton = buttons.find(btn => btn.text().includes('Set createdAt'))

      await setCreatedAtButton.trigger('click')

      // Message should still not have createdAt
      expect(store.messagesById['msg-1'].createdAt).toBeUndefined()
    })

    it('spreads createdAt timestamps over one week', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-15T12:00:00'))
      const now = Date.now()
      const oneWeekMs = 7 * 24 * 60 * 60 * 1000

      // Mock confirm to return true
      vi.stubGlobal('confirm', vi.fn(() => true))

      store.messagesById = {
        'msg-1': new Message({ id: 'msg-1', question: 'Q1', response: 'R1' }),
        'msg-2': new Message({ id: 'msg-2', question: 'Q2', response: 'R2' }),
        'msg-3': new Message({ id: 'msg-3', question: 'Q3', response: 'R3' })
      }

      wrapper = mountComponent()
      const buttons = wrapper.findAll('button')
      const setCreatedAtButton = buttons.find(btn => btn.text().includes('Set createdAt'))

      await setCreatedAtButton.trigger('click')

      const timestamps = Object.values(store.messagesById).map(msg => msg.createdAt)

      // All timestamps should be within the past week
      timestamps.forEach(ts => {
        expect(ts).toBeGreaterThanOrEqual(now - oneWeekMs)
        expect(ts).toBeLessThanOrEqual(now)
      })

      // Timestamps should be spread out (not all the same)
      const uniqueTimestamps = new Set(timestamps)
      expect(uniqueTimestamps.size).toBe(3)

      // First timestamp should be close to one week ago
      const minTimestamp = Math.min(...timestamps)
      expect(minTimestamp).toBeCloseTo(now - oneWeekMs, -4) // within ~10 seconds
    })

    it('shows correct count excluding messages that already have createdAt', () => {
      const now = Date.now()
      store.messagesById = {
        'msg-1': new Message({ id: 'msg-1', question: 'Q1', response: 'R1' }), // no createdAt
        'msg-2': new Message({ id: 'msg-2', question: 'Q2', response: 'R2', createdAt: now }), // has createdAt
        'msg-3': new Message({ id: 'msg-3', question: 'Q3', response: 'R3' }) // no createdAt
      }

      wrapper = mountComponent()
      const buttons = wrapper.findAll('button')
      const setCreatedAtButton = buttons.find(btn => btn.text().includes('Set createdAt'))
      expect(setCreatedAtButton.text()).toContain('(2)')
    })
  })
})
