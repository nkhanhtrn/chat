<template>
  <div>
    <template v-for="(element, index) in parsedContent" :key="index">
      <CodeBlock 
        v-if="element.type === 'codeblock'"
        :language="element.language"
        :code="element.code"
      />
      <MarkdownTable
        v-else-if="element.type === 'table'"
        :headers="element.headers"
        :rows="element.rows"
        :alignments="element.alignments"
      />
      <FormattedText
        v-else-if="element.type === 'header'"
        :content="element.content"
        type="header"
        :level="element.level"
      />
      <div 
        v-else-if="element.type === 'blockquote'"
        class="markdown-blockquote"
      >
        <FormattedText
          :content="element.content"
          type="text"
        />
      </div>
      <FormattedText
        v-else-if="element.type === 'text'"
        :content="element.content"
        type="text"
      />
      <hr v-else-if="element.type === 'hr'" class="markdown-hr" />
      <br v-else-if="element.type === 'linebreak'" />
    </template>
  </div>
</template>

<script>
import { computed } from 'vue'
import { useMessageParser } from '../composables/useMessageParser.js'
import CodeBlock from './CodeBlock.vue'
import MarkdownTable from './MarkdownTable.vue'
import FormattedText from './FormattedText.vue'

export default {
  name: 'MessageContent',
  components: {
    CodeBlock,
    MarkdownTable,
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
