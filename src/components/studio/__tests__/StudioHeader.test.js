import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import StudioHeader from '../StudioHeader.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [{ path: '/', component: { template: '<div>Home</div>' } }]
})

describe('StudioHeader', () => {
  let wrapper

  beforeEach(async () => {
    router.push('/')
    await router.isReady()
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Rendering', () => {
    it('should render the header element', () => {
      wrapper = mount(StudioHeader, {
        global: { plugins: [router] }
      })
      expect(wrapper.find('.studio-header').exists()).toBe(true)
    })

    it('should render the title', () => {
      wrapper = mount(StudioHeader, {
        global: { plugins: [router] }
      })
      expect(wrapper.find('h1').text()).toBe('AI Studio')
    })

    it('should render back link to home', () => {
      wrapper = mount(StudioHeader, {
        global: { plugins: [router] }
      })
      const backLink = wrapper.find('.back-link')
      expect(backLink.exists()).toBe(true)
      expect(backLink.text()).toContain('Home')
    })

    it('should have correct back link href', () => {
      wrapper = mount(StudioHeader, {
        global: { plugins: [router] }
      })
      const backLink = wrapper.find('.back-link')
      expect(backLink.attributes('href')).toBe('/')
    })
  })
})
