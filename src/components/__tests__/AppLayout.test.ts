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
        SideChatPlayground: true,
      },
    },
  })
}

async function openSide(wrapper: ReturnType<typeof mountLayout>) {
  ;(wrapper.vm as any).toggleSide()
  await wrapper.vm.$nextTick()
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

  it('keeps sidebar closed by default on load', () => {
    const wrapper = mountLayout()
    expect(wrapper.find('.divider').exists()).toBe(false)
    expect(wrapper.find('.side-panel').exists()).toBe(false)
    wrapper.unmount()
  })

  describe('divider pointer drag', () => {
    it('shows divider and tab bar when side slot provided and opened', async () => {
      const wrapper = mountLayout({ side: '<div>sidebar</div>' })
      await openSide(wrapper)
      expect(wrapper.find('.divider').exists()).toBe(true)
      expect(wrapper.find('.side-tab-bar').exists()).toBe(true)
      expect(wrapper.findAll('.side-tab')).toHaveLength(2)
      wrapper.unmount()
    })

    it('updates side width on pointer drag', async () => {
      const wrapper = mountLayout({ side: '<div>sidebar</div>' })
      await openSide(wrapper)

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
      await openSide(wrapper)

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
