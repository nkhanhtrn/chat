/**
 * Pure utility functions for compiling Vue tool components.
 * These functions are designed to be testable in isolation.
 */

import { compile as compileTemplate } from 'vue'

/**
 * Parse a Vue Single File Component (SFC) string into its parts.
 * @param {string} code - The SFC code string
 * @returns {{template: string, script: string, style: string}} - Parsed parts
 */
export function parseToolCode(code) {
  const template = code.match(/<template>([\s\S]*?)<\/template>/)?.[1]?.trim() || ''
  const script = code.match(/<script[^>]*>([\s\S]*?)<\/script>/)?.[1]?.trim() || ''
  const style = code.match(/<style[^>]*>([\s\S]*?)<\/style>/)?.[1]?.trim() || ''
  return { template, script, style }
}

/**
 * Validate Vue template syntax before compilation.
 * @param {string} template - The template string to validate
 * @param {Function} compiler - The Vue compiler function (default: compileTemplate)
 * @returns {true} - Returns true if valid
 * @throws {Error} - Throws error with details if invalid
 */
export function validateTemplate(template, compiler = compileTemplate) {
  if (!template || !template.trim()) {
    throw new Error('Empty template')
  }

  try {
    // Use Vue's compile to check for syntax errors
    const result = compiler(template)
    return true
  } catch (e) {
    // Provide helpful error message with the template line number if available
    let message = `Template syntax error: ${e.message}`
    if (e.loc) {
      message += ` (line ${e.loc.start.line}, column ${e.loc.start.column})`
    }
    throw new Error(message)
  }
}

/**
 * Scope CSS selectors to prevent style leakage between tool instances.
 * @param {string} css - The CSS string to scope
 * @param {string} scopeId - The unique scope ID for this instance
 * @returns {string} - The scoped CSS
 */
export function scopeStyles(css, scopeId) {
  const scopeAttr = `[data-tool-scope="${scopeId}"]`

  // First, preserve @keyframes and @font-face rules that contain nested braces
  const preservedRules = []
  css = css.replace(/(@keyframes[^{]+\{[\s\S]*?\})|(@font-face[^{]+\{[\s\S]*?\})/g, (match) => {
    preservedRules.push(match)
    return `__PRESERVED_RULE_${preservedRules.length - 1}__`
  })

  // Now process the remaining CSS with the simple regex
  const result = css.replace(
    /([^{}@]+)(\{[^{}]*\})/g,
    (match, selectors, block) => {
      // Skip preserved rule placeholders
      if (selectors.includes('__PRESERVED_RULE_')) {
        return match
      }

      // Don't scope @-rules (like @media)
      if (selectors.trim().startsWith('@')) {
        return match
      }

      // Scope each selector
      const scopedSelectors = selectors
        .split(',')
        .map(sel => {
          sel = sel.trim()
          if (!sel) return sel

          // Handle :root, html, body - scope them to our container
          if (sel === ':root' || sel === 'html' || sel === 'body') {
            return scopeAttr
          }

          // Handle * selector
          if (sel === '*') {
            return `${scopeAttr} *`
          }

          // Prefix other selectors
          return `${scopeAttr} ${sel}`
        })
        .join(', ')

      // Add a space before the block for proper formatting
      return scopedSelectors + ' ' + block
    }
  )

  // Restore preserved rules
  return result.replace(/__PRESERVED_RULE_(\d+)__/g, (_, index) => preservedRules[index])
}
