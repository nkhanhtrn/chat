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

  describe('Checkbox', () => {
    it('should render checkbox', () => {
      const tool = {
        name: 'Test',
        state: { checked: false },
        elements: [
          { type: 'checkbox', label: 'Accept terms', stateKey: 'checked' }
        ],
        actions: {}
      }

      wrapper = mount(ToolRenderer, {
        props: { tool }
      })

      expect(wrapper.find('.checkbox-group').exists()).toBe(true)
      expect(wrapper.find('.checkbox-input').exists()).toBe(true)
      expect(wrapper.find('.checkbox-text').text()).toBe('Accept terms')
    })

    it('should toggle checkbox state', async () => {
      const tool = {
        name: 'Test',
        state: { checked: false },
        elements: [
          { type: 'checkbox', label: 'Accept', stateKey: 'checked' }
        ],
        actions: {}
      }

      wrapper = mount(ToolRenderer, {
        props: { tool }
      })

      const checkbox = wrapper.find('.checkbox-input')
      await checkbox.setValue(true)
      expect(wrapper.vm.state.checked).toBe(true)
    })
  })

  describe('Checkbox Group', () => {
    it('should render checkbox group with options', () => {
      const tool = {
        name: 'Test',
        state: { features: [] },
        elements: [
          {
            type: 'checkbox-group',
            label: 'Features',
            stateKey: 'features',
            options: [
              { value: 'a', label: 'Option A' },
              { value: 'b', label: 'Option B' }
            ]
          }
        ],
        actions: {}
      }

      wrapper = mount(ToolRenderer, {
        props: { tool }
      })

      expect(wrapper.find('.checkbox-group-container').exists()).toBe(true)
      expect(wrapper.findAll('.checkbox-label')).toHaveLength(2)
    })

    it('should toggle checkbox options in group', async () => {
      const tool = {
        name: 'Test',
        state: { features: [] },
        elements: [
          {
            type: 'checkbox-group',
            label: 'Features',
            stateKey: 'features',
            options: [
              { value: 'a', label: 'Option A' },
              { value: 'b', label: 'Option B' }
            ]
          }
        ],
        actions: {}
      }

      wrapper = mount(ToolRenderer, {
        props: { tool }
      })

      const checkboxes = wrapper.findAll('.checkbox-input')
      await checkboxes[0].setValue(true)
      expect(wrapper.vm.state.features).toContain('a')

      await checkboxes[1].setValue(true)
      expect(wrapper.vm.state.features).toContain('b')

      await checkboxes[0].setValue(false)
      expect(wrapper.vm.state.features).not.toContain('a')
    })
  })

  describe('Radio Group', () => {
    it('should render radio group with options', () => {
      const tool = {
        name: 'Test',
        state: { choice: 'a' },
        elements: [
          {
            type: 'radio-group',
            label: 'Choice',
            stateKey: 'choice',
            options: [
              { value: 'a', label: 'Option A' },
              { value: 'b', label: 'Option B' }
            ]
          }
        ],
        actions: {}
      }

      wrapper = mount(ToolRenderer, {
        props: { tool }
      })

      expect(wrapper.find('.radio-group-container').exists()).toBe(true)
      expect(wrapper.findAll('.radio-label')).toHaveLength(2)
    })

    it('should update state on radio selection', async () => {
      const tool = {
        name: 'Test',
        state: { choice: 'a' },
        elements: [
          {
            type: 'radio-group',
            label: 'Choice',
            stateKey: 'choice',
            options: [
              { value: 'a', label: 'Option A' },
              { value: 'b', label: 'Option B' }
            ]
          }
        ],
        actions: {}
      }

      wrapper = mount(ToolRenderer, {
        props: { tool }
      })

      const radios = wrapper.findAll('.radio-input')
      await radios[1].setValue()
      expect(wrapper.vm.state.choice).toBe('b')
    })
  })

  describe('Range/Slider', () => {
    it('should render range input', async () => {
      const tool = {
        name: 'Test',
        state: { value: 50 },
        elements: [
          {
            type: 'range',
            label: 'Volume',
            stateKey: 'value',
            min: 0,
            max: 100,
            showValue: true
          }
        ],
        actions: {}
      }

      wrapper = mount(ToolRenderer, {
        props: { tool }
      })
      await nextTick()

      expect(wrapper.find('.range-container').exists()).toBe(true)
      expect(wrapper.find('.range-input').exists()).toBe(true)
      expect(wrapper.find('.range-value').text()).toBe('50')
    })

    it('should update state on range change', async () => {
      const tool = {
        name: 'Test',
        state: { value: 50 },
        elements: [
          { type: 'range', label: 'Volume', stateKey: 'value', min: 0, max: 100 }
        ],
        actions: {}
      }

      wrapper = mount(ToolRenderer, {
        props: { tool }
      })

      const range = wrapper.find('.range-input')
      await range.setValue(75)
      expect(wrapper.vm.state.value).toBe(75)
    })
  })

  describe('Toggle/Switch', () => {
    it('should render toggle switch', () => {
      const tool = {
        name: 'Test',
        state: { enabled: false },
        elements: [
          { type: 'toggle', label: 'Enable', stateKey: 'enabled' }
        ],
        actions: {}
      }

      wrapper = mount(ToolRenderer, {
        props: { tool }
      })

      expect(wrapper.find('.toggle-container').exists()).toBe(true)
      expect(wrapper.find('.toggle-switch').exists()).toBe(true)
      expect(wrapper.find('.toggle-text').text()).toBe('Enable')
    })

    it('should toggle state on click', async () => {
      const tool = {
        name: 'Test',
        state: { enabled: false },
        elements: [
          { type: 'toggle', label: 'Enable', stateKey: 'enabled' }
        ],
        actions: {}
      }

      wrapper = mount(ToolRenderer, {
        props: { tool }
      })

      const toggle = wrapper.find('.toggle-switch')
      await toggle.trigger('click')
      expect(wrapper.vm.state.enabled).toBe(true)

      await toggle.trigger('click')
      expect(wrapper.vm.state.enabled).toBe(false)
    })

    it('should show active state when enabled', async () => {
      const tool = {
        name: 'Test',
        state: { enabled: true },
        elements: [
          { type: 'toggle', label: 'Enable', stateKey: 'enabled' }
        ],
        actions: {}
      }

      wrapper = mount(ToolRenderer, {
        props: { tool }
      })
      await nextTick()

      expect(wrapper.find('.toggle-switch').classes()).toContain('active')
    })
  })

  describe('Date/Time Inputs', () => {
    it('should render date input', () => {
      const tool = {
        name: 'Test',
        state: { date: '' },
        elements: [
          { type: 'date', label: 'Date', stateKey: 'date' }
        ],
        actions: {}
      }

      wrapper = mount(ToolRenderer, {
        props: { tool }
      })

      expect(wrapper.find('input[type="date"]').exists()).toBe(true)
    })

    it('should render time input', () => {
      const tool = {
        name: 'Test',
        state: { time: '' },
        elements: [
          { type: 'time', label: 'Time', stateKey: 'time' }
        ],
        actions: {}
      }

      wrapper = mount(ToolRenderer, {
        props: { tool }
      })

      expect(wrapper.find('input[type="time"]').exists()).toBe(true)
    })

    it('should render datetime input', () => {
      const tool = {
        name: 'Test',
        state: { datetime: '' },
        elements: [
          { type: 'datetime', label: 'DateTime', stateKey: 'datetime' }
        ],
        actions: {}
      }

      wrapper = mount(ToolRenderer, {
        props: { tool }
      })

      expect(wrapper.find('input[type="datetime-local"]').exists()).toBe(true)
    })
  })

  describe('Progress Bar', () => {
    it('should render progress bar', async () => {
      const tool = {
        name: 'Test',
        state: { progress: 75 },
        elements: [
          { type: 'progress', label: 'Progress', stateKey: 'progress' }
        ],
        actions: {}
      }

      wrapper = mount(ToolRenderer, {
        props: { tool }
      })
      await nextTick()

      expect(wrapper.find('.progress-container').exists()).toBe(true)
      expect(wrapper.find('.progress-bar').exists()).toBe(true)
      expect(wrapper.find('.progress-fill').attributes('style')).toContain('width: 75%')
      expect(wrapper.find('.progress-text').text()).toBe('75%')
    })
  })

  describe('Meter', () => {
    it('should render meter element', () => {
      const tool = {
        name: 'Test',
        state: { value: 5 },
        elements: [
          { type: 'meter', label: 'Level', stateKey: 'value', min: 0, max: 10 }
        ],
        actions: {}
      }

      wrapper = mount(ToolRenderer, {
        props: { tool }
      })

      expect(wrapper.find('.meter-container').exists()).toBe(true)
      expect(wrapper.find('.meter-element').exists()).toBe(true)
    })
  })

  describe('Rating Stars', () => {
    it('should render rating stars', async () => {
      const tool = {
        name: 'Test',
        state: { rating: 3 },
        elements: [
          { type: 'rating', label: 'Rating', stateKey: 'rating', max: 5 }
        ],
        actions: {}
      }

      wrapper = mount(ToolRenderer, {
        props: { tool }
      })
      await nextTick()

      expect(wrapper.find('.rating-container').exists()).toBe(true)
      expect(wrapper.findAll('.rating-star')).toHaveLength(5)
      expect(wrapper.findAll('.rating-star.filled')).toHaveLength(3)
    })

    it('should update rating on star click', async () => {
      const tool = {
        name: 'Test',
        state: { rating: 0 },
        elements: [
          { type: 'rating', label: 'Rating', stateKey: 'rating', max: 5 }
        ],
        actions: {}
      }

      wrapper = mount(ToolRenderer, {
        props: { tool }
      })
      await nextTick()

      const stars = wrapper.findAll('.rating-star')
      await stars[3].trigger('click') // Click 4th star
      expect(wrapper.vm.state.rating).toBe(4)
    })
  })

  describe('Stepper', () => {
    it('should render stepper', async () => {
      const tool = {
        name: 'Test',
        state: { count: 5 },
        elements: [
          { type: 'stepper', label: 'Count', stateKey: 'count', min: 0, max: 10 }
        ],
        actions: {}
      }

      wrapper = mount(ToolRenderer, {
        props: { tool }
      })
      await nextTick()

      expect(wrapper.find('.stepper-container').exists()).toBe(true)
      expect(wrapper.findAll('.stepper-btn')).toHaveLength(2)
      expect(wrapper.find('.stepper-value').text()).toBe('5')
    })

    it('should increment and decrement value', async () => {
      const tool = {
        name: 'Test',
        state: { count: 5 },
        elements: [
          { type: 'stepper', label: 'Count', stateKey: 'count', min: 0, max: 10, step: 1 }
        ],
        actions: {}
      }

      wrapper = mount(ToolRenderer, {
        props: { tool }
      })
      await nextTick()

      const buttons = wrapper.findAll('.stepper-btn')
      await buttons[1].trigger('click') // +
      expect(wrapper.vm.state.count).toBe(6)

      await buttons[0].trigger('click') // -
      expect(wrapper.vm.state.count).toBe(5)
    })

    it('should respect min/max bounds', async () => {
      const tool = {
        name: 'Test',
        state: { count: 10 },
        elements: [
          { type: 'stepper', label: 'Count', stateKey: 'count', min: 0, max: 10, step: 1 }
        ],
        actions: {}
      }

      wrapper = mount(ToolRenderer, {
        props: { tool }
      })
      await nextTick()

      const buttons = wrapper.findAll('.stepper-btn')
      await buttons[1].trigger('click') // Try to go above max
      expect(wrapper.vm.state.count).toBe(10) // Should stay at max
    })
  })

  describe('Alert', () => {
    it('should render alert with types', () => {
      const tool = {
        name: 'Test',
        state: {},
        elements: [
          { type: 'alert', alertType: 'info', message: 'Info message', dismissible: false }
        ],
        actions: {}
      }

      wrapper = mount(ToolRenderer, {
        props: { tool }
      })

      expect(wrapper.find('.alert-container').exists()).toBe(true)
      expect(wrapper.find('.alert-info').exists()).toBe(true)
      expect(wrapper.find('.alert-message').text()).toBe('Info message')
    })

    it('should render dismissible alert', () => {
      const tool = {
        name: 'Test',
        state: {},
        elements: [
          { type: 'alert', alertType: 'warning', message: 'Warning', dismissible: true }
        ],
        actions: {}
      }

      wrapper = mount(ToolRenderer, {
        props: { tool }
      })

      expect(wrapper.find('.alert-dismiss').exists()).toBe(true)
    })
  })

  describe('Table', () => {
    it('should render table with data', async () => {
      const tool = {
        name: 'Test',
        state: {
          rows: [
            { name: 'Item 1', value: 10 },
            { name: 'Item 2', value: 20 }
          ]
        },
        elements: [
          {
            type: 'table',
            columns: [
              { key: 'name', label: 'Name' },
              { key: 'value', label: 'Value' }
            ],
            rowsStateKey: 'rows'
          }
        ],
        actions: {}
      }

      wrapper = mount(ToolRenderer, {
        props: { tool }
      })
      await nextTick()

      expect(wrapper.find('.table-container').exists()).toBe(true)
      expect(wrapper.find('.data-table').exists()).toBe(true)
      expect(wrapper.findAll('.data-table th')).toHaveLength(2)
      expect(wrapper.findAll('.data-table tbody tr')).toHaveLength(2)
    })
  })

  describe('List', () => {
    it('should render unordered list', async () => {
      const tool = {
        name: 'Test',
        state: { items: ['Item 1', 'Item 2', 'Item 3'] },
        elements: [
          { type: 'list', stateKey: 'items', ordered: false }
        ],
        actions: {}
      }

      wrapper = mount(ToolRenderer, {
        props: { tool }
      })
      await nextTick()

      expect(wrapper.find('.list-container').exists()).toBe(true)
      expect(wrapper.find('ul.list-element').exists()).toBe(true)
      expect(wrapper.findAll('li')).toHaveLength(3)
    })

    it('should render ordered list', async () => {
      const tool = {
        name: 'Test',
        state: { items: ['First', 'Second'] },
        elements: [
          { type: 'list', stateKey: 'items', ordered: true }
        ],
        actions: {}
      }

      wrapper = mount(ToolRenderer, {
        props: { tool }
      })
      await nextTick()

      expect(wrapper.find('ol.list-element').exists()).toBe(true)
    })
  })

  describe('Divider and Spacer', () => {
    it('should render divider', () => {
      const tool = {
        name: 'Test',
        state: {},
        elements: [
          { type: 'divider' }
        ],
        actions: {}
      }

      wrapper = mount(ToolRenderer, {
        props: { tool }
      })

      expect(wrapper.find('hr.divider').exists()).toBe(true)
    })

    it('should render spacer with size', () => {
      const tool = {
        name: 'Test',
        state: {},
        elements: [
          { type: 'spacer', size: 'lg' }
        ],
        actions: {}
      }

      wrapper = mount(ToolRenderer, {
        props: { tool }
      })

      expect(wrapper.find('.spacer').exists()).toBe(true)
      expect(wrapper.find('.spacer').classes()).toContain('spacer-lg')
    })
  })

  describe('Heading and Text', () => {
    it('should render heading with level', () => {
      const tool = {
        name: 'Test',
        state: {},
        elements: [
          { type: 'heading', level: 2, text: 'Section Title' }
        ],
        actions: {}
      }

      wrapper = mount(ToolRenderer, {
        props: { tool }
      })

      expect(wrapper.find('h2.heading-element').exists()).toBe(true)
      expect(wrapper.find('h2.heading-element').text()).toBe('Section Title')
    })

    it('should render text paragraph', () => {
      const tool = {
        name: 'Test',
        state: {},
        elements: [
          { type: 'text', text: 'This is a paragraph.' }
        ],
        actions: {}
      }

      wrapper = mount(ToolRenderer, {
        props: { tool }
      })

      expect(wrapper.find('p.text-element').exists()).toBe(true)
      expect(wrapper.find('p.text-element').text()).toBe('This is a paragraph.')
    })
  })

  describe('Card', () => {
    it('should render card with content', () => {
      const tool = {
        name: 'Test',
        state: {},
        elements: [
          {
            type: 'card',
            title: 'Card Title',
            subtitle: 'Card subtitle',
            content: [
              { type: 'text', text: 'Card content' }
            ],
            footer: 'Card footer'
          }
        ],
        actions: {}
      }

      wrapper = mount(ToolRenderer, {
        props: { tool }
      })

      expect(wrapper.find('.card-container').exists()).toBe(true)
      expect(wrapper.find('.card-title').text()).toBe('Card Title')
      expect(wrapper.find('.card-subtitle').text()).toBe('Card subtitle')
      expect(wrapper.find('.card-footer').text()).toBe('Card footer')
    })
  })

  describe('Badge Group', () => {
    it('should render badges from state', async () => {
      const tool = {
        name: 'Test',
        state: { tags: ['Tag1', 'Tag2', 'Tag3'] },
        elements: [
          { type: 'badge-group', stateKey: 'tags' }
        ],
        actions: {}
      }

      wrapper = mount(ToolRenderer, {
        props: { tool }
      })
      await nextTick()

      expect(wrapper.find('.badge-group').exists()).toBe(true)
      expect(wrapper.findAll('.badge')).toHaveLength(3)
    })
  })

  describe('Escape Sequence Handling', () => {
    // Helper to create strings with literal backslash (simulating LLM output)
    // When LLM outputs \s, it comes as a literal backslash + s in the JSON
    const withInvalidEscape = (pattern) => {
      // Replace placeholder with literal backslash (not escape sequence)
      return pattern.replace(/_BS_/g, '\\')
    }

    it('should handle displayFormatter with properly escaped regex', async () => {
      const tool = {
        name: 'Word Counter',
        state: { text: 'hello world test' },
        display: { type: 'single' },
        elements: [],
        actions: {},
        // Properly escaped: \\s becomes \s in the actual code
        displayFormatter: "const words = state.text.trim().split(/\\s+/).length; return String(words);"
      }

      wrapper = mount(ToolRenderer, {
        props: { tool }
      })
      await nextTick()

      expect(wrapper.find('.display-single').text()).toBe('3')
    })

    it('should fix displayFormatter with invalid escape sequences', async () => {
      // Simulate what happens when LLM outputs \s instead of \\s
      // The string contains literal backslash-s which causes "invalid escape" error
      const invalidFormatter = withInvalidEscape(
        "const words = state.text.trim().split(/_BS_s+/).length; return String(words);"
      )

      const tool = {
        name: 'Word Counter',
        state: { text: 'hello world test' },
        display: { type: 'single' },
        elements: [],
        actions: {},
        displayFormatter: invalidFormatter
      }

      wrapper = mount(ToolRenderer, {
        props: { tool }
      })
      await nextTick()

      // Should still work after escape sequence fix
      expect(wrapper.find('.display-single').text()).toBe('3')
    })

    it('should handle action with properly escaped regex', async () => {
      const tool = {
        name: 'Test',
        state: { text: 'a  b  c', result: '' },
        elements: [
          { type: 'button', label: 'Process', action: 'process' }
        ],
        // Properly escaped
        actions: {
          process: "state.result = state.text.split(/\\s+/).join('-');"
        }
      }

      wrapper = mount(ToolRenderer, {
        props: { tool }
      })
      await nextTick()

      await wrapper.find('.single-button').trigger('click')
      expect(wrapper.vm.state.result).toBe('a-b-c')
    })

    it('should fix action with invalid escape sequences', async () => {
      const invalidAction = withInvalidEscape(
        "state.result = state.text.split(/_BS_s+/).join('-');"
      )

      const tool = {
        name: 'Test',
        state: { text: 'a  b  c', result: '' },
        elements: [
          { type: 'button', label: 'Process', action: 'process' }
        ],
        actions: {
          process: invalidAction
        }
      }

      wrapper = mount(ToolRenderer, {
        props: { tool }
      })
      await nextTick()

      await wrapper.find('.single-button').trigger('click')
      // Should still work after escape sequence fix
      expect(wrapper.vm.state.result).toBe('a-b-c')
    })

    it('should handle multiple escape sequences in one action', async () => {
      const invalidAction = withInvalidEscape(
        "state.digits = state.text.match(/_BS_d+/g).join(','); state.words = state.text.match(/_BS_w+/g).join(',');"
      )

      const tool = {
        name: 'Test',
        state: { text: '123 abc 456', digits: '', words: '' },
        elements: [
          { type: 'button', label: 'Extract', action: 'extract' }
        ],
        actions: {
          extract: invalidAction
        }
      }

      wrapper = mount(ToolRenderer, {
        props: { tool }
      })
      await nextTick()

      await wrapper.find('.single-button').trigger('click')
      expect(wrapper.vm.state.digits).toBe('123,456')
      expect(wrapper.vm.state.words).toBe('123,abc,456')
    })

    it('should handle newline escape in regex', async () => {
      const invalidAction = withInvalidEscape(
        "state.count = state.text.split(/_BS_n/).length;"
      )

      const tool = {
        name: 'Test',
        state: { text: 'line1\nline2\nline3', count: 0 },
        elements: [
          { type: 'button', label: 'Count Lines', action: 'countLines' }
        ],
        actions: {
          countLines: invalidAction
        }
      }

      wrapper = mount(ToolRenderer, {
        props: { tool }
      })
      await nextTick()

      await wrapper.find('.single-button').trigger('click')
      expect(wrapper.vm.state.count).toBe(3)
    })

    it('should not break already escaped sequences', async () => {
      const tool = {
        name: 'Test',
        state: { text: 'hello   world', result: '' },
        elements: [
          { type: 'button', label: 'Process', action: 'process' }
        ],
        actions: {
          // Already properly escaped with \\s
          process: "state.result = state.text.replace(/\\s+/g, ' ');"
        }
      }

      wrapper = mount(ToolRenderer, {
        props: { tool }
      })
      await nextTick()

      await wrapper.find('.single-button').trigger('click')
      expect(wrapper.vm.state.result).toBe('hello world')
    })
  })
})
