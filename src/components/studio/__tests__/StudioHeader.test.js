import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import StudioHeader from '../StudioHeader.vue'

describe('StudioHeader', () => {
  let wrapper

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Rendering', () => {
    it('should render the header element', () => {
      wrapper = mount(StudioHeader)
      expect(wrapper.find('.studio-header').exists()).toBe(true)
    })

    it('should render the title', () => {
      wrapper = mount(StudioHeader)
      expect(wrapper.find('h1').text()).toBe('AI Studio')
    })
  })
})
