import { ref } from 'vue'

/**
 * Composable for managing planning state in StudioChat
 */
export function usePlanning() {
  // Planning state
  const currentPlanningStep = ref(-1) // -1 = not started, 0+ = current step index

  /**
   * Create callbacks for planning events
   * @param {Object} options - Options with message update callback
   * @param {Function} options.updateMessage - Function to update current message
   * @param {Function} options.getMessage - Function to get current message
   * @param {Function} options.scrollToBottom - Function to scroll chat to bottom
   * @returns {Object} Callbacks object for taskRouter
   */
  function createPlanningCallbacks({ updateMessage, getMessage, scrollToBottom }) {
    return {
      onPlanGenerated: (plan) => {
        updateMessage({
          planning: { plan, stepResults: [] },
          planningComplete: false
        })
        currentPlanningStep.value = -1
        scrollToBottom()
      },

      onStepStart: (step, index) => {
        currentPlanningStep.value = index
        scrollToBottom()
      },

      onStepComplete: (stepResult, index) => {
        const msg = getMessage()
        if (msg.planning) {
          msg.planning.stepResults[index] = stepResult
        }
        scrollToBottom()
      },

      onPlanComplete: (stepResults) => {
        const msg = getMessage()
        if (msg.planning) {
          msg.planning.stepResults = stepResults
        }
        updateMessage({ planningComplete: true })
        currentPlanningStep.value = -1
        scrollToBottom()
      }
    }
  }

  /**
   * Reset planning state
   */
  function reset() {
    currentPlanningStep.value = -1
  }

  return {
    // State
    currentPlanningStep,

    // Actions
    createPlanningCallbacks,
    reset
  }
}
