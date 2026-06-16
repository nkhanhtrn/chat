import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Modal from '../modal/Modal.vue'

function mountModal(props = {}) {
  return mount(Modal, {
    props: { visible: true, ...props },
    attachTo: document.body,
  })
}

describe('Modal', () => {
  it('renders when visible', () => {
    const wrapper = mountModal()
    expect(document.querySelector('.modal-overlay')).toBeTruthy()
    wrapper.unmount()
  })

  it('does not render when not visible', () => {
    const wrapper = mountModal({ visible: false })
    expect(document.querySelector('.modal-overlay')).toBeFalsy()
    wrapper.unmount()
  })

  it('emits close on pointerdown overlay', async () => {
    const wrapper = mountModal()
    const overlay = document.querySelector('.modal-overlay') as HTMLElement
    overlay.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(wrapper.emitted('close')).toBeTruthy()
    wrapper.unmount()
  })

  it('does not emit close on content pointerdown', async () => {
    const wrapper = mountModal()
    const content = document.querySelector('.modal-content') as HTMLElement
    content.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(wrapper.emitted('close')).toBeFalsy()
    wrapper.unmount()
  })

  it('does not emit close when preventClose is true', async () => {
    const wrapper = mountModal({ preventClose: true })
    const overlay = document.querySelector('.modal-overlay') as HTMLElement
    overlay.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(wrapper.emitted('close')).toBeFalsy()
    wrapper.unmount()
  })
})
