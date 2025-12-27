import { describe, it, expect, vi } from 'vitest'
import { usePlanning } from '../usePlanning.js'

describe('usePlanning', () => {
  it('should initialize with default state', () => {
    const planning = usePlanning()

    expect(planning.currentPlanningStep.value).toBe(-1)
  })

  it('should reset state', () => {
    const planning = usePlanning()

    planning.currentPlanningStep.value = 2

    planning.reset()

    expect(planning.currentPlanningStep.value).toBe(-1)
  })

  describe('createPlanningCallbacks', () => {
    it('should create callbacks object', () => {
      const planning = usePlanning()
      const updateMessage = vi.fn()
      const getMessage = vi.fn()
      const scrollToBottom = vi.fn()

      const callbacks = planning.createPlanningCallbacks({
        updateMessage,
        getMessage,
        scrollToBottom
      })

      expect(callbacks.onPlanGenerated).toBeDefined()
      expect(callbacks.onStepStart).toBeDefined()
      expect(callbacks.onStepComplete).toBeDefined()
      expect(callbacks.onPlanComplete).toBeDefined()
    })

    it('should handle onPlanGenerated', () => {
      const planning = usePlanning()
      const updateMessage = vi.fn()
      const getMessage = vi.fn()
      const scrollToBottom = vi.fn()

      const callbacks = planning.createPlanningCallbacks({
        updateMessage,
        getMessage,
        scrollToBottom
      })

      const plan = {
        steps: [
          { capability: 'websearch', task: 'Search' },
          { capability: 'code', task: 'Generate' }
        ]
      }

      callbacks.onPlanGenerated(plan)

      expect(planning.currentPlanningStep.value).toBe(-1)
      expect(updateMessage).toHaveBeenCalledWith({
        planning: { plan, stepResults: [] },
        planningComplete: false
      })
      expect(scrollToBottom).toHaveBeenCalled()
    })

    it('should handle onStepStart', () => {
      const planning = usePlanning()
      const scrollToBottom = vi.fn()

      const callbacks = planning.createPlanningCallbacks({
        updateMessage: vi.fn(),
        getMessage: vi.fn(),
        scrollToBottom
      })

      callbacks.onStepStart({ capability: 'code', task: 'Generate' }, 1)

      expect(planning.currentPlanningStep.value).toBe(1)
      expect(scrollToBottom).toHaveBeenCalled()
    })

    it('should handle onStepComplete', () => {
      const planning = usePlanning()
      const scrollToBottom = vi.fn()
      const msg = { planning: { stepResults: [] } }
      const getMessage = vi.fn(() => msg)

      const callbacks = planning.createPlanningCallbacks({
        updateMessage: vi.fn(),
        getMessage,
        scrollToBottom
      })

      const stepResult = { success: true, output: 'result' }
      callbacks.onStepComplete(stepResult, 0)

      expect(msg.planning.stepResults[0]).toEqual(stepResult)
      expect(scrollToBottom).toHaveBeenCalled()
    })

    it('should handle onStepComplete when planning is undefined', () => {
      const planning = usePlanning()
      const scrollToBottom = vi.fn()
      const msg = {}
      const getMessage = vi.fn(() => msg)

      const callbacks = planning.createPlanningCallbacks({
        updateMessage: vi.fn(),
        getMessage,
        scrollToBottom
      })

      // Should not throw
      callbacks.onStepComplete({ success: true }, 0)

      expect(scrollToBottom).toHaveBeenCalled()
    })

    it('should handle onPlanComplete', () => {
      const planning = usePlanning()
      const updateMessage = vi.fn()
      const scrollToBottom = vi.fn()
      const msg = { planning: { stepResults: [] } }
      const getMessage = vi.fn(() => msg)

      planning.currentPlanningStep.value = 2

      const callbacks = planning.createPlanningCallbacks({
        updateMessage,
        getMessage,
        scrollToBottom
      })

      const stepResults = [
        { success: true, output: 'result1' },
        { success: true, output: 'result2' }
      ]

      callbacks.onPlanComplete(stepResults)

      expect(planning.currentPlanningStep.value).toBe(-1)
      expect(msg.planning.stepResults).toEqual(stepResults)
      expect(updateMessage).toHaveBeenCalledWith({ planningComplete: true })
      expect(scrollToBottom).toHaveBeenCalled()
    })
  })
})
