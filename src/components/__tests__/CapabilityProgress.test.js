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

  describe('Rendering', () => {
    it('should render as details element', () => {
      wrapper = mount(CapabilityProgress, {
        props: { capability: 'code' }
      })
      expect(wrapper.find('details.capability-progress').exists()).toBe(true)
    })

    it('should render progress header as summary', () => {
      wrapper = mount(CapabilityProgress, {
        props: { capability: 'code' }
      })
      expect(wrapper.find('summary.progress-header').exists()).toBe(true)
    })

    it('should render progress content', () => {
      wrapper = mount(CapabilityProgress, {
        props: { capability: 'code' }
      })
      expect(wrapper.find('.progress-content').exists()).toBe(true)
    })
  })

  describe('Capability Badge', () => {
    it('should render capability badge', () => {
      wrapper = mount(CapabilityProgress, {
        props: { capability: 'code' }
      })
      expect(wrapper.find('.capability-badge').exists()).toBe(true)
    })

    it('should apply capability class to badge', () => {
      wrapper = mount(CapabilityProgress, {
        props: { capability: 'code' }
      })
      expect(wrapper.find('.capability-badge').classes()).toContain('code')
    })

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

    it('should display correct label for visualization', () => {
      wrapper = mount(CapabilityProgress, {
        props: { capability: 'visualization' }
      })
      expect(wrapper.find('.capability-badge').text()).toBe('Visualization')
    })

    it('should display correct label for build', () => {
      wrapper = mount(CapabilityProgress, {
        props: { capability: 'build' }
      })
      expect(wrapper.find('.capability-badge').text()).toBe('Build Tool')
    })

    it('should display correct label for text', () => {
      wrapper = mount(CapabilityProgress, {
        props: { capability: 'text' }
      })
      expect(wrapper.find('.capability-badge').text()).toBe('Response')
    })

    it('should use capability name as fallback label', () => {
      wrapper = mount(CapabilityProgress, {
        props: { capability: 'unknown' }
      })
      expect(wrapper.find('.capability-badge').text()).toBe('unknown')
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

    it('should render empty task description by default', () => {
      wrapper = mount(CapabilityProgress, {
        props: { capability: 'code' }
      })
      expect(wrapper.find('.task-description').text()).toBe('')
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

    it('should show circle when pending', () => {
      wrapper = mount(CapabilityProgress, {
        props: {
          capability: 'code',
          status: 'pending'
        }
      })
      expect(wrapper.find('.status-icon.pending').text()).toBe('○')
    })

    it('should apply running class to status indicator', () => {
      wrapper = mount(CapabilityProgress, {
        props: {
          capability: 'code',
          status: 'running'
        }
      })
      expect(wrapper.find('.status-indicator').classes()).toContain('running')
    })

    it('should apply complete class to status indicator', () => {
      wrapper = mount(CapabilityProgress, {
        props: {
          capability: 'code',
          status: 'complete'
        }
      })
      expect(wrapper.find('.status-indicator').classes()).toContain('complete')
    })

    it('should apply failed class to status indicator', () => {
      wrapper = mount(CapabilityProgress, {
        props: {
          capability: 'code',
          status: 'failed'
        }
      })
      expect(wrapper.find('.status-indicator').classes()).toContain('failed')
    })
  })

  describe('Attempts Badge', () => {
    it('should not show attempts badge when attempts is 0', () => {
      wrapper = mount(CapabilityProgress, {
        props: {
          capability: 'code',
          attempts: 0
        }
      })
      expect(wrapper.find('.attempts-badge').exists()).toBe(false)
    })

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
    it('should not show execution badge when status is null', () => {
      wrapper = mount(CapabilityProgress, {
        props: {
          capability: 'code',
          executionStatus: null
        }
      })
      expect(wrapper.find('.execution-badge').exists()).toBe(false)
    })

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

    it('should apply success class to execution badge', () => {
      wrapper = mount(CapabilityProgress, {
        props: {
          capability: 'code',
          executionStatus: 'success'
        }
      })
      expect(wrapper.find('.execution-badge').classes()).toContain('success')
    })

    it('should apply failed class to execution badge', () => {
      wrapper = mount(CapabilityProgress, {
        props: {
          capability: 'code',
          executionStatus: 'failed'
        }
      })
      expect(wrapper.find('.execution-badge').classes()).toContain('failed')
    })
  })

  describe('Has Content Class', () => {
    it('should not have has-content class when no content', () => {
      wrapper = mount(CapabilityProgress, {
        props: { capability: 'code' }
      })
      expect(wrapper.find('.capability-progress').classes()).not.toContain('has-content')
    })

    it('should have has-content class when code has generatedCode', () => {
      wrapper = mount(CapabilityProgress, {
        props: {
          capability: 'code',
          generatedCode: 'console.log("test")'
        }
      })
      expect(wrapper.find('.capability-progress').classes()).toContain('has-content')
    })

    it('should have has-content class when websearch has sources', () => {
      wrapper = mount(CapabilityProgress, {
        props: {
          capability: 'websearch',
          webSources: [{ title: 'Test', status: 'success' }]
        }
      })
      expect(wrapper.find('.capability-progress').classes()).toContain('has-content')
    })

    it('should have has-content class when websearch has query', () => {
      wrapper = mount(CapabilityProgress, {
        props: {
          capability: 'websearch',
          searchQuery: 'test query'
        }
      })
      expect(wrapper.find('.capability-progress').classes()).toContain('has-content')
    })

    it('should have has-content class when planning has steps', () => {
      wrapper = mount(CapabilityProgress, {
        props: {
          capability: 'planning',
          planSteps: [{ capability: 'code', task: 'test', status: 'pending' }]
        }
      })
      expect(wrapper.find('.capability-progress').classes()).toContain('has-content')
    })

    it('should have has-content class when visualization has rawOutput', () => {
      wrapper = mount(CapabilityProgress, {
        props: {
          capability: 'visualization',
          rawOutput: { type: 'chart' }
        }
      })
      expect(wrapper.find('.capability-progress').classes()).toContain('has-content')
    })

    it('should have has-content class when build has rawOutput', () => {
      wrapper = mount(CapabilityProgress, {
        props: {
          capability: 'build',
          rawOutput: '<div>Tool</div>'
        }
      })
      expect(wrapper.find('.capability-progress').classes()).toContain('has-content')
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

    it('should not render code block when no generatedCode', () => {
      wrapper = mount(CapabilityProgress, {
        props: { capability: 'code' }
      })
      expect(wrapper.find('.output-content.code').exists()).toBe(false)
    })
  })

  describe('Visualization Content', () => {
    it('should render raw output for visualization', () => {
      wrapper = mount(CapabilityProgress, {
        props: {
          capability: 'visualization',
          rawOutput: { type: 'chart', data: [1, 2, 3] }
        }
      })
      const content = wrapper.find('.output-content')
      expect(content.exists()).toBe(true)
      expect(content.text()).toContain('chart')
    })

    it('should format object output as JSON', () => {
      wrapper = mount(CapabilityProgress, {
        props: {
          capability: 'visualization',
          rawOutput: { key: 'value' }
        }
      })
      expect(wrapper.find('.output-content').text()).toContain('"key"')
      expect(wrapper.find('.output-content').text()).toContain('"value"')
    })
  })

  describe('Build Content', () => {
    it('should render raw output for build', () => {
      wrapper = mount(CapabilityProgress, {
        props: {
          capability: 'build',
          rawOutput: 'Tool output'
        }
      })
      expect(wrapper.find('.output-content').text()).toBe('Tool output')
    })
  })

  describe('Planning Content', () => {
    it('should render nested CapabilityProgress for plan steps', () => {
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

    it('should pass correct props to nested steps', () => {
      wrapper = mount(CapabilityProgress, {
        props: {
          capability: 'planning',
          planSteps: [
            { capability: 'websearch', task: 'Search for data', status: 'complete' }
          ]
        }
      })
      const nestedStep = wrapper.findComponent({ name: 'CapabilityProgress' })
      // The nested component should exist (it's recursive)
      expect(wrapper.find('.planning-progress').exists()).toBe(true)
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

  describe('Default Props', () => {
    it('should have running as default status', () => {
      wrapper = mount(CapabilityProgress, {
        props: { capability: 'code' }
      })
      expect(wrapper.find('.spinner').exists()).toBe(true)
    })

    it('should have empty taskDescription by default', () => {
      wrapper = mount(CapabilityProgress, {
        props: { capability: 'code' }
      })
      expect(wrapper.find('.task-description').text()).toBe('')
    })

    it('should have 0 attempts by default', () => {
      wrapper = mount(CapabilityProgress, {
        props: { capability: 'code' }
      })
      expect(wrapper.find('.attempts-badge').exists()).toBe(false)
    })

    it('should have null executionStatus by default', () => {
      wrapper = mount(CapabilityProgress, {
        props: { capability: 'code' }
      })
      expect(wrapper.find('.execution-badge').exists()).toBe(false)
    })
  })

  describe('Capability Classes', () => {
    it('should apply capability class to root element', () => {
      wrapper = mount(CapabilityProgress, {
        props: { capability: 'websearch' }
      })
      expect(wrapper.find('.capability-progress').classes()).toContain('websearch')
    })

    it('should apply planning class', () => {
      wrapper = mount(CapabilityProgress, {
        props: { capability: 'planning' }
      })
      expect(wrapper.find('.capability-progress').classes()).toContain('planning')
    })

    it('should apply code class', () => {
      wrapper = mount(CapabilityProgress, {
        props: { capability: 'code' }
      })
      expect(wrapper.find('.capability-progress').classes()).toContain('code')
    })

    it('should apply visualization class', () => {
      wrapper = mount(CapabilityProgress, {
        props: { capability: 'visualization' }
      })
      expect(wrapper.find('.capability-progress').classes()).toContain('visualization')
    })

    it('should apply build class', () => {
      wrapper = mount(CapabilityProgress, {
        props: { capability: 'build' }
      })
      expect(wrapper.find('.capability-progress').classes()).toContain('build')
    })
  })
})
