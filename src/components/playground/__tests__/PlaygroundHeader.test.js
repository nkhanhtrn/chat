import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import PlaygroundHeader from '../PlaygroundHeader.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [{ path: '/', component: { template: '<div>Home</div>' } }]
})

describe('PlaygroundHeader', () => {
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
      wrapper = mount(PlaygroundHeader, {
        props: defaultProps,
        global: { plugins: [router] }
      })
      expect(wrapper.find('.playground-header').exists()).toBe(true)
    })

    it('should render the title', () => {
      wrapper = mount(PlaygroundHeader, {
        props: defaultProps,
        global: { plugins: [router] }
      })
      expect(wrapper.find('.title').text()).toBe('Playground')
    })

    it('should render back button', () => {
      wrapper = mount(PlaygroundHeader, {
        props: defaultProps,
        global: { plugins: [router] }
      })
      expect(wrapper.find('.back-btn').exists()).toBe(true)
    })

    it('should render two-model toggle', () => {
      wrapper = mount(PlaygroundHeader, {
        props: defaultProps,
        global: { plugins: [router] }
      })
      expect(wrapper.find('.two-model-toggle').exists()).toBe(true)
      expect(wrapper.find('.toggle-label').text()).toBe('2-Model')
    })

    it('should render clear button', () => {
      wrapper = mount(PlaygroundHeader, {
        props: defaultProps,
        global: { plugins: [router] }
      })
      expect(wrapper.find('.clear-btn').exists()).toBe(true)
    })
  })

  describe('Single Model Mode', () => {
    it('should show single-select containers in single model mode', () => {
      wrapper = mount(PlaygroundHeader, {
        props: { ...defaultProps, twoModelMode: false },
        global: { plugins: [router] }
      })
      const singleSelects = wrapper.findAll('.single-select')
      expect(singleSelects).toHaveLength(2)
    })

    it('should show Provider and Model labels', () => {
      wrapper = mount(PlaygroundHeader, {
        props: { ...defaultProps, twoModelMode: false },
        global: { plugins: [router] }
      })
      const labels = wrapper.findAll('.single-select .select-label')
      expect(labels[0].text()).toBe('Provider')
      expect(labels[1].text()).toBe('Model')
    })

    it('should render all providers as options', () => {
      wrapper = mount(PlaygroundHeader, {
        props: { ...defaultProps, twoModelMode: false },
        global: { plugins: [router] }
      })
      const providerSelect = wrapper.find('.select-control.provider')
      const options = providerSelect.findAll('option')
      expect(options).toHaveLength(2)
      expect(options[0].text()).toBe('OpenAI')
      expect(options[1].text()).toBe('Anthropic')
    })

    it('should render all models as options', () => {
      wrapper = mount(PlaygroundHeader, {
        props: { ...defaultProps, twoModelMode: false },
        global: { plugins: [router] }
      })
      const modelSelect = wrapper.find('.select-control.model')
      const options = modelSelect.findAll('option')
      expect(options).toHaveLength(2)
      expect(options[0].text()).toBe('GPT-4')
      expect(options[1].text()).toBe('GPT-3.5')
    })

    it('should show loading message when no models', () => {
      wrapper = mount(PlaygroundHeader, {
        props: { ...defaultProps, twoModelMode: false, models: [] },
        global: { plugins: [router] }
      })
      const modelSelect = wrapper.find('.select-control.model')
      expect(modelSelect.find('option').text()).toBe('Loading...')
    })

    it('should disable model select when no models', () => {
      wrapper = mount(PlaygroundHeader, {
        props: { ...defaultProps, twoModelMode: false, models: [] },
        global: { plugins: [router] }
      })
      expect(wrapper.find('.select-control.model').attributes('disabled')).toBeDefined()
    })

    it('should not show dual-select in single model mode', () => {
      wrapper = mount(PlaygroundHeader, {
        props: { ...defaultProps, twoModelMode: false },
        global: { plugins: [router] }
      })
      expect(wrapper.find('.dual-select').exists()).toBe(false)
    })
  })

  describe('Two Model Mode', () => {
    it('should show dual-select containers in two-model mode', () => {
      wrapper = mount(PlaygroundHeader, {
        props: { ...defaultProps, twoModelMode: true },
        global: { plugins: [router] }
      })
      const dualSelects = wrapper.findAll('.dual-select')
      expect(dualSelects).toHaveLength(2)
    })

    it('should show Router label', () => {
      wrapper = mount(PlaygroundHeader, {
        props: { ...defaultProps, twoModelMode: true },
        global: { plugins: [router] }
      })
      const labels = wrapper.findAll('.select-label')
      expect(labels[0].text()).toBe('Router')
    })

    it('should show Executor label', () => {
      wrapper = mount(PlaygroundHeader, {
        props: { ...defaultProps, twoModelMode: true },
        global: { plugins: [router] }
      })
      const labels = wrapper.findAll('.select-label')
      expect(labels[1].text()).toBe('Executor')
    })

    it('should render allModels in router select', () => {
      wrapper = mount(PlaygroundHeader, {
        props: { ...defaultProps, twoModelMode: true },
        global: { plugins: [router] }
      })
      const selects = wrapper.findAll('.dual-select .select-control.model')
      const options = selects[0].findAll('option')
      expect(options).toHaveLength(2)
      expect(options[0].text()).toBe('GPT-4')
      expect(options[1].text()).toBe('Claude 3')
    })

    it('should show loading when allModels is empty', () => {
      wrapper = mount(PlaygroundHeader, {
        props: { ...defaultProps, twoModelMode: true, allModels: [] },
        global: { plugins: [router] }
      })
      const select = wrapper.find('.dual-select .select-control.model')
      expect(select.find('option').text()).toBe('Loading...')
    })
  })

  describe('Events', () => {
    it('should emit update:twoModelMode when checkbox changes', async () => {
      wrapper = mount(PlaygroundHeader, {
        props: defaultProps,
        global: { plugins: [router] }
      })
      const checkbox = wrapper.find('.two-model-toggle input')
      await checkbox.setValue(true)
      expect(wrapper.emitted('update:twoModelMode')).toBeTruthy()
      expect(wrapper.emitted('update:twoModelMode')[0]).toEqual([true])
    })

    it('should emit update:selectedProvider when provider changes', async () => {
      wrapper = mount(PlaygroundHeader, {
        props: { ...defaultProps, twoModelMode: false },
        global: { plugins: [router] }
      })
      const providerSelect = wrapper.find('.select-control.provider')
      await providerSelect.setValue('anthropic')
      expect(wrapper.emitted('update:selectedProvider')).toBeTruthy()
      expect(wrapper.emitted('update:selectedProvider')[0]).toEqual(['anthropic'])
    })

    it('should emit update:selectedModel when model changes', async () => {
      wrapper = mount(PlaygroundHeader, {
        props: { ...defaultProps, twoModelMode: false },
        global: { plugins: [router] }
      })
      const modelSelect = wrapper.find('.single-select .select-control.model')
      await modelSelect.setValue('gpt-3.5')
      expect(wrapper.emitted('update:selectedModel')).toBeTruthy()
      expect(wrapper.emitted('update:selectedModel')[0]).toEqual(['gpt-3.5'])
    })

    it('should emit update:routerModel when router model changes', async () => {
      wrapper = mount(PlaygroundHeader, {
        props: { ...defaultProps, twoModelMode: true },
        global: { plugins: [router] }
      })
      const selects = wrapper.findAll('.dual-select .select-control.model')
      await selects[0].setValue('claude-3')
      expect(wrapper.emitted('update:routerModel')).toBeTruthy()
      expect(wrapper.emitted('update:routerModel')[0]).toEqual(['claude-3'])
    })

    it('should emit update:executorModel when executor model changes', async () => {
      wrapper = mount(PlaygroundHeader, {
        props: { ...defaultProps, twoModelMode: true },
        global: { plugins: [router] }
      })
      const selects = wrapper.findAll('.dual-select .select-control.model')
      await selects[1].setValue('gpt-4')
      expect(wrapper.emitted('update:executorModel')).toBeTruthy()
      expect(wrapper.emitted('update:executorModel')[0]).toEqual(['gpt-4'])
    })

    it('should emit clear when clear button clicked', async () => {
      wrapper = mount(PlaygroundHeader, {
        props: defaultProps,
        global: { plugins: [router] }
      })
      await wrapper.find('.clear-btn').trigger('click')
      expect(wrapper.emitted('clear')).toBeTruthy()
    })
  })

  describe('Checkbox State', () => {
    it('should reflect twoModelMode prop as checked', () => {
      wrapper = mount(PlaygroundHeader, {
        props: { ...defaultProps, twoModelMode: true },
        global: { plugins: [router] }
      })
      const checkbox = wrapper.find('.two-model-toggle input')
      expect(checkbox.element.checked).toBe(true)
    })

    it('should reflect twoModelMode prop as unchecked', () => {
      wrapper = mount(PlaygroundHeader, {
        props: { ...defaultProps, twoModelMode: false },
        global: { plugins: [router] }
      })
      const checkbox = wrapper.find('.two-model-toggle input')
      expect(checkbox.element.checked).toBe(false)
    })
  })
})
