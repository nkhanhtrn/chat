<template>
  <div class="markdown-renderer" v-html="renderedContent"></div>
</template>

<script setup>
import { computed } from 'vue'
import { marked } from 'marked'
import { processMarkdown } from '../services/markdownUtils.js'

const props = defineProps({
  content: {
    type: String,
    default: ''
  }
})

const renderedContent = computed(() => {
  return processMarkdown(props.content, marked)
})
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
