import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AppLayout from '../AppLayout.vue'

vi.mock('@/composables/useVocabulary', () => ({
  useVocabulary: () => ({ vocabDueCount: { value: 0 } }),
}))

function dispatchDocEvent(type: string, clientX = 0) {
  const event = new Event(type)
  Object.defineProperty(event, 'clientX', { value: clientX })
  document.dispatchEvent(event)
}

function mountLayout(slots: Record<string, string> = {}) {
  return mount(AppLayout, {
    slots,
    global: {
      stubs: {
        SettingsModal: true,
        VocabReviewModal: true,
      },
    },
  })
}

describe('AppLayout', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders nav bar', () => {
    const wrapper = mountLayout()
    expect(wrapper.find('.nav-bar').exists()).toBe(true)
    wrapper.unmount()
  })

  it('hides divider when no side panel', () => {
    const wrapper = mountLayout()
    expect(wrapper.find('.divider').exists()).toBe(false)
    wrapper.unmount()
  })

  describe('divider pointer drag', () => {
    it('shows divider when side slot provided', () => {
      const wrapper = mountLayout({ side: '<div>sidebar</div>' })
      expect(wrapper.find('.divider').exists()).toBe(true)
      wrapper.unmount()
    })

    it('updates side width on pointer drag', async () => {
      const wrapper = mountLayout({ side: '<div>sidebar</div>' })
      await wrapper.vm.$nextTick()

      const divider = wrapper.find('.divider').element as HTMLElement
      const downEvent = new Event('pointerdown', { bubbles: true })
      Object.defineProperty(downEvent, 'clientX', { value: 500 })
      divider.dispatchEvent(downEvent)

      dispatchDocEvent('pointermove', 550)
      dispatchDocEvent('pointerup')

      await wrapper.vm.$nextTick()
      const aside = wrapper.find('.side-panel')
      expect(aside.attributes('style')).toContain('width: 550px')
      wrapper.unmount()
    })

    it('clamps width to min/max bounds', async () => {
      const wrapper = mountLayout({ side: '<div>sidebar</div>' })
      await wrapper.vm.$nextTick()

      const divider = wrapper.find('.divider').element as HTMLElement
      const downEvent = new Event('pointerdown', { bubbles: true })
      Object.defineProperty(downEvent, 'clientX', { value: 500 })
      divider.dispatchEvent(downEvent)

      dispatchDocEvent('pointermove', 0)
      dispatchDocEvent('pointerup')

      await wrapper.vm.$nextTick()
      const aside = wrapper.find('.side-panel')
      const style = aside.attributes('style') || ''
      const match = style.match(/width:\s*(\d+)px/)
      const width = match ? parseInt(match[1]) : 0
      expect(width).toBeGreaterThanOrEqual(300)
      wrapper.unmount()
    })
  })
})
