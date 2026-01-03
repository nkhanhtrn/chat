/**
 * Window Renderer Registry
 *
 * Maps window types to their renderer components using a strategy pattern.
 * Adding a new window type:
 * 1. Create renderer component in this directory
 * 2. Import and register here
 * 3. No need to modify OutputWindow.vue
 */

import ChartRenderer from './ChartRenderer.vue'
import MermaidRenderer from './MermaidRenderer.vue'
import SvgRenderer from './SvgRenderer.vue'
import ToolRenderer from './ToolRenderer.vue'
import CodeResultRenderer from './CodeResultRenderer.vue'

/**
 * Renderer registry - maps window type to component
 */
export const WINDOW_RENDERERS = {
  chart: ChartRenderer,
  mermaid: MermaidRenderer,
  svg: SvgRenderer,
  tool: ToolRenderer,
  codeResult: CodeResultRenderer
}

/**
 * Get renderer component for a window type
 * @param {string} type - Window type (chart, mermaid, svg, tool, codeResult)
 * @returns {Component} Renderer component
 */
export function getRenderer(type) {
  return WINDOW_RENDERERS[type] || null
}

/**
 * Check if a window type has a renderer
 * @param {string} type - Window type
 * @returns {boolean}
 */
export function hasRenderer(type) {
  return type in WINDOW_RENDERERS
}

/**
 * Get all registered renderer types
 * @returns {string[]}
 */
export function getRendererTypes() {
  return Object.keys(WINDOW_RENDERERS)
}
