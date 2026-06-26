import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CollapseToggle from '../CollapseToggle.vue'

function mountToggle(props = {}) {
  return mount(CollapseToggle, { props: { ...props } })
}

describe('CollapseToggle', () => {
  it('renders a button with the collapse-toggle class', () => {
    const wrapper = mountToggle()
    expect(wrapper.find('button.collapse-toggle').exists()).toBe(true)
  })

  it('defaults to expanded', () => {
    const wrapper = mountToggle()
    expect(wrapper.classes()).not.toContain('collapsed')
    expect(wrapper.attributes('aria-expanded')).toBe('true')
    expect(wrapper.attributes('title')).toBe('Collapse')
  })

  it('reflects the collapsed state', () => {
    const wrapper = mountToggle({ collapsed: true })
    expect(wrapper.classes()).toContain('collapsed')
    expect(wrapper.attributes('aria-expanded')).toBe('false')
    expect(wrapper.attributes('title')).toBe('Expand')
  })

  it('emits toggle on click', async () => {
    const wrapper = mountToggle()
    await wrapper.trigger('click')
    expect(wrapper.emitted('toggle')).toHaveLength(1)
  })

  it('emits one toggle event per click', async () => {
    const wrapper = mountToggle()
    await wrapper.trigger('click')
    await wrapper.trigger('click')
    expect(wrapper.emitted('toggle')).toHaveLength(2)
  })
})
