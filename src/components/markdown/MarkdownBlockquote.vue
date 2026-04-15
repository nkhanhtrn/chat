<template>
  <blockquote class="markdown-blockquote">
    <slot></slot>
  </blockquote>
</template>

<style scoped>
.markdown-blockquote { border-left: 4px solid var(--color-primary, #667eea); padding-left: 1em; margin: 1.5em 0; color: var(--color-text-muted); font-style: italic; }
</style>
