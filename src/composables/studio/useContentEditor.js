/**
 * useContentEditor - LLM-based content editing for windows
 *
 * Handles editing existing window content using LLM capabilities.
 *
 */
import lmService, { Category } from '../../services/llm/LMService.js'
import BuildCapability from '../../services/llm/capabilities/BuildCapability.js'
import { VisualizationCapability } from '../../services/llm/capabilities/VisualizationCapability.js'
import { CodeCapability } from '../../services/llm/capabilities/CodeCapability.js'

export function useContentEditor() {
  /**
   * Edit existing window content using LLM
   *
   * @param {Object} options - Edit options
   * @param {string} options.windowType - Type of window ('tool', 'chart', 'mermaid', 'svg', 'codeResult')
   * @param {*} options.currentContent - Current content to edit
   * @param {string} options.prompt - Edit prompt/instruction
   * @param {boolean} options.useThinkingMode - Whether to use reasoning model
   * @param {Function} options.onComplete - Callback when editing completes
   * @param {Function} options.onStdoutChunk - Callback for stdout chunks during build
   * @returns {Promise<*>} Edited content
   */
  async function editContent(options) {
    const { windowType, currentContent, prompt, useThinkingMode = false, onComplete, onStdoutChunk } = options

    const localAbortController = new AbortController()

    try {
      const providerCategory = useThinkingMode ? Category.REASONING : Category.QUICK
      const provider = lmService.getProviderByCategory(providerCategory)

      let result

      switch (windowType) {
        case 'tool': {
          const buildCapability = new BuildCapability()
          const codeOrSpec = currentContent.type === 'vue-sfc' ? currentContent.code : currentContent

          let accumulatedStdout = ''

          const wrappedStdoutCallback = (chunk) => {
            accumulatedStdout += chunk
            if (onStdoutChunk) {
              onStdoutChunk(chunk)
            }
          }

          const toolResult = await buildCapability.editTool(
            codeOrSpec,
            prompt,
            provider,
            localAbortController.signal,
            useThinkingMode,
            wrappedStdoutCallback
          )

          result = {
            ...toolResult,
            stdout: toolResult.stdout || accumulatedStdout
          }
          break
        }

        case 'chart':
        case 'mermaid':
        case 'svg': {
          const vizCapability = new VisualizationCapability()
          const contentStr = typeof currentContent === 'string'
            ? currentContent
            : JSON.stringify(currentContent, null, 2)
          const vizResult = await vizCapability.editVisualization(
            contentStr,
            windowType,
            prompt,
            provider,
            localAbortController.signal
          )
          if (windowType === 'chart' && typeof currentContent !== 'string') {
            try {
              result = JSON.parse(vizResult.content)
            } catch {
              result = vizResult.content
            }
          } else {
            result = vizResult.content
          }
          break
        }

        case 'codeResult': {
          const codeCapability = new CodeCapability()

          let accumulatedStdout = ''

          const wrappedStdoutCallback = (chunk) => {
            accumulatedStdout += chunk
            if (onStdoutChunk) {
              onStdoutChunk(chunk)
            }
          }

          const codeResult = await codeCapability.editCode(
            currentContent.code || '',
            prompt,
            provider,
            localAbortController.signal,
            useThinkingMode,
            wrappedStdoutCallback
          )
          result = {
            code: codeResult.code,
            result: codeResult.result,
            stdout: accumulatedStdout
          }
          break
        }

        default:
          throw new Error(`Unknown window type: ${windowType}`)
      }

      if (onComplete) {
        onComplete(result)
      }

      return result
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Content edit failed:', error)
        throw error
      }
    }
  }

  return {
    editContent
  }
}
