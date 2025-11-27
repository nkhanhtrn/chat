

import { mount } from '@vue/test-utils'
import ContextMenu from '../ContextMenu.vue'

describe('ContextMenu', () => {
  let root
  const baseProps = {
    visible: true,
    x: 100,
    y: 200,
    highlightedText: 'test highlight'
  }

  beforeEach(() => {
    root = document.createElement('div')
    document.body.appendChild(root)
  })
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders at correct position when visible', () => {
    const wrapper = mount(ContextMenu, { props: baseProps, attachTo: root })
    const menu = document.body.querySelector('.context-menu')
    expect(menu).toBeTruthy()
    expect(menu.style.left).toBe('100px')
    expect(menu.style.top).toBe('200px')
    expect(menu.style.display).toBe('block')
  })

  it('emits highlight and close when button clicked', async () => {
    const wrapper = mount(ContextMenu, { props: baseProps, attachTo: root })
    const btn = document.body.querySelector('.context-menu-btn')
    expect(btn).toBeTruthy()
    await btn.click()
    // wrapper.emitted() does not work with teleport, so listen to emitted events
    // Instead, use a spy or check DOM changes if needed
    // But here, we can check emitted events on the wrapper
    expect(wrapper.emitted('highlight')).toBeTruthy()
    expect(wrapper.emitted('highlight')[0]).toEqual(['test highlight'])
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('emits close when clicking outside', async () => {
    const wrapper = mount(ContextMenu, { props: baseProps, attachTo: root })
    const backdrop = document.body.querySelector('.context-menu-backdrop')
    expect(backdrop).toBeTruthy()
    await backdrop.click()
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('does not render menu when not visible', () => {
    mount(ContextMenu, { props: { ...baseProps, visible: false }, attachTo: root })
    const menu = document.body.querySelector('.context-menu')
    expect(menu).toBeFalsy()
  })
})
