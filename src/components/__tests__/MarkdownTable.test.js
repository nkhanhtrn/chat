import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import MarkdownTable from '../MarkdownTable.vue'
import TableCell from '../TableCell.vue'

describe('MarkdownTable', () => {
  let wrapper

  beforeEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Rendering', () => {
    it('should render table with headers and rows', () => {
      const headers = [
        [{ type: 'text', text: 'Name' }],
        [{ type: 'text', text: 'Age' }]
      ]
      const rows = [
        [[{ type: 'text', text: 'Alice' }], [{ type: 'text', text: '25' }]],
        [[{ type: 'text', text: 'Bob' }], [{ type: 'text', text: '30' }]]
      ]

      wrapper = mount(MarkdownTable, {
        props: { headers, rows }
      })

      expect(wrapper.find('table').exists()).toBe(true)
      expect(wrapper.find('thead').exists()).toBe(true)
      expect(wrapper.find('tbody').exists()).toBe(true)
    })

    it('should render correct number of header cells', () => {
      const headers = [
        [{ type: 'text', text: 'Col1' }],
        [{ type: 'text', text: 'Col2' }],
        [{ type: 'text', text: 'Col3' }]
      ]
      const rows = []

      wrapper = mount(MarkdownTable, {
        props: { headers, rows }
      })

      const headerCells = wrapper.findAll('thead th')
      expect(headerCells).toHaveLength(3)
    })

    it('should render correct number of body rows', () => {
      const headers = [
        [{ type: 'text', text: 'Name' }]
      ]
      const rows = [
        [[{ type: 'text', text: 'Row1' }]],
        [[{ type: 'text', text: 'Row2' }]],
        [[{ type: 'text', text: 'Row3' }]]
      ]

      wrapper = mount(MarkdownTable, {
        props: { headers, rows }
      })

      const bodyRows = wrapper.findAll('tbody tr')
      expect(bodyRows).toHaveLength(3)
    })

    it('should render correct number of cells in each row', () => {
      const headers = [
        [{ type: 'text', text: 'Col1' }],
        [{ type: 'text', text: 'Col2' }]
      ]
      const rows = [
        [[{ type: 'text', text: 'A1' }], [{ type: 'text', text: 'A2' }]],
        [[{ type: 'text', text: 'B1' }], [{ type: 'text', text: 'B2' }]]
      ]

      wrapper = mount(MarkdownTable, {
        props: { headers, rows }
      })

      const firstRowCells = wrapper.findAll('tbody tr:first-child td')
      expect(firstRowCells).toHaveLength(2)
    })

    it('should render TableCell components in headers', () => {
      const headers = [
        [{ type: 'text', text: 'Header1' }]
      ]
      const rows = []

      wrapper = mount(MarkdownTable, {
        props: { headers, rows }
      })

      const tableCells = wrapper.findAllComponents(TableCell)
      expect(tableCells.length).toBeGreaterThan(0)
    })

    it('should render TableCell components in body cells', () => {
      const headers = [
        [{ type: 'text', text: 'Header' }]
      ]
      const rows = [
        [[{ type: 'text', text: 'Cell1' }]],
        [[{ type: 'text', text: 'Cell2' }]]
      ]

      wrapper = mount(MarkdownTable, {
        props: { headers, rows }
      })

      const tableCells = wrapper.findAllComponents(TableCell)
      expect(tableCells.length).toBe(3) // 1 header + 2 body cells
    })

    it('should not render thead when headers array is empty', () => {
      const headers = []
      const rows = [
        [[{ type: 'text', text: 'Cell' }]]
      ]

      wrapper = mount(MarkdownTable, {
        props: { headers, rows }
      })

      expect(wrapper.find('thead').exists()).toBe(false)
    })

    it('should have table-wrapper class', () => {
      const headers = [[{ type: 'text', text: 'Header' }]]
      const rows = []

      wrapper = mount(MarkdownTable, {
        props: { headers, rows }
      })

      expect(wrapper.find('.table-wrapper').exists()).toBe(true)
    })

    it('should have markdown-table class on table', () => {
      const headers = [[{ type: 'text', text: 'Header' }]]
      const rows = []

      wrapper = mount(MarkdownTable, {
        props: { headers, rows }
      })

      expect(wrapper.find('.markdown-table').exists()).toBe(true)
    })
  })

  describe('Props', () => {
    it('should require headers prop', () => {
      const { headers } = MarkdownTable.props
      expect(headers.required).toBe(true)
      expect(headers.type).toBe(Array)
    })

    it('should require rows prop', () => {
      const { rows } = MarkdownTable.props
      expect(rows.required).toBe(true)
      expect(rows.type).toBe(Array)
    })

    it('should have optional alignments prop with default value', () => {
      const { alignments } = MarkdownTable.props
      expect(alignments.required).toBeUndefined()
      expect(alignments.type).toBe(Array)
      expect(alignments.default()).toEqual([])
    })
  })

  describe('Alignment', () => {
    it('should apply left alignment style', () => {
      const headers = [[{ type: 'text', text: 'Left' }]]
      const rows = [[[{ type: 'text', text: 'Data' }]]]
      const alignments = ['left']

      wrapper = mount(MarkdownTable, {
        props: { headers, rows, alignments }
      })

      const headerCell = wrapper.find('thead th')
      expect(headerCell.attributes('style')).toContain('text-align: left')
    })

    it('should apply right alignment style', () => {
      const headers = [[{ type: 'text', text: 'Right' }]]
      const rows = [[[{ type: 'text', text: 'Data' }]]]
      const alignments = ['right']

      wrapper = mount(MarkdownTable, {
        props: { headers, rows, alignments }
      })

      const headerCell = wrapper.find('thead th')
      expect(headerCell.attributes('style')).toContain('text-align: right')
    })

    it('should apply center alignment style', () => {
      const headers = [[{ type: 'text', text: 'Center' }]]
      const rows = [[[{ type: 'text', text: 'Data' }]]]
      const alignments = ['center']

      wrapper = mount(MarkdownTable, {
        props: { headers, rows, alignments }
      })

      const headerCell = wrapper.find('thead th')
      expect(headerCell.attributes('style')).toContain('text-align: center')
    })

    it('should default to left alignment when alignment is undefined', () => {
      const headers = [[{ type: 'text', text: 'Default' }]]
      const rows = [[[{ type: 'text', text: 'Data' }]]]
      const alignments = [undefined]

      wrapper = mount(MarkdownTable, {
        props: { headers, rows, alignments }
      })

      const headerCell = wrapper.find('thead th')
      expect(headerCell.attributes('style')).toContain('text-align: left')
    })

    it('should default to left alignment when alignment is not recognized', () => {
      const headers = [[{ type: 'text', text: 'Unknown' }]]
      const rows = [[[{ type: 'text', text: 'Data' }]]]
      const alignments = ['invalid']

      wrapper = mount(MarkdownTable, {
        props: { headers, rows, alignments }
      })

      const headerCell = wrapper.find('thead th')
      expect(headerCell.attributes('style')).toContain('text-align: left')
    })

    it('should apply different alignments to different columns', () => {
      const headers = [
        [{ type: 'text', text: 'Left' }],
        [{ type: 'text', text: 'Center' }],
        [{ type: 'text', text: 'Right' }]
      ]
      const rows = [
        [
          [{ type: 'text', text: 'L' }],
          [{ type: 'text', text: 'C' }],
          [{ type: 'text', text: 'R' }]
        ]
      ]
      const alignments = ['left', 'center', 'right']

      wrapper = mount(MarkdownTable, {
        props: { headers, rows, alignments }
      })

      const headerCells = wrapper.findAll('thead th')
      expect(headerCells[0].attributes('style')).toContain('text-align: left')
      expect(headerCells[1].attributes('style')).toContain('text-align: center')
      expect(headerCells[2].attributes('style')).toContain('text-align: right')
    })

    it('should apply alignment to body cells', () => {
      const headers = [[{ type: 'text', text: 'Right' }]]
      const rows = [
        [[{ type: 'text', text: 'Data1' }]],
        [[{ type: 'text', text: 'Data2' }]]
      ]
      const alignments = ['right']

      wrapper = mount(MarkdownTable, {
        props: { headers, rows, alignments }
      })

      const bodyCells = wrapper.findAll('tbody td')
      bodyCells.forEach(cell => {
        expect(cell.attributes('style')).toContain('text-align: right')
      })
    })

    it('should work with empty alignments array', () => {
      const headers = [[{ type: 'text', text: 'Header' }]]
      const rows = [[[{ type: 'text', text: 'Data' }]]]

      wrapper = mount(MarkdownTable, {
        props: { headers, rows, alignments: [] }
      })

      const headerCell = wrapper.find('thead th')
      expect(headerCell.attributes('style')).toContain('text-align: left')
    })
  })

  describe('Complex Content', () => {
    it('should render table with bold text in cells', () => {
      const headers = [
        [{ type: 'bold', text: 'Bold Header' }]
      ]
      const rows = [
        [[{ type: 'bold', text: 'Bold Data' }]]
      ]

      wrapper = mount(MarkdownTable, {
        props: { headers, rows }
      })

      expect(wrapper.html()).toBeTruthy()
    })

    it('should render table with code in cells', () => {
      const headers = [
        [{ type: 'code', text: 'code' }]
      ]
      const rows = [
        [[{ type: 'code', text: 'value' }]]
      ]

      wrapper = mount(MarkdownTable, {
        props: { headers, rows }
      })

      expect(wrapper.html()).toBeTruthy()
    })

    it('should render table with mixed content in cells', () => {
      const headers = [
        [
          { type: 'text', text: 'Name: ' },
          { type: 'bold', text: 'Bold' }
        ]
      ]
      const rows = [
        [[
          { type: 'text', text: 'Value: ' },
          { type: 'code', text: 'code' }
        ]]
      ]

      wrapper = mount(MarkdownTable, {
        props: { headers, rows }
      })

      expect(wrapper.html()).toBeTruthy()
    })
  })

  describe('Edge Cases', () => {
    it('should render table with empty rows array', () => {
      const headers = [
        [{ type: 'text', text: 'Header1' }],
        [{ type: 'text', text: 'Header2' }]
      ]
      const rows = []

      wrapper = mount(MarkdownTable, {
        props: { headers, rows }
      })

      expect(wrapper.find('thead').exists()).toBe(true)
      expect(wrapper.findAll('tbody tr')).toHaveLength(0)
    })

    it('should render table with single column', () => {
      const headers = [[{ type: 'text', text: 'Single' }]]
      const rows = [
        [[{ type: 'text', text: 'Row1' }]],
        [[{ type: 'text', text: 'Row2' }]]
      ]

      wrapper = mount(MarkdownTable, {
        props: { headers, rows }
      })

      expect(wrapper.findAll('thead th')).toHaveLength(1)
      expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    })

    it('should render table with many columns', () => {
      const headers = Array(10).fill(null).map((_, i) => 
        [{ type: 'text', text: `Col${i}` }]
      )
      const rows = [
        Array(10).fill(null).map((_, i) => 
          [{ type: 'text', text: `Data${i}` }]
        )
      ]

      wrapper = mount(MarkdownTable, {
        props: { headers, rows }
      })

      expect(wrapper.findAll('thead th')).toHaveLength(10)
      expect(wrapper.findAll('tbody tr:first-child td')).toHaveLength(10)
    })

    it('should handle rows with different number of cells than headers', () => {
      const headers = [
        [{ type: 'text', text: 'H1' }],
        [{ type: 'text', text: 'H2' }]
      ]
      const rows = [
        [[{ type: 'text', text: 'Data' }]] // Only 1 cell, but 2 headers
      ]

      wrapper = mount(MarkdownTable, {
        props: { headers, rows }
      })

      expect(wrapper.find('table').exists()).toBe(true)
    })
  })

  describe('Methods', () => {
    it('should have getAlignment method', () => {
      const headers = [[{ type: 'text', text: 'Header' }]]
      const rows = []

      wrapper = mount(MarkdownTable, {
        props: { headers, rows }
      })

      expect(wrapper.vm.getAlignment).toBeDefined()
      expect(typeof wrapper.vm.getAlignment).toBe('function')
    })

    it('getAlignment should return correct style objects', () => {
      const headers = [[{ type: 'text', text: 'Header' }]]
      const rows = []

      wrapper = mount(MarkdownTable, {
        props: { headers, rows }
      })

      expect(wrapper.vm.getAlignment('left')).toEqual({ textAlign: 'left' })
      expect(wrapper.vm.getAlignment('center')).toEqual({ textAlign: 'center' })
      expect(wrapper.vm.getAlignment('right')).toEqual({ textAlign: 'right' })
      expect(wrapper.vm.getAlignment('unknown')).toEqual({ textAlign: 'left' })
      expect(wrapper.vm.getAlignment(null)).toEqual({ textAlign: 'left' })
    })
  })

  describe('Structure', () => {
    it('should have correct HTML structure', () => {
      const headers = [[{ type: 'text', text: 'Header' }]]
      const rows = [[[{ type: 'text', text: 'Data' }]]]

      wrapper = mount(MarkdownTable, {
        props: { headers, rows }
      })

      expect(wrapper.find('.table-wrapper').exists()).toBe(true)
      expect(wrapper.find('.table-wrapper > table').exists()).toBe(true)
      expect(wrapper.find('table > thead').exists()).toBe(true)
      expect(wrapper.find('table > tbody').exists()).toBe(true)
    })
  })
})
