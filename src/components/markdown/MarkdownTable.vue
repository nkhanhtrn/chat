<template>
  <div class="table-wrapper">
    <CollapseToggle
      :is-collapsed="isCollapsed"
      :label="`Table (${rows.length} rows)`"
      @toggle="toggleCollapse"
    >
      <div class="table-container">
        <!-- Desktop: Traditional table -->
        <table class="markdown-table desktop-table">
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
        <!-- Mobile: Card layout -->
        <div class="mobile-cards">
          <div v-for="(row, rowIndex) in rows" :key="rowIndex" class="mobile-card">
            <div v-for="(cell, cellIndex) in row" :key="cellIndex" class="mobile-card-row">
              <div class="mobile-card-label">
                <TableCell v-if="headers[cellIndex]" :children="headers[cellIndex]" @question-link-click="bubbleQuestionLinkClick" @highlight-click="bubbleHighlightClick" />
              </div>
              <div class="mobile-card-value">
                <TableCell :children="cell" @question-link-click="bubbleQuestionLinkClick" @highlight-click="bubbleHighlightClick" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </CollapseToggle>
  </div>
</template>

<script>
import { computed, ref } from 'vue'
import TableCell from './TableCell.vue'
import CollapseToggle from './CollapseToggle.vue'

export default {
  name: 'MarkdownTable',
  components: {
    TableCell,
    CollapseToggle
  },
  props: {
    node: {
      type: Object,
      required: true
    }
  },
  emits: ['question-link-click', 'highlight-click'],
  setup(props) {
    const isCollapsed = ref(false)

    function toggleCollapse() {
      isCollapsed.value = !isCollapsed.value
    }
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
      alignments,
      isCollapsed,
      toggleCollapse
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

/* Mobile card layout - hidden by default */
.mobile-cards {
  display: none;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.mobile-card {
  background-color: var(--color-table-bg);
  border: 1px solid var(--color-table-border);
  border-radius: 8px;
  overflow: hidden;
}

.mobile-card-row {
  display: flex;
  border-bottom: 1px solid var(--color-table-border);
}

.mobile-card-row:last-child {
  border-bottom: none;
}

.mobile-card-label {
  flex: 0 0 40%;
  padding: 8px 10px;
  background-color: var(--color-table-header-bg);
  font-weight: 600;
  font-size: 13px;
  color: var(--color-code-block-header-text);
  word-break: break-word;
}

.mobile-card-value {
  flex: 1;
  padding: 8px 10px;
  color: var(--color-code-block-text);
  word-break: break-word;
}

/* Mobile breakpoint: switch to card layout */
@media (max-width: 768px) {
  .desktop-table {
    display: none;
  }

  .mobile-cards {
    display: flex;
  }
}
</style>
