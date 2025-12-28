import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import CapabilityProgress from '../CapabilityProgress.vue'

describe('CapabilityProgress', () => {
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

  describe('Capability Badge Labels', () => {
    it('should display correct label for planning', () => {
      wrapper = mount(CapabilityProgress, {
        props: { capability: 'planning' }
      })
      expect(wrapper.find('.capability-badge').text()).toBe('Multi-Step')
    })

    it('should display correct label for websearch', () => {
      wrapper = mount(CapabilityProgress, {
        props: { capability: 'websearch' }
      })
      expect(wrapper.find('.capability-badge').text()).toBe('Web Search')
    })

    it('should display correct label for code', () => {
      wrapper = mount(CapabilityProgress, {
        props: { capability: 'code' }
      })
      expect(wrapper.find('.capability-badge').text()).toBe('Code')
    })

    it('should display correct label for build', () => {
      wrapper = mount(CapabilityProgress, {
        props: { capability: 'build' }
      })
      expect(wrapper.find('.capability-badge').text()).toBe('Build Tool')
    })
  })

  describe('Task Description', () => {
    it('should render task description', () => {
      wrapper = mount(CapabilityProgress, {
        props: {
          capability: 'code',
          taskDescription: 'Calculate fibonacci'
        }
      })
      expect(wrapper.find('.task-description').text()).toBe('Calculate fibonacci')
    })
  })

  describe('Status Indicator', () => {
    it('should show spinner when running', () => {
      wrapper = mount(CapabilityProgress, {
        props: {
          capability: 'code',
          status: 'running'
        }
      })
      expect(wrapper.find('.spinner').exists()).toBe(true)
    })

    it('should show checkmark when complete', () => {
      wrapper = mount(CapabilityProgress, {
        props: {
          capability: 'code',
          status: 'complete'
        }
      })
      expect(wrapper.find('.status-icon.complete').text()).toBe('✓')
    })

    it('should show X when failed', () => {
      wrapper = mount(CapabilityProgress, {
        props: {
          capability: 'code',
          status: 'failed'
        }
      })
      expect(wrapper.find('.status-icon.failed').text()).toBe('✗')
    })
  })

  describe('Attempts Badge', () => {
    it('should not show attempts badge when attempts is 1', () => {
      wrapper = mount(CapabilityProgress, {
        props: {
          capability: 'code',
          attempts: 1
        }
      })
      expect(wrapper.find('.attempts-badge').exists()).toBe(false)
    })

    it('should show attempts badge when attempts > 1', () => {
      wrapper = mount(CapabilityProgress, {
        props: {
          capability: 'code',
          attempts: 3
        }
      })
      expect(wrapper.find('.attempts-badge').exists()).toBe(true)
      expect(wrapper.find('.attempts-badge').text()).toBe('3 attempts')
    })
  })

  describe('Execution Badge', () => {
    it('should show "Executed" when execution succeeded', () => {
      wrapper = mount(CapabilityProgress, {
        props: {
          capability: 'code',
          executionStatus: 'success'
        }
      })
      expect(wrapper.find('.execution-badge').text()).toBe('Executed')
    })

    it('should show "Failed" when execution failed', () => {
      wrapper = mount(CapabilityProgress, {
        props: {
          capability: 'code',
          executionStatus: 'failed'
        }
      })
      expect(wrapper.find('.execution-badge').text()).toBe('Failed')
    })
  })

  describe('Code Content', () => {
    it('should render generated code when provided', () => {
      wrapper = mount(CapabilityProgress, {
        props: {
          capability: 'code',
          generatedCode: 'const x = 1;'
        }
      })
      expect(wrapper.find('.output-content.code').text()).toBe('const x = 1;')
    })
  })

  describe('Planning Content', () => {
    it('should render nested steps for plan', () => {
      wrapper = mount(CapabilityProgress, {
        props: {
          capability: 'planning',
          planSteps: [
            { capability: 'websearch', task: 'Search for data', status: 'complete' },
            { capability: 'code', task: 'Process data', status: 'running' }
          ]
        }
      })
      const nestedSteps = wrapper.findAll('.nested-step')
      expect(nestedSteps.length).toBe(2)
    })
  })

  describe('WebSearch Content', () => {
    it('should render WebSearchProgress component', () => {
      wrapper = mount(CapabilityProgress, {
        props: {
          capability: 'websearch',
          searchQuery: 'test query',
          webSources: [{ title: 'Source', url: 'https://example.com', status: 'success' }]
        }
      })
      expect(wrapper.findComponent({ name: 'WebSearchProgress' }).exists()).toBe(true)
    })
  })
})
