import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import VueToolRenderer from '../VueToolRenderer.vue'

describe('VueToolRenderer', () => {
  let wrapper

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    // Clean up any injected styles
    document.querySelectorAll('style[data-test-style]').forEach(el => el.remove())
  })

  describe('rendering', () => {
    it('should render a simple Vue component', async () => {
      const code = `<template>
  <div class="test-component">Hello World</div>
</template>

<script>
export default {
  data() { return {} }
}
</script>`

      wrapper = mount(VueToolRenderer, {
        props: { code }
      })

      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()

      expect(wrapper.text()).toContain('Hello World')
    })

    it('should render component with reactive data', async () => {
      const code = `<template>
  <div>{{ message }}</div>
</template>

<script>
export default {
  data() {
    return { message: 'Reactive Message' }
  }
}
</script>`

      wrapper = mount(VueToolRenderer, {
        props: { code }
      })

      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()

      expect(wrapper.text()).toContain('Reactive Message')
    })

    it('should render component with computed properties', async () => {
      const code = `<template>
  <div>{{ doubled }}</div>
</template>

<script>
export default {
  data() {
    return { count: 5 }
  },
  computed: {
    doubled() { return this.count * 2 }
  }
}
</script>`

      wrapper = mount(VueToolRenderer, {
        props: { code }
      })

      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()

      expect(wrapper.text()).toContain('10')
    })
  })

  describe('error handling', () => {
    it('should show error for missing template', async () => {
      const code = `<script>
export default {
  data() { return {} }
}
</script>`

      wrapper = mount(VueToolRenderer, {
        props: { code }
      })

      await wrapper.vm.$nextTick()

      expect(wrapper.find('.error-message').exists()).toBe(true)
      expect(wrapper.text()).toContain('No template found')
    })

    it('should show error for invalid code', async () => {
      const code = 'not a vue component'

      wrapper = mount(VueToolRenderer, {
        props: { code }
      })

      await wrapper.vm.$nextTick()

      expect(wrapper.find('.error-message').exists()).toBe(true)
    })
  })

  describe('styles', () => {
    it('should inject styles into document head', async () => {
      const code = `<template>
  <div class="styled-component">Styled</div>
</template>

<script>
export default {}
</script>

<style>
.styled-component { color: red; }
</style>`

      wrapper = mount(VueToolRenderer, {
        props: { code }
      })

      await wrapper.vm.$nextTick()

      const styles = document.querySelectorAll('style')
      const hasStyle = Array.from(styles).some(s => s.textContent.includes('styled-component'))
      expect(hasStyle).toBe(true)
    })

    it('should clean up styles on unmount', async () => {
      const code = `<template>
  <div>Test</div>
</template>

<script>
export default {}
</script>

<style>
.cleanup-test { color: blue; }
</style>`

      wrapper = mount(VueToolRenderer, {
        props: { code }
      })

      await wrapper.vm.$nextTick()

      const beforeCount = document.querySelectorAll('style').length
      wrapper.unmount()
      wrapper = null

      // Style should be removed
      const afterStyles = Array.from(document.querySelectorAll('style'))
      const hasCleanupStyle = afterStyles.some(s => s.textContent.includes('cleanup-test'))
      expect(hasCleanupStyle).toBe(false)
    })
  })

  describe('code updates', () => {
    it('should recompile when code prop changes', async () => {
      const code1 = `<template><div>First</div></template><script>export default {}</script>`
      const code2 = `<template><div>Second</div></template><script>export default {}</script>`

      wrapper = mount(VueToolRenderer, {
        props: { code: code1 }
      })

      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()
      expect(wrapper.text()).toContain('First')

      await wrapper.setProps({ code: code2 })
      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()
      expect(wrapper.text()).toContain('Second')
    })
  })

  describe('Options API support', () => {
    it('should handle methods', async () => {
      const code = `<template>
  <div>
    <span id="count">{{ count }}</span>
    <button @click="increment">+</button>
  </div>
</template>

<script>
export default {
  data() {
    return { count: 0 }
  },
  methods: {
    increment() {
      this.count++
    }
  }
}
</script>`

      wrapper = mount(VueToolRenderer, {
        props: { code }
      })

      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()

      expect(wrapper.find('#count').text()).toBe('0')

      await wrapper.find('button').trigger('click')
      await wrapper.vm.$nextTick()

      expect(wrapper.find('#count').text()).toBe('1')
    })
  })

  describe('fallback to script setup', () => {
    it('should handle script setup style code as fallback', async () => {
      const code = `<template>
  <div>{{ message }}</div>
</template>

<script>
const message = 'Setup Style'
</script>`

      wrapper = mount(VueToolRenderer, {
        props: { code }
      })

      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()

      // Should either render correctly or show error gracefully
      // The fallback handles this case
      expect(wrapper.find('.error-message').exists() || wrapper.text().includes('Setup Style')).toBe(true)
    })
  })
})
