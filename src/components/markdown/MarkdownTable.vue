<template>
  <div class="table-wrapper">
    <table class="markdown-table">
      <thead v-if="headers.length > 0">
        <tr>
          <th v-for="(header, index) in headers" :key="index" :style="getAlignment(alignments[index])">
            <TableCell :children="header" @question-link-click="bubbleQuestionLinkClick" @highlight-click="bubbleHighlightClick" />
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, rowIndex) in rows" :key="rowIndex">
          <td v-for="(cell, cellIndex) in row" :key="cellIndex" :style="getAlignment(alignments[cellIndex])">
            <TableCell :children="cell" @question-link-click="bubbleQuestionLinkClick" @highlight-click="bubbleHighlightClick" />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
import { computed } from 'vue'
import TableCell from './TableCell.vue'

export default {
  name: 'MarkdownTable',
  components: {
    TableCell
  },
  props: {
    node: {
      type: Object,
      required: true
    }
  },
  emits: ['question-link-click', 'highlight-click'],
  setup(props) {
    const headers = computed(() => {
      const headerCells = []
      const theadNode = props.node.children?.find(child => child.type === 'thead')

      if (theadNode) {
        const trNode = theadNode.children?.find(child => child.type === 'tr')
        if (trNode) {
          trNode.children?.forEach(th => {
            if (th.type === 'th') {
              // Pass the children array (AST nodes) instead of text
              headerCells.push(th.children || [])
            }
          })
        }
      }

      return headerCells
    })

    const rows = computed(() => {
      const bodyRows = []
      const tbodyNode = props.node.children?.find(child => child.type === 'tbody')

      if (tbodyNode) {
        tbodyNode.children?.forEach(tr => {
          if (tr.type === 'tr') {
            const row = []
            tr.children?.forEach(td => {
              if (td.type === 'td') {
                // Pass the children array (AST nodes) instead of text
                row.push(td.children || [])
              }
            })
            bodyRows.push(row)
          }
        })
      }

      return bodyRows
    })

    const alignments = computed(() => {
      const aligns = []
      const theadNode = props.node.children?.find(child => child.type === 'thead')

      if (theadNode) {
        const trNode = theadNode.children?.find(child => child.type === 'tr')
        if (trNode) {
          trNode.children?.forEach(th => {
            if (th.type === 'th') {
              aligns.push(extractAlignment(th.align))
            }
          })
        }
      }

      return aligns
    })

    function extractAlignment(style) {
      if (!style) return 'left'
      if (style.includes('text-align:center')) return 'center'
      if (style.includes('text-align:right')) return 'right'
      return 'left'
    }

    return {
      headers,
      rows,
      alignments
    }
  },
  methods: {
    getAlignment(align) {
      if (align === 'left') return { textAlign: 'left' }
      if (align === 'right') return { textAlign: 'right' }
      if (align === 'center') return { textAlign: 'center' }
      return { textAlign: 'left' }
    },
    bubbleQuestionLinkClick(childIndex) {
      this.$emit('question-link-click', childIndex)
    },
    bubbleHighlightClick(data) {
      this.$emit('highlight-click', data)
    }
  }
}
</script>

<style scoped>
.table-wrapper {
  overflow-x: auto;
  margin: 12px 0;
}

.markdown-table {
  border-collapse: collapse;
  width: 100%;
  background-color: var(--color-table-bg);
  border-radius: 6px;
  overflow: hidden;
}

.markdown-table th,
.markdown-table td {
  padding: 10px 12px;
  border: 1px solid var(--color-table-border);
}

.markdown-table th {
  background-color: var(--color-table-header-bg);
  font-weight: 600;
  color: var(--color-code-block-header-text);
}

.markdown-table td {
  color: var(--color-code-block-text);
}

.markdown-table tr:hover {
  background-color: var(--color-table-hover-bg);
}
</style>
