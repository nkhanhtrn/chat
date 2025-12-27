import { describe, it, expect, vi } from 'vitest'
import { parseChartOption } from '../chart.js'

describe('chart utilities', () => {
  describe('parseChartOption', () => {
    it('should parse valid JSON', () => {
      const json = '{"title": {"text": "My Chart"}, "series": [{"data": [1, 2, 3]}]}'
      const result = parseChartOption(json)
      expect(result).toEqual({
        title: { text: 'My Chart' },
        series: [{ data: [1, 2, 3] }]
      })
    })

    it('should return error placeholder for invalid JSON', () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const result = parseChartOption('not valid json')
      expect(result).toEqual({ title: { text: 'Chart parsing error' } })
      expect(consoleWarn).toHaveBeenCalled()
      consoleWarn.mockRestore()
    })

    it('should handle empty string', () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const result = parseChartOption('')
      expect(result).toEqual({ title: { text: 'Chart parsing error' } })
      consoleWarn.mockRestore()
    })

    it('should handle complex nested structures', () => {
      const complex = JSON.stringify({
        title: { text: 'Complex Chart' },
        xAxis: { type: 'category', data: ['A', 'B', 'C'] },
        yAxis: { type: 'value' },
        series: [
          { name: 'Series 1', type: 'bar', data: [10, 20, 30] },
          { name: 'Series 2', type: 'line', data: [15, 25, 35] }
        ]
      })
      const result = parseChartOption(complex)
      expect(result.title.text).toBe('Complex Chart')
      expect(result.series).toHaveLength(2)
    })
  })
})
