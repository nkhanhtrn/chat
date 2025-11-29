<template>
  <a
    href="#"
    class="question-link"
    :data-child-index="childIndex"
    :data-question-id="questionId"
    :data-md-start="startOffset"
    :data-md-end="endOffset"
    @click.prevent="handleClick"
  >
    <slot>{{ text }}</slot>
  </a>
</template>

<script setup>
const props = defineProps({
  text: {
    type: String,
    default: ''
  },
  childIndex: {
    type: Number,
    required: true
  },
  questionId: {
    type: String,
    required: true
  },
  startOffset: {
    type: Number,
    required: true
  },
  endOffset: {
    type: Number,
    required: true
  }
})

const emit = defineEmits(['click'])

function handleClick() {
  emit('click', props.childIndex)
}
</script>

<style scoped>
.question-link {
  color: var(--color-link-question);
  text-decoration: none;
  border-bottom: 1.5px solid red;
  cursor: pointer;
  font-weight: normal;
  transition: all 0.2s ease;
}

.question-link:hover {
  color: var(--color-link-question-hover);
  border-bottom: 1.5px solid var(--color-link-border-hover);
}
</style>
