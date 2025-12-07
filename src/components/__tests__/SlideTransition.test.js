import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import SlideTransition from '../SlideTransition.vue'

describe('SlideTransition', () => {
  let wrapper

  beforeEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Rendering', () => {
    it('should render slot content', () => {
      wrapper = mount(SlideTransition, {
        slots: {
          default: '<div class="test-content">Hello</div>'
        }
      })
      expect(wrapper.find('.test-content').exists()).toBe(true)
      expect(wrapper.text()).toBe('Hello')
    })

    it('should render without slot content', () => {
      wrapper = mount(SlideTransition)
      expect(wrapper.exists()).toBe(true)
    })
  })

  describe('Direction Prop', () => {
    it('should default to horizontal direction', () => {
      wrapper = mount(SlideTransition, {
        slots: {
          default: '<div key="1">Content</div>'
        }
      })
      const transition = wrapper.findComponent({ name: 'Transition' })
      expect(transition.props('name')).toBe('slide-horizontal')
    })

    it('should use horizontal transition when direction is horizontal', () => {
      wrapper = mount(SlideTransition, {
        props: {
          direction: 'horizontal'
        },
        slots: {
          default: '<div key="1">Content</div>'
        }
      })
      const transition = wrapper.findComponent({ name: 'Transition' })
      expect(transition.props('name')).toBe('slide-horizontal')
    })

    it('should use vertical transition when direction is vertical', () => {
      wrapper = mount(SlideTransition, {
        props: {
          direction: 'vertical'
        },
        slots: {
          default: '<div key="1">Content</div>'
        }
      })
      const transition = wrapper.findComponent({ name: 'Transition' })
      expect(transition.props('name')).toBe('slide-vertical')
    })
  })

  describe('Mode Prop', () => {
    it('should default to out-in mode', () => {
      wrapper = mount(SlideTransition, {
        slots: {
          default: '<div key="1">Content</div>'
        }
      })
      const transition = wrapper.findComponent({ name: 'Transition' })
      expect(transition.props('mode')).toBe('out-in')
    })

    it('should use custom mode when provided', () => {
      wrapper = mount(SlideTransition, {
        props: {
          mode: 'in-out'
        },
        slots: {
          default: '<div key="1">Content</div>'
        }
      })
      const transition = wrapper.findComponent({ name: 'Transition' })
      expect(transition.props('mode')).toBe('in-out')
    })

    it('should accept empty string mode', () => {
      wrapper = mount(SlideTransition, {
        props: {
          mode: ''
        },
        slots: {
          default: '<div key="1">Content</div>'
        }
      })
      const transition = wrapper.findComponent({ name: 'Transition' })
      expect(transition.props('mode')).toBe('')
    })
  })

  describe('Combined Props', () => {
    it('should handle vertical direction with in-out mode', () => {
      wrapper = mount(SlideTransition, {
        props: {
          direction: 'vertical',
          mode: 'in-out'
        },
        slots: {
          default: '<div key="1">Content</div>'
        }
      })
      const transition = wrapper.findComponent({ name: 'Transition' })
      expect(transition.props('name')).toBe('slide-vertical')
      expect(transition.props('mode')).toBe('in-out')
    })

    it('should handle horizontal direction with out-in mode', () => {
      wrapper = mount(SlideTransition, {
        props: {
          direction: 'horizontal',
          mode: 'out-in'
        },
        slots: {
          default: '<div key="1">Content</div>'
        }
      })
      const transition = wrapper.findComponent({ name: 'Transition' })
      expect(transition.props('name')).toBe('slide-horizontal')
      expect(transition.props('mode')).toBe('out-in')
    })
  })

  describe('Slot Content Types', () => {
    it('should handle simple text content', () => {
      wrapper = mount(SlideTransition, {
        slots: {
          default: 'Simple text'
        }
      })
      expect(wrapper.text()).toBe('Simple text')
    })

    it('should handle complex nested content', () => {
      wrapper = mount(SlideTransition, {
        slots: {
          default: '<div class="outer"><span class="inner">Nested</span></div>'
        }
      })
      expect(wrapper.find('.outer').exists()).toBe(true)
      expect(wrapper.find('.inner').exists()).toBe(true)
      expect(wrapper.find('.inner').text()).toBe('Nested')
    })

    it('should handle component content', () => {
      const ChildComponent = {
        template: '<div class="child-component">Child</div>'
      }
      wrapper = mount(SlideTransition, {
        slots: {
          default: ChildComponent
        }
      })
      expect(wrapper.find('.child-component').exists()).toBe(true)
    })
  })

  describe('Transition Wrapper', () => {
    it('should wrap content in Vue Transition component', () => {
      wrapper = mount(SlideTransition, {
        slots: {
          default: '<div>Content</div>'
        }
      })
      const transition = wrapper.findComponent({ name: 'Transition' })
      expect(transition.exists()).toBe(true)
    })

    it('should pass through transition props correctly', () => {
      wrapper = mount(SlideTransition, {
        props: {
          direction: 'vertical',
          mode: 'out-in'
        },
        slots: {
          default: '<div key="test">Content</div>'
        }
      })
      const transition = wrapper.findComponent({ name: 'Transition' })
      expect(transition.props()).toMatchObject({
        name: 'slide-vertical',
        mode: 'out-in'
      })
    })
  })
})
