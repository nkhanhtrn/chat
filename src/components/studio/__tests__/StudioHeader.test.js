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

  const defaultProps = {
    twoModelMode: false,
    providers: [
      { id: 'openai', name: 'OpenAI' },
      { id: 'anthropic', name: 'Anthropic' }
    ],
    selectedProvider: 'openai',
    models: [
      { id: 'gpt-4', name: 'GPT-4' },
      { id: 'gpt-3.5', name: 'GPT-3.5' }
    ],
    allModels: [
      { id: 'gpt-4', name: 'GPT-4' },
      { id: 'claude-3', name: 'Claude 3' }
    ],
    selectedModel: 'gpt-4',
    routerModel: 'gpt-4',
    executorModel: 'claude-3'
  }

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
        props: defaultProps,
        global: { plugins: [router] }
      })
      expect(wrapper.find('.studio-header').exists()).toBe(true)
    })

    it('should render the title', () => {
      wrapper = mount(StudioHeader, {
        props: defaultProps,
        global: { plugins: [router] }
      })
      expect(wrapper.find('h1').text()).toBe('AI Studio')
    })

    it('should render back link to home', () => {
      wrapper = mount(StudioHeader, {
        props: defaultProps,
        global: { plugins: [router] }
      })
      const backLink = wrapper.find('.back-link')
      expect(backLink.exists()).toBe(true)
      expect(backLink.text()).toContain('Home')
    })

    it('should render two-model toggle', () => {
      wrapper = mount(StudioHeader, {
        props: defaultProps,
        global: { plugins: [router] }
      })
      expect(wrapper.find('.two-model-toggle').exists()).toBe(true)
      expect(wrapper.find('.toggle-label').text()).toBe('2-Model')
    })
  })

  describe('Single Model Mode', () => {
    it('should show provider select in single model mode', () => {
      wrapper = mount(StudioHeader, {
        props: { ...defaultProps, twoModelMode: false },
        global: { plugins: [router] }
      })
      expect(wrapper.find('.provider-select').exists()).toBe(true)
    })

    it('should show model select in single model mode', () => {
      wrapper = mount(StudioHeader, {
        props: { ...defaultProps, twoModelMode: false },
        global: { plugins: [router] }
      })
      expect(wrapper.find('.model-select').exists()).toBe(true)
    })

    it('should render all providers as options', () => {
      wrapper = mount(StudioHeader, {
        props: { ...defaultProps, twoModelMode: false },
        global: { plugins: [router] }
      })
      const options = wrapper.find('.provider-select').findAll('option')
      expect(options).toHaveLength(2)
      expect(options[0].text()).toBe('OpenAI')
      expect(options[1].text()).toBe('Anthropic')
    })

    it('should render all models as options', () => {
      wrapper = mount(StudioHeader, {
        props: { ...defaultProps, twoModelMode: false },
        global: { plugins: [router] }
      })
      const options = wrapper.find('.model-select').findAll('option')
      expect(options).toHaveLength(2)
      expect(options[0].text()).toBe('GPT-4')
      expect(options[1].text()).toBe('GPT-3.5')
    })

    it('should show loading message when no models', () => {
      wrapper = mount(StudioHeader, {
        props: { ...defaultProps, twoModelMode: false, models: [] },
        global: { plugins: [router] }
      })
      const modelSelect = wrapper.find('.model-select')
      expect(modelSelect.find('option').text()).toBe('Loading models...')
    })

    it('should disable model select when no models', () => {
      wrapper = mount(StudioHeader, {
        props: { ...defaultProps, twoModelMode: false, models: [] },
        global: { plugins: [router] }
      })
      expect(wrapper.find('.model-select').attributes('disabled')).toBeDefined()
    })

    it('should not show model pair in single model mode', () => {
      wrapper = mount(StudioHeader, {
        props: { ...defaultProps, twoModelMode: false },
        global: { plugins: [router] }
      })
      expect(wrapper.find('.model-pair').exists()).toBe(false)
    })
  })

  describe('Two Model Mode', () => {
    it('should show model pair in two-model mode', () => {
      wrapper = mount(StudioHeader, {
        props: { ...defaultProps, twoModelMode: true },
        global: { plugins: [router] }
      })
      expect(wrapper.find('.model-pair').exists()).toBe(true)
    })

    it('should show router and executor selectors', () => {
      wrapper = mount(StudioHeader, {
        props: { ...defaultProps, twoModelMode: true },
        global: { plugins: [router] }
      })
      const selectors = wrapper.findAll('.model-selector')
      expect(selectors).toHaveLength(2)
    })

    it('should show Router label', () => {
      wrapper = mount(StudioHeader, {
        props: { ...defaultProps, twoModelMode: true },
        global: { plugins: [router] }
      })
      const labels = wrapper.findAll('.model-label')
      expect(labels[0].text()).toBe('Router')
    })

    it('should show Executor label', () => {
      wrapper = mount(StudioHeader, {
        props: { ...defaultProps, twoModelMode: true },
        global: { plugins: [router] }
      })
      const labels = wrapper.findAll('.model-label')
      expect(labels[1].text()).toBe('Executor')
    })

    it('should render allModels in router select', () => {
      wrapper = mount(StudioHeader, {
        props: { ...defaultProps, twoModelMode: true },
        global: { plugins: [router] }
      })
      const selects = wrapper.findAll('.model-select.small')
      const options = selects[0].findAll('option')
      expect(options).toHaveLength(2)
      expect(options[0].text()).toBe('GPT-4')
      expect(options[1].text()).toBe('Claude 3')
    })

    it('should not show provider select in two-model mode', () => {
      wrapper = mount(StudioHeader, {
        props: { ...defaultProps, twoModelMode: true },
        global: { plugins: [router] }
      })
      expect(wrapper.find('.provider-select').exists()).toBe(false)
    })

    it('should show loading when allModels is empty', () => {
      wrapper = mount(StudioHeader, {
        props: { ...defaultProps, twoModelMode: true, allModels: [] },
        global: { plugins: [router] }
      })
      const select = wrapper.find('.model-select.small')
      expect(select.find('option').text()).toBe('Loading...')
    })
  })

  describe('Events', () => {
    it('should emit update:twoModelMode when toggle changes', async () => {
      wrapper = mount(StudioHeader, {
        props: defaultProps,
        global: { plugins: [router] }
      })
      const checkbox = wrapper.find('.two-model-toggle input')
      await checkbox.setValue(true)
      expect(wrapper.emitted('update:twoModelMode')).toBeTruthy()
      expect(wrapper.emitted('update:twoModelMode')[0]).toEqual([true])
    })

    it('should emit update:selectedProvider when provider changes', async () => {
      wrapper = mount(StudioHeader, {
        props: { ...defaultProps, twoModelMode: false },
        global: { plugins: [router] }
      })
      const select = wrapper.find('.provider-select')
      await select.setValue('anthropic')
      expect(wrapper.emitted('update:selectedProvider')).toBeTruthy()
      expect(wrapper.emitted('update:selectedProvider')[0]).toEqual(['anthropic'])
    })

    it('should emit update:selectedModel when model changes', async () => {
      wrapper = mount(StudioHeader, {
        props: { ...defaultProps, twoModelMode: false },
        global: { plugins: [router] }
      })
      const select = wrapper.find('.model-select')
      await select.setValue('gpt-3.5')
      expect(wrapper.emitted('update:selectedModel')).toBeTruthy()
      expect(wrapper.emitted('update:selectedModel')[0]).toEqual(['gpt-3.5'])
    })

    it('should emit update:routerModel when router model changes', async () => {
      wrapper = mount(StudioHeader, {
        props: { ...defaultProps, twoModelMode: true },
        global: { plugins: [router] }
      })
      const selects = wrapper.findAll('.model-select.small')
      await selects[0].setValue('claude-3')
      expect(wrapper.emitted('update:routerModel')).toBeTruthy()
      expect(wrapper.emitted('update:routerModel')[0]).toEqual(['claude-3'])
    })

    it('should emit update:executorModel when executor model changes', async () => {
      wrapper = mount(StudioHeader, {
        props: { ...defaultProps, twoModelMode: true },
        global: { plugins: [router] }
      })
      const selects = wrapper.findAll('.model-select.small')
      await selects[1].setValue('gpt-4')
      expect(wrapper.emitted('update:executorModel')).toBeTruthy()
      expect(wrapper.emitted('update:executorModel')[0]).toEqual(['gpt-4'])
    })
  })

  describe('Checkbox State', () => {
    it('should reflect twoModelMode prop as checked', () => {
      wrapper = mount(StudioHeader, {
        props: { ...defaultProps, twoModelMode: true },
        global: { plugins: [router] }
      })
      const checkbox = wrapper.find('.two-model-toggle input')
      expect(checkbox.element.checked).toBe(true)
    })

    it('should reflect twoModelMode prop as unchecked', () => {
      wrapper = mount(StudioHeader, {
        props: { ...defaultProps, twoModelMode: false },
        global: { plugins: [router] }
      })
      const checkbox = wrapper.find('.two-model-toggle input')
      expect(checkbox.element.checked).toBe(false)
    })
  })

  describe('Selected Values', () => {
    it('should show selected provider value', () => {
      wrapper = mount(StudioHeader, {
        props: { ...defaultProps, twoModelMode: false, selectedProvider: 'anthropic' },
        global: { plugins: [router] }
      })
      expect(wrapper.find('.provider-select').element.value).toBe('anthropic')
    })

    it('should show selected model value', () => {
      wrapper = mount(StudioHeader, {
        props: { ...defaultProps, twoModelMode: false, selectedModel: 'gpt-3.5' },
        global: { plugins: [router] }
      })
      expect(wrapper.find('.model-select').element.value).toBe('gpt-3.5')
    })
  })
})
