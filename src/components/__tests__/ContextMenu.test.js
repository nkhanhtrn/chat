

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


  it('emits close when clicking outside', async () => {
    const wrapper = mount(ContextMenu, { props: baseProps, attachTo: root })
    const backdrop = document.body.querySelector('.context-menu-backdrop')
    expect(backdrop).toBeTruthy()
    await backdrop.click()
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('emits close when pressing Escape key', async () => {
    const wrapper = mount(ContextMenu, { props: baseProps, attachTo: root })
    await document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('does not emit close when pressing Escape if not visible', async () => {
    const wrapper = mount(ContextMenu, { props: { ...baseProps, visible: false }, attachTo: root })
    await document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('close')).toBeFalsy()
  })

  it('does not render menu when not visible', () => {
    mount(ContextMenu, { props: { ...baseProps, visible: false }, attachTo: root })
    const menu = document.body.querySelector('.context-menu')
    expect(menu).toBeFalsy()
  })

  it('disables button when isStreaming is true', () => {
    const wrapper = mount(ContextMenu, { props: { ...baseProps, isStreaming: true }, attachTo: root })
    const btn = document.body.querySelector('.context-menu-btn')
    expect(btn).toBeTruthy()
    expect(btn.disabled).toBe(true)
  })

  it('enables button when isStreaming is false', () => {
    const wrapper = mount(ContextMenu, { props: { ...baseProps, isStreaming: false }, attachTo: root })
    const btn = document.body.querySelector('.context-menu-btn')
    expect(btn).toBeTruthy()
    expect(btn.disabled).toBe(false)
  })

  it('applies disabled styles when streaming', () => {
    mount(ContextMenu, { props: { ...baseProps, isStreaming: true }, attachTo: root })
    const btn = document.body.querySelector('.context-menu-btn')
    expect(btn).toBeTruthy()
    expect(btn.disabled).toBe(true)
    // Verify the disabled attribute is present
    expect(btn.hasAttribute('disabled')).toBe(true)
  })

  it('does not emit highlight when button is disabled and clicked', async () => {
    const wrapper = mount(ContextMenu, { props: { ...baseProps, isStreaming: true }, attachTo: root })
    const btn = document.body.querySelector('.context-menu-btn')
    expect(btn).toBeTruthy()
    expect(btn.disabled).toBe(true)

    // Try to click the disabled button
    await btn.click()

    // Should not emit highlight event
    expect(wrapper.emitted('highlight')).toBeFalsy()
  })

  describe('Color Picker', () => {
    it('renders 5 color circles', () => {
      mount(ContextMenu, { props: baseProps, attachTo: root })
      const circles = document.body.querySelectorAll('.color-circle')
      expect(circles.length).toBe(5)
    })

    it('selects first color by default', () => {
      mount(ContextMenu, { props: baseProps, attachTo: root })
      const circles = document.body.querySelectorAll('.color-circle')
      expect(circles[0].classList.contains('selected')).toBe(true)
      expect(circles[1].classList.contains('selected')).toBe(false)
    })

    it('selects color based on colorIndex prop', () => {
      mount(ContextMenu, { props: { ...baseProps, colorIndex: 2 }, attachTo: root })
      const circles = document.body.querySelectorAll('.color-circle')
      expect(circles[0].classList.contains('selected')).toBe(false)
      expect(circles[2].classList.contains('selected')).toBe(true)
    })

    it('emits keep-highlight when clicking a color circle for new highlight', async () => {
      const wrapper = mount(ContextMenu, { props: baseProps, attachTo: root })
      const circles = document.body.querySelectorAll('.color-circle')

      await circles[3].click()

      expect(wrapper.emitted('keep-highlight')).toBeTruthy()
      expect(wrapper.emitted('keep-highlight')[0]).toEqual([3])
    })

    it('emits change-color when clicking a color circle for existing highlight', async () => {
      const wrapper = mount(ContextMenu, { props: { ...baseProps, hasExistingHighlight: true }, attachTo: root })
      const circles = document.body.querySelectorAll('.color-circle')

      await circles[3].click()

      expect(wrapper.emitted('change-color')).toBeTruthy()
      expect(wrapper.emitted('change-color')[0]).toEqual([3])
    })

    it('updates selected color when clicking a circle', async () => {
      mount(ContextMenu, { props: baseProps, attachTo: root })
      const circles = document.body.querySelectorAll('.color-circle')

      await circles[2].click()

      expect(circles[2].classList.contains('selected')).toBe(true)
      expect(circles[0].classList.contains('selected')).toBe(false)
    })

    it('emits remove-highlight when clicking Remove button for existing highlight', async () => {
      // For existing highlights, clicking the button (which shows "Remove") should emit remove-highlight
      const wrapper = mount(ContextMenu, { props: { ...baseProps, hasExistingHighlight: true }, attachTo: root })

      // Click Remove button
      const btn = document.body.querySelector('.context-menu-btn')
      await btn.click()

      expect(wrapper.emitted('remove-highlight')).toBeTruthy()
    })

    it('emits keep-highlight with selected color index when clicking Highlight button for new selection', async () => {
      // For new selections, clicking the Highlight button should emit keep-highlight with selected color
      const wrapper = mount(ContextMenu, { props: { ...baseProps, hasExistingHighlight: false }, attachTo: root })
      const circles = document.body.querySelectorAll('.color-circle')

      // Select color index 4
      await circles[4].click()

      // Click Highlight button
      const btn = document.body.querySelector('.context-menu-btn')
      await btn.click()

      // keep-highlight is emitted twice: once when clicking color circle, once when clicking button
      expect(wrapper.emitted('keep-highlight')).toBeTruthy()
      expect(wrapper.emitted('keep-highlight')[1]).toEqual([4])
    })

    it('disables color circles when streaming', () => {
      mount(ContextMenu, { props: { ...baseProps, isStreaming: true }, attachTo: root })
      const circles = document.body.querySelectorAll('.color-circle')

      circles.forEach(circle => {
        expect(circle.disabled).toBe(true)
      })
    })

    it('syncs selectedColorIndex when colorIndex prop changes', async () => {
      const wrapper = mount(ContextMenu, { props: baseProps, attachTo: root })

      // Initially first color is selected
      let circles = document.body.querySelectorAll('.color-circle')
      expect(circles[0].classList.contains('selected')).toBe(true)

      // Update prop to select third color
      await wrapper.setProps({ colorIndex: 2 })

      circles = document.body.querySelectorAll('.color-circle')
      expect(circles[2].classList.contains('selected')).toBe(true)
      expect(circles[0].classList.contains('selected')).toBe(false)
    })

    it('resets to prop colorIndex when menu becomes visible', async () => {
      const wrapper = mount(ContextMenu, { props: { ...baseProps, visible: false, colorIndex: 0 }, attachTo: root })

      // Make menu visible with colorIndex 3
      await wrapper.setProps({ visible: true, colorIndex: 3 })

      const circles = document.body.querySelectorAll('.color-circle')
      expect(circles[3].classList.contains('selected')).toBe(true)
    })
  })
})
