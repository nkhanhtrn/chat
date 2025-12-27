/**
 * Utility functions for analyzing and extracting display data from chat messages
 */

/**
 * Get capability type from message analysis
 * @param {Object} msg - The message object
 * @returns {string} Capability type: 'text' | 'planning' | 'websearch' | 'visualization' | 'build' | 'code'
 */
export function getCapabilityType(msg) {
  if (!msg.analysis) return 'text'
  if (msg.analysis.capability === 'planning' || msg.planning) return 'planning'
  if (msg.analysis.needsWebSearch || msg.analysis.capability === 'websearch') return 'websearch'
  if (msg.analysis.isVisualization || msg.analysis.capability === 'visualization') return 'visualization'
  if (msg.analysis.capability === 'build') return 'build'
  if (msg.analysis.capability === 'code') return 'code'
  return 'text'
}

/**
 * Get message status for display
 * @param {Object} msg - The message object
 * @param {boolean} isLastMessage - Whether this is the last message
 * @param {boolean} isStreaming - Whether content is currently streaming
 * @returns {string} Status: 'running' | 'complete' | 'failed'
 */
export function getMessageStatus(msg, isLastMessage, isStreaming) {
  if (isLastMessage && isStreaming) return 'running'
  if (msg.execution?.success === false) return 'failed'
  if (msg.content || msg.visualization || msg.tool || msg.planningComplete) return 'complete'
  if (isLastMessage) return 'running'
  return 'complete'
}

/**
 * Get web sources for display
 * @param {Object} msg - The message object
 * @param {boolean} isLastMessage - Whether this is the last message
 * @param {boolean} isSearching - Whether a search is in progress
 * @returns {Array} Array of source objects with title, url, status, fetchStatus
 */
export function getWebSources(msg, isLastMessage, isSearching) {
  const sources = []

  // Show pending sources being fetched
  if (msg.webSearchPending) {
    for (const pending of msg.webSearchPending) {
      const fetched = msg.webSearchResults?.find(r => r?.url === pending.url)
      sources.push({
        title: pending.title || pending.url,
        url: pending.url,
        status: fetched ? (fetched.success ? 'success' : 'error') : 'loading',
        fetchStatus: fetched ? (fetched.success ? 'fetched' : 'snippet') : null
      })
    }
  }
  // Or show completed results
  else if (msg.webSearchResults) {
    for (const result of msg.webSearchResults) {
      if (result) {
        sources.push({
          title: result.title || result.url,
          url: result.url,
          status: result.success ? 'success' : 'error',
          fetchStatus: result.success ? 'fetched' : 'snippet'
        })
      }
    }
  }
  // Show loading placeholders for current search
  else if (isLastMessage && isSearching && msg.webSearchTotal) {
    for (let i = 0; i < msg.webSearchTotal; i++) {
      sources.push({ title: 'Loading...', status: 'loading', url: null, fetchStatus: null })
    }
  }

  return sources
}

/**
 * Get plan steps for display
 * @param {Object} msg - The message object
 * @param {number} currentPlanningStep - Current step index (-1 if not started)
 * @returns {Array} Array of step objects with capability, task, status
 */
export function getPlanSteps(msg, currentPlanningStep) {
  if (!msg.planning?.plan?.steps) return []

  return msg.planning.plan.steps.map((step, idx) => {
    let status = 'pending'
    const result = msg.planning.stepResults?.[idx]

    if (result) {
      status = result.success ? 'complete' : 'failed'
    } else if (idx === currentPlanningStep) {
      status = 'running'
    } else if (idx < currentPlanningStep) {
      status = 'complete'
    }

    return {
      capability: step.capability,
      task: step.task,
      status
    }
  })
}

/**
 * Get raw output for display (execution result, visualization config, tool spec, etc.)
 * @param {Object} msg - The message object
 * @returns {*} Raw output data or null
 */
export function getRawOutput(msg) {
  // Code execution result
  if (msg.execution) {
    return msg.execution.success ? msg.execution.result : msg.execution.error
  }
  // Visualization config
  if (msg.visualization) {
    return msg.visualization.content
  }
  // Tool spec
  if (msg.tool) {
    return msg.tool
  }
  // Planning results
  if (msg.planning?.stepResults) {
    return msg.planning.stepResults
  }
  return null
}
