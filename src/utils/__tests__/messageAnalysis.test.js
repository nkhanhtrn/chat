import { describe, it, expect } from 'vitest'
import {
  getCapabilityType,
  getMessageStatus,
  getWebSources,
  getPlanSteps,
  getRawOutput
} from '../messageAnalysis.js'

describe('messageAnalysis utilities', () => {
  describe('getCapabilityType', () => {
    it('should return "text" for messages without analysis', () => {
      expect(getCapabilityType({})).toBe('text')
      expect(getCapabilityType({ content: 'hello' })).toBe('text')
    })

    it('should return "planning" for planning capability', () => {
      expect(getCapabilityType({ analysis: { capability: 'planning' } })).toBe('planning')
      // Note: planning object alone doesn't trigger planning type - needs analysis
      expect(getCapabilityType({ analysis: {}, planning: { plan: {} } })).toBe('planning')
    })

    it('should return "websearch" for web search tasks', () => {
      expect(getCapabilityType({ analysis: { needsWebSearch: true } })).toBe('websearch')
      expect(getCapabilityType({ analysis: { capability: 'websearch' } })).toBe('websearch')
    })

    it('should return "visualization" for visualization tasks', () => {
      expect(getCapabilityType({ analysis: { isVisualization: true } })).toBe('visualization')
      expect(getCapabilityType({ analysis: { capability: 'visualization' } })).toBe('visualization')
    })

    it('should return "build" for build capability', () => {
      expect(getCapabilityType({ analysis: { capability: 'build' } })).toBe('build')
    })

    it('should return "code" for code capability', () => {
      expect(getCapabilityType({ analysis: { capability: 'code' } })).toBe('code')
    })

    it('should return "text" for unknown capabilities', () => {
      expect(getCapabilityType({ analysis: { capability: 'unknown' } })).toBe('text')
    })
  })

  describe('getMessageStatus', () => {
    it('should return "running" for last message while streaming', () => {
      expect(getMessageStatus({}, true, true)).toBe('running')
    })

    it('should return "failed" for failed execution', () => {
      expect(getMessageStatus({ execution: { success: false } }, false, false)).toBe('failed')
    })

    it('should return "complete" when message has content', () => {
      expect(getMessageStatus({ content: 'Hello' }, false, false)).toBe('complete')
    })

    it('should return "complete" when message has visualization', () => {
      expect(getMessageStatus({ visualization: {} }, false, false)).toBe('complete')
    })

    it('should return "complete" when message has tool', () => {
      expect(getMessageStatus({ tool: {} }, false, false)).toBe('complete')
    })

    it('should return "complete" when planning is complete', () => {
      expect(getMessageStatus({ planningComplete: true }, false, false)).toBe('complete')
    })

    it('should return "running" for last message without content', () => {
      expect(getMessageStatus({}, true, false)).toBe('running')
    })

    it('should return "complete" for non-last messages', () => {
      expect(getMessageStatus({}, false, false)).toBe('complete')
    })
  })

  describe('getWebSources', () => {
    it('should return empty array when no search data', () => {
      expect(getWebSources({}, false, false)).toEqual([])
    })

    it('should return pending sources with loading status', () => {
      const msg = {
        webSearchPending: [
          { url: 'https://example.com', title: 'Example' }
        ]
      }
      const sources = getWebSources(msg, false, false)
      expect(sources).toHaveLength(1)
      expect(sources[0]).toEqual({
        title: 'Example',
        url: 'https://example.com',
        status: 'loading',
        fetchStatus: null
      })
    })

    it('should update status when results are fetched', () => {
      const msg = {
        webSearchPending: [
          { url: 'https://example.com', title: 'Example' }
        ],
        webSearchResults: [
          { url: 'https://example.com', success: true, title: 'Example' }
        ]
      }
      const sources = getWebSources(msg, false, false)
      expect(sources[0].status).toBe('success')
      expect(sources[0].fetchStatus).toBe('fetched')
    })

    it('should show error status for failed fetches', () => {
      const msg = {
        webSearchPending: [
          { url: 'https://example.com', title: 'Example' }
        ],
        webSearchResults: [
          { url: 'https://example.com', success: false }
        ]
      }
      const sources = getWebSources(msg, false, false)
      expect(sources[0].status).toBe('error')
      expect(sources[0].fetchStatus).toBe('snippet')
    })

    it('should return completed results when no pending', () => {
      const msg = {
        webSearchResults: [
          { url: 'https://a.com', success: true, title: 'A' },
          { url: 'https://b.com', success: false, title: 'B' }
        ]
      }
      const sources = getWebSources(msg, false, false)
      expect(sources).toHaveLength(2)
      expect(sources[0].status).toBe('success')
      expect(sources[1].status).toBe('error')
    })

    it('should show loading placeholders during active search', () => {
      const msg = { webSearchTotal: 3 }
      const sources = getWebSources(msg, true, true)
      expect(sources).toHaveLength(3)
      sources.forEach(s => {
        expect(s.status).toBe('loading')
        expect(s.title).toBe('Loading...')
      })
    })
  })

  describe('getPlanSteps', () => {
    it('should return empty array when no planning', () => {
      expect(getPlanSteps({}, -1)).toEqual([])
      expect(getPlanSteps({ planning: {} }, -1)).toEqual([])
    })

    it('should return steps with pending status', () => {
      const msg = {
        planning: {
          plan: {
            steps: [
              { capability: 'websearch', task: 'Search for info' },
              { capability: 'code', task: 'Write code' }
            ]
          }
        }
      }
      const steps = getPlanSteps(msg, -1)
      expect(steps).toHaveLength(2)
      expect(steps[0].status).toBe('pending')
      expect(steps[1].status).toBe('pending')
    })

    it('should mark current step as running', () => {
      const msg = {
        planning: {
          plan: {
            steps: [
              { capability: 'websearch', task: 'Search' },
              { capability: 'code', task: 'Code' }
            ]
          }
        }
      }
      const steps = getPlanSteps(msg, 1)
      expect(steps[0].status).toBe('complete')
      expect(steps[1].status).toBe('running')
    })

    it('should use step results for status', () => {
      const msg = {
        planning: {
          plan: {
            steps: [
              { capability: 'websearch', task: 'Search' },
              { capability: 'code', task: 'Code' }
            ]
          },
          stepResults: [
            { success: true },
            { success: false }
          ]
        }
      }
      const steps = getPlanSteps(msg, -1)
      expect(steps[0].status).toBe('complete')
      expect(steps[1].status).toBe('failed')
    })
  })

  describe('getRawOutput', () => {
    it('should return null for empty message', () => {
      expect(getRawOutput({})).toBeNull()
    })

    it('should return execution result on success', () => {
      const msg = { execution: { success: true, result: 'output' } }
      expect(getRawOutput(msg)).toBe('output')
    })

    it('should return execution error on failure', () => {
      const msg = { execution: { success: false, error: 'failed' } }
      expect(getRawOutput(msg)).toBe('failed')
    })

    it('should return visualization content', () => {
      const msg = { visualization: { content: 'chart config' } }
      expect(getRawOutput(msg)).toBe('chart config')
    })

    it('should return tool spec', () => {
      const tool = { name: 'calculator', params: {} }
      const msg = { tool }
      expect(getRawOutput(msg)).toBe(tool)
    })

    it('should return planning step results', () => {
      const stepResults = [{ success: true }, { success: false }]
      const msg = { planning: { stepResults } }
      expect(getRawOutput(msg)).toBe(stepResults)
    })

    it('should prioritize execution over other outputs', () => {
      const msg = {
        execution: { success: true, result: 'exec result' },
        visualization: { content: 'viz' },
        tool: { name: 'tool' }
      }
      expect(getRawOutput(msg)).toBe('exec result')
    })
  })
})
