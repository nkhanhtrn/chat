import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import ToolRenderer from '../ToolRenderer.vue'

// Mock CodeBlock component
vi.mock('../markdown/CodeBlock.vue', () => ({
  default: {
    name: 'CodeBlock',
    props: ['language', 'code'],
    template: '<div class="code-block-mock">{{ code }}</div>'
  }
}))

describe('ToolRenderer', () => {
  let wrapper

  const createCalculatorTool = () => ({
    name: 'Calculator',
    description: 'A simple calculator',
    layout: 'calculator',
    state: {
      display: '0',
      operator: null
    },
    display: {
      type: 'single'
    },
    elements: [
      {
        type: 'button-grid',
        columns: 4,
        buttons: [
          { label: 'C', action: 'clear', class: 'danger' },
          { label: '7', action: 'digit', value: '7' },
          { label: '8', action: 'digit', value: '8' },
          { label: '+', action: 'add', class: 'operator' }
        ]
      }
    ],
    actions: {
      clear: "state.display = '0';",
      digit: "state.display = state.display === '0' ? value : state.display + value;",
      add: "state.operator = '+';"
    },
    displayFormatter: "return state.display;"
  })

  const createConverterTool = () => ({
    name: 'Length Converter',
    description: 'Convert between units',
    layout: 'converter',
    state: {
      value: '',
      fromUnit: 'meters',
      toUnit: 'feet'
    },
    display: {
      type: 'multi'
    },
    elements: [
      {
        type: 'input',
        label: 'Value',
        stateKey: 'value',
        inputType: 'number',
        placeholder: 'Enter value'
      },
      {
        type: 'select',
        label: 'From',
        stateKey: 'fromUnit',
        options: [
          { value: 'meters', label: 'Meters' },
          { value: 'feet', label: 'Feet' }
        ]
      }
    ],
    actions: {},
    displayFormatter: "return { main: state.value + ' ' + state.toUnit, secondary: 'Converting...' };"
  })

  const createTextProcessorTool = () => ({
    name: 'Word Counter',
    description: 'Count words in text',
    layout: 'text-processor',
    state: {
      text: ''
    },
    display: {
      type: 'stats'
    },
    elements: [
      {
        type: 'textarea',
        label: 'Enter text',
        stateKey: 'text',
        placeholder: 'Type here...',
        rows: 4
      },
      {
        type: 'button-row',
        buttons: [
          { label: 'Clear', action: 'clear', class: 'danger' }
        ]
      }
    ],
    actions: {
      clear: "state.text = '';"
    },
    displayFormatter: "const words = state.text.trim() ? state.text.trim().split(/\\s+/).length : 0; return { stats: [{ label: 'Words', value: words }] };"
  })

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
    it('should render tool container', () => {
      wrapper = mount(ToolRenderer, {
        props: { tool: createCalculatorTool() }
      })
      expect(wrapper.find('.tool-container').exists()).toBe(true)
    })

    it('should render tool name', () => {
      wrapper = mount(ToolRenderer, {
        props: { tool: createCalculatorTool() }
      })
      expect(wrapper.find('.tool-name').text()).toBe('Calculator')
    })

    it('should render tool description', () => {
      wrapper = mount(ToolRenderer, {
        props: { tool: createCalculatorTool() }
      })
      expect(wrapper.find('.tool-description').text()).toBe('A simple calculator')
    })

    it('should apply layout class', () => {
      wrapper = mount(ToolRenderer, {
        props: { tool: createCalculatorTool() }
      })
      expect(wrapper.find('.tool-container').classes()).toContain('layout-calculator')
    })

    it('should apply text-processor layout class', () => {
      wrapper = mount(ToolRenderer, {
        props: { tool: createTextProcessorTool() }
      })
      expect(wrapper.find('.tool-container').classes()).toContain('layout-text-processor')
    })
  })

  describe('Display Types', () => {
    it('should render single display type', async () => {
      wrapper = mount(ToolRenderer, {
        props: { tool: createCalculatorTool() }
      })
      await nextTick()
      expect(wrapper.find('.display-single').exists()).toBe(true)
      expect(wrapper.find('.display-single').text()).toBe('0')
    })

    it('should render multi display type', async () => {
      wrapper = mount(ToolRenderer, {
        props: { tool: createConverterTool() }
      })
      await nextTick()
      expect(wrapper.find('.display-main').exists()).toBe(true)
      expect(wrapper.find('.display-secondary').exists()).toBe(true)
    })

    it('should render stats display type', async () => {
      wrapper = mount(ToolRenderer, {
        props: { tool: createTextProcessorTool() }
      })
      await nextTick()
      expect(wrapper.find('.display-stats').exists()).toBe(true)
      expect(wrapper.find('.stat-item').exists()).toBe(true)
    })
  })

  describe('Button Grid', () => {
    it('should render button grid', () => {
      wrapper = mount(ToolRenderer, {
        props: { tool: createCalculatorTool() }
      })
      expect(wrapper.find('.button-grid').exists()).toBe(true)
    })

    it('should render all buttons in grid', () => {
      wrapper = mount(ToolRenderer, {
        props: { tool: createCalculatorTool() }
      })
      const buttons = wrapper.findAll('.grid-button')
      expect(buttons).toHaveLength(4)
    })

    it('should render button labels', () => {
      wrapper = mount(ToolRenderer, {
        props: { tool: createCalculatorTool() }
      })
      const buttons = wrapper.findAll('.grid-button')
      expect(buttons[0].text()).toBe('C')
      expect(buttons[1].text()).toBe('7')
      expect(buttons[2].text()).toBe('8')
      expect(buttons[3].text()).toBe('+')
    })

    it('should apply button classes', () => {
      wrapper = mount(ToolRenderer, {
        props: { tool: createCalculatorTool() }
      })
      const buttons = wrapper.findAll('.grid-button')
      expect(buttons[0].classes()).toContain('danger')
      expect(buttons[3].classes()).toContain('operator')
    })

    it('should set grid columns from spec', () => {
      wrapper = mount(ToolRenderer, {
        props: { tool: createCalculatorTool() }
      })
      const grid = wrapper.find('.button-grid')
      expect(grid.attributes('style')).toContain('grid-template-columns')
      expect(grid.attributes('style')).toContain('repeat(4, 1fr)')
    })
  })

  describe('Button Row', () => {
    it('should render button row', () => {
      wrapper = mount(ToolRenderer, {
        props: { tool: createTextProcessorTool() }
      })
      expect(wrapper.find('.button-row').exists()).toBe(true)
    })

    it('should render buttons in row', () => {
      wrapper = mount(ToolRenderer, {
        props: { tool: createTextProcessorTool() }
      })
      const buttons = wrapper.findAll('.row-button')
      expect(buttons).toHaveLength(1)
      expect(buttons[0].text()).toBe('Clear')
    })
  })

  describe('Input Elements', () => {
    it('should render text input', () => {
      wrapper = mount(ToolRenderer, {
        props: { tool: createConverterTool() }
      })
      expect(wrapper.find('.input-field').exists()).toBe(true)
    })

    it('should render input with placeholder', () => {
      wrapper = mount(ToolRenderer, {
        props: { tool: createConverterTool() }
      })
      expect(wrapper.find('.input-field').attributes('placeholder')).toBe('Enter value')
    })

    it('should render input label', () => {
      wrapper = mount(ToolRenderer, {
        props: { tool: createConverterTool() }
      })
      expect(wrapper.find('.input-label').text()).toBe('Value')
    })

    it('should render select element', () => {
      wrapper = mount(ToolRenderer, {
        props: { tool: createConverterTool() }
      })
      expect(wrapper.find('.input-select').exists()).toBe(true)
    })

    it('should render select options', () => {
      wrapper = mount(ToolRenderer, {
        props: { tool: createConverterTool() }
      })
      const options = wrapper.findAll('.input-select option')
      expect(options).toHaveLength(2)
      expect(options[0].text()).toBe('Meters')
      expect(options[1].text()).toBe('Feet')
    })

    it('should render textarea', () => {
      wrapper = mount(ToolRenderer, {
        props: { tool: createTextProcessorTool() }
      })
      expect(wrapper.find('.input-textarea').exists()).toBe(true)
    })

    it('should render textarea with rows', () => {
      wrapper = mount(ToolRenderer, {
        props: { tool: createTextProcessorTool() }
      })
      expect(wrapper.find('.input-textarea').attributes('rows')).toBe('4')
    })
  })

  describe('Actions', () => {
    it('should execute digit action on button click', async () => {
      wrapper = mount(ToolRenderer, {
        props: { tool: createCalculatorTool() }
      })

      const button7 = wrapper.findAll('.grid-button')[1]
      await button7.trigger('click')

      expect(wrapper.find('.display-single').text()).toBe('7')
    })

    it('should execute multiple digit actions', async () => {
      wrapper = mount(ToolRenderer, {
        props: { tool: createCalculatorTool() }
      })

      const buttons = wrapper.findAll('.grid-button')
      await buttons[1].trigger('click') // 7
      await buttons[2].trigger('click') // 8

      expect(wrapper.find('.display-single').text()).toBe('78')
    })

    it('should execute clear action', async () => {
      wrapper = mount(ToolRenderer, {
        props: { tool: createCalculatorTool() }
      })

      // First add some digits
      const buttons = wrapper.findAll('.grid-button')
      await buttons[1].trigger('click') // 7
      await buttons[2].trigger('click') // 8

      // Then clear
      await buttons[0].trigger('click') // C

      expect(wrapper.find('.display-single').text()).toBe('0')
    })

    it('should update state on input change', async () => {
      wrapper = mount(ToolRenderer, {
        props: { tool: createConverterTool() }
      })

      const input = wrapper.find('.input-field')
      await input.setValue('100')

      expect(wrapper.find('.display-main').text()).toContain('100')
    })

    it('should update state on select change', async () => {
      wrapper = mount(ToolRenderer, {
        props: { tool: createConverterTool() }
      })

      const select = wrapper.find('.input-select')
      await select.setValue('feet')

      // State should be updated (check internal state via display)
      expect(wrapper.vm.state.fromUnit).toBe('feet')
    })

    it('should update state on textarea input', async () => {
      wrapper = mount(ToolRenderer, {
        props: { tool: createTextProcessorTool() }
      })

      const textarea = wrapper.find('.input-textarea')
      await textarea.setValue('hello world')

      const statsValue = wrapper.find('.stat-value')
      expect(statsValue.text()).toBe('2') // 2 words
    })
  })

  describe('State Initialization', () => {
    it('should initialize state from tool spec', () => {
      wrapper = mount(ToolRenderer, {
        props: { tool: createCalculatorTool() }
      })

      expect(wrapper.vm.state.display).toBe('0')
      expect(wrapper.vm.state.operator).toBeNull()
    })

    it('should initialize converter state', () => {
      wrapper = mount(ToolRenderer, {
        props: { tool: createConverterTool() }
      })

      expect(wrapper.vm.state.value).toBe('')
      expect(wrapper.vm.state.fromUnit).toBe('meters')
      expect(wrapper.vm.state.toUnit).toBe('feet')
    })
  })

  describe('Display Formatter', () => {
    it('should format single display using formatter', async () => {
      wrapper = mount(ToolRenderer, {
        props: { tool: createCalculatorTool() }
      })
      await nextTick()

      expect(wrapper.find('.display-single').text()).toBe('0')
    })

    it('should format multi display with main and secondary', async () => {
      wrapper = mount(ToolRenderer, {
        props: { tool: createConverterTool() }
      })
      await nextTick()

      expect(wrapper.find('.display-secondary').text()).toBe('Converting...')
    })

    it('should format stats display with labels and values', async () => {
      wrapper = mount(ToolRenderer, {
        props: { tool: createTextProcessorTool() }
      })
      await nextTick()

      expect(wrapper.find('.stat-label').text()).toBe('Words')
      expect(wrapper.find('.stat-value').text()).toBe('0')
    })

    it('should handle formatter errors gracefully', async () => {
      const toolWithBadFormatter = {
        name: 'Test',
        elements: [],
        state: {},
        display: { type: 'single' },
        displayFormatter: 'throw new Error("bad");'
      }

      wrapper = mount(ToolRenderer, {
        props: { tool: toolWithBadFormatter }
      })
      await nextTick()

      // Should not throw, should show empty
      expect(wrapper.find('.display-single').text()).toBe('')
    })
  })

  describe('Code Details', () => {
    it('should render code details section', () => {
      wrapper = mount(ToolRenderer, {
        props: { tool: createCalculatorTool() }
      })

      expect(wrapper.find('.code-details').exists()).toBe(true)
      expect(wrapper.find('.code-summary').exists()).toBe(true)
    })

    it('should have View Specification summary text', () => {
      wrapper = mount(ToolRenderer, {
        props: { tool: createCalculatorTool() }
      })

      expect(wrapper.find('.code-summary').text()).toBe('View Specification')
    })
  })

  describe('Single Button Element', () => {
    it('should render single button', () => {
      const toolWithSingleButton = {
        name: 'Test',
        elements: [
          { type: 'button', label: 'Submit', action: 'submit', class: 'primary' }
        ],
        state: {},
        actions: { submit: '' }
      }

      wrapper = mount(ToolRenderer, {
        props: { tool: toolWithSingleButton }
      })

      expect(wrapper.find('.single-button').exists()).toBe(true)
      expect(wrapper.find('.single-button').text()).toBe('Submit')
      expect(wrapper.find('.single-button').classes()).toContain('primary')
    })
  })

  describe('Tool without display', () => {
    it('should render without display section', () => {
      const toolWithoutDisplay = {
        name: 'Test',
        elements: [
          { type: 'button', label: 'Click', action: 'test' }
        ],
        state: {},
        actions: { test: '' }
      }

      wrapper = mount(ToolRenderer, {
        props: { tool: toolWithoutDisplay }
      })

      expect(wrapper.find('.tool-display').exists()).toBe(false)
      expect(wrapper.find('.single-button').exists()).toBe(true)
    })
  })

  describe('Color Input', () => {
    it('should render color input', () => {
      const colorTool = {
        name: 'Color Picker',
        layout: 'custom',
        state: { hex: '#ff0000', r: 255, g: 0, b: 0 },
        elements: [
          { type: 'color-input', stateKey: 'hex' }
        ],
        actions: {}
      }

      wrapper = mount(ToolRenderer, {
        props: { tool: colorTool }
      })

      expect(wrapper.find('.color-input-group').exists()).toBe(true)
      expect(wrapper.find('.color-picker').exists()).toBe(true)
      expect(wrapper.find('.color-text').exists()).toBe(true)
    })

    it('should update hex and RGB on color change', async () => {
      const colorTool = {
        name: 'Color Picker',
        layout: 'custom',
        state: { hex: '#ff0000', r: 255, g: 0, b: 0 },
        elements: [
          { type: 'color-input', stateKey: 'hex' }
        ],
        actions: {}
      }

      wrapper = mount(ToolRenderer, {
        props: { tool: colorTool }
      })

      const colorPicker = wrapper.find('.color-picker')
      await colorPicker.setValue('#00ff00')

      expect(wrapper.vm.state.hex).toBe('#00ff00')
      expect(wrapper.vm.state.r).toBe(0)
      expect(wrapper.vm.state.g).toBe(255)
      expect(wrapper.vm.state.b).toBe(0)
    })
  })

  describe('Input Row', () => {
    it('should render input row with multiple inputs', () => {
      const toolWithInputRow = {
        name: 'Test',
        state: { r: 0, g: 0, b: 0 },
        elements: [
          {
            type: 'input-row',
            inputs: [
              { label: 'R', stateKey: 'r', type: 'number' },
              { label: 'G', stateKey: 'g', type: 'number' },
              { label: 'B', stateKey: 'b', type: 'number' }
            ]
          }
        ],
        actions: {}
      }

      wrapper = mount(ToolRenderer, {
        props: { tool: toolWithInputRow }
      })

      expect(wrapper.find('.input-row').exists()).toBe(true)
      expect(wrapper.findAll('.input-row-item')).toHaveLength(3)
    })
  })
})
