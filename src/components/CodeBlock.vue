<template>
  <div class="code-block">
    <div class="code-header">{{ language }}</div>
    <pre><code>{{ code }}</code></pre>
  </div>
</template>

<script>
export default {
  name: 'CodeBlock',
  props: {
    language: {
      type: String,
      default: 'plaintext'
    },
    code: {
      type: String,
      required: true
    }
  }
}
</script>
