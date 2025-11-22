<template>
  <div>
    <template v-for="(element, index) in parsedContent" :key="index">
      <CodeBlock 
        v-if="element.type === 'codeblock'"
        :language="element.language"
        :code="element.code"
      />
      <FormattedText
        v-else-if="element.type === 'header'"
        :content="element.content"
        type="header"
        :level="element.level"
      />
      <FormattedText
        v-else-if="element.type === 'text'"
        :content="element.content"
        type="text"
      />
      <br v-else-if="element.type === 'linebreak'" />
    </template>
  </div>
</template>

<script>
import { computed } from 'vue'
import { useMessageParser } from '../composables/useMessageParser.js'
import CodeBlock from './CodeBlock.vue'
import FormattedText from './FormattedText.vue'

export default {
  name: 'MessageContent',
  components: {
    CodeBlock,
    FormattedText
  },
  props: {
    content: {
      type: String,
      default: ''
    }
  },
  setup(props) {
    const { parseMessage } = useMessageParser()
    
    const parsedContent = computed(() => {
      return parseMessage(props.content)
    })
    
    return {
      parsedContent
    }
  }
}
</script>
