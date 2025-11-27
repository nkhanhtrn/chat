<template>
  <div class="markdown-renderer" v-html="renderedContent"></div>
</template>

<script setup>
import { computed } from 'vue'
import { marked } from 'marked'
import CodeBlock from './CodeBlock.vue'
import InlineCode from './InlineCode.vue'
import MathBlock from './MathBlock.vue'
import MathInline from './MathInline.vue'
import MarkdownTable from './MarkdownTable.vue'

const props = defineProps({
  content: {
    type: String,
    default: ''
  }
})

const renderedContent = computed(() => {
  if (!props.content) return ''

  let processed = props.content

  const codeBlocks = []
  const mathBlocks = []
  const inlineMath = []
  const inlineCode = []

  processed = processed.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
    const id = `CODE_BLOCK_${codeBlocks.length}`
    codeBlocks.push({ id, lang: lang || 'text', code: code.trim() })
    return `\n${id}\n`
  })

  processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (match, math) => {
    const id = `MATH_BLOCK_${mathBlocks.length}`
    mathBlocks.push({ id, math: math.trim() })
    return `\n${id}\n`
  })

  processed = processed.replace(/\$([^\$\n]+?)\$/g, (match, math) => {
    const id = `MATH_INLINE_${inlineMath.length}`
    inlineMath.push({ id, math: math.trim() })
    return id
  })

  processed = processed.replace(/`([^`]+?)`/g, (match, code) => {
    const id = `CODE_INLINE_${inlineCode.length}`
    inlineCode.push({ id, code })
    return id
  })

  let html = marked(processed)

  codeBlocks.forEach(({ id, lang, code }) => {
    html = html.replace(id, `<div class="code-block-wrapper"><pre><code class="language-${lang}">${escapeHtml(code)}</code></pre></div>`)
  })

  mathBlocks.forEach(({ id, math }) => {
    html = html.replace(id, `<div class="math-block-wrapper">${renderMath(math, true)}</div>`)
  })

  inlineMath.forEach(({ id, math }) => {
    html = html.replace(id, `<span class="math-inline-wrapper">${renderMath(math, false)}</span>`)
  })

  inlineCode.forEach(({ id, code }) => {
    html = html.replace(id, `<code class="inline-code">${escapeHtml(code)}</code>`)
  })

  return html
})

const escapeHtml = (text) => {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

const renderMath = (math, isBlock) => {
  try {
    if (typeof window !== 'undefined' && window.katex) {
      return window.katex.renderToString(math, {
        displayMode: isBlock,
        throwOnError: false
      })
    }
  } catch (e) {
    console.error('KaTeX rendering error:', e)
  }
  return escapeHtml(math)
}
</script>

<style>
.markdown-renderer {
  font-size: 1rem;
  line-height: 1.7;
}

.markdown-renderer h1,
.markdown-renderer h2,
.markdown-renderer h3,
.markdown-renderer h4,
.markdown-renderer h5,
.markdown-renderer h6 {
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  font-weight: 600;
  color: #2d3748;
}

.markdown-renderer h1 {
  font-size: 1.8em;
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 0.3em;
}

.markdown-renderer h2 {
  font-size: 1.5em;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 0.3em;
}

.markdown-renderer h3 {
  font-size: 1.3em;
}

.markdown-renderer p {
  margin-bottom: 1em;
}

.markdown-renderer ul,
.markdown-renderer ol {
  margin-bottom: 1em;
  padding-left: 2em;
}

.markdown-renderer li {
  margin-bottom: 0.5em;
}

.markdown-renderer a {
  color: #667eea;
  text-decoration: none;
}

.markdown-renderer a:hover {
  text-decoration: underline;
}

.markdown-renderer blockquote {
  border-left: 4px solid #667eea;
  padding-left: 1em;
  margin-left: 0;
  color: #4a5568;
  font-style: italic;
}

.markdown-renderer .inline-code {
  background-color: #f7fafc;
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.9em;
  color: #d63384;
  border: 1px solid #e2e8f0;
}

.markdown-renderer .code-block-wrapper {
  margin: 1em 0;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.markdown-renderer .code-block-wrapper pre {
  margin: 0;
  padding: 1em;
  background-color: #2d3748;
  overflow-x: auto;
}

.markdown-renderer .code-block-wrapper code {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.9em;
  color: #e2e8f0;
  line-height: 1.5;
}

.markdown-renderer .math-block-wrapper {
  margin: 1.5em 0;
  padding: 1em;
  background-color: #f7fafc;
  border-radius: 8px;
  overflow-x: auto;
  text-align: center;
}

.markdown-renderer .math-inline-wrapper {
  display: inline;
}

.markdown-renderer table {
  border-collapse: collapse;
  width: 100%;
  margin: 1em 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.markdown-renderer th,
.markdown-renderer td {
  border: 1px solid #e2e8f0;
  padding: 0.75em;
  text-align: left;
}

.markdown-renderer th {
  background-color: #f7fafc;
  font-weight: 600;
  color: #2d3748;
}

.markdown-renderer tr:nth-child(even) {
  background-color: #f7fafc;
}

.markdown-renderer hr {
  border: none;
  border-top: 2px solid #e2e8f0;
  margin: 2em 0;
}
</style>
