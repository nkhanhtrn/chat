import { compile as compileTemplate } from 'vue'

export interface ParsedSFC {
  template: string
  script: string
  style: string
}

export function parseToolCode(code: string): ParsedSFC {
  const template = code.match(/<template>([\s\S]*?)<\/template>/)?.[1]?.trim() || ''
  const script = code.match(/<script[^>]*>([\s\S]*?)<\/script>/)?.[1]?.trim() || ''
  const style = code.match(/<style[^>]*>([\s\S]*?)<\/style>/)?.[1]?.trim() || ''
  return { template, script, style }
}

export function validateTemplate(template: string, compiler: typeof compileTemplate = compileTemplate): true {
  if (!template || !template.trim()) {
    throw new Error('Empty template')
  }
  try {
    compiler(template)
    return true
  } catch (e: any) {
    let message = `Template syntax error: ${e.message}`
    if (e.loc) {
      message += ` (line ${e.loc.start.line}, column ${e.loc.start.column})`
    }
    throw new Error(message)
  }
}

export function scopeStyles(css: string, scopeId: string): string {
  const scopeAttr = `[data-tool-scope="${scopeId}"]`

  const preservedRules: string[] = []
  let processed = css.replace(/(@keyframes[^{]+\{[\s\S]*?\})|(@font-face[^{]+\{[\s\S]*?\})/g, (match) => {
    preservedRules.push(match)
    return `__PRESERVED_RULE_${preservedRules.length - 1}__`
  })

  const result = processed.replace(
    /([^{}@]+)(\{[^{}]*\})/g,
    (match, selectors: string, block: string) => {
      if (selectors.includes('__PRESERVED_RULE_')) {
        return match
      }

      if (selectors.trim().startsWith('@')) {
        return match
      }

      const scopedSelectors = selectors
        .split(',')
        .map((sel: string) => {
          sel = sel.trim()
          if (!sel) return sel
          if (sel === ':root' || sel === 'html' || sel === 'body') {
            return scopeAttr
          }
          if (sel === '*') {
            return `${scopeAttr} *`
          }
          return `${scopeAttr} ${sel}`
        })
        .join(', ')

      return scopedSelectors + ' ' + block
    }
  )

  return result.replace(/__PRESERVED_RULE_(\d+)__/g, (_, index: number) => preservedRules[index])
}
