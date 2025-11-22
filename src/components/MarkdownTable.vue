<template>
  <div class="table-wrapper">
    <table class="markdown-table">
      <thead v-if="headers.length > 0">
        <tr>
          <th v-for="(header, index) in headers" :key="index" :style="getAlignment(alignments[index])">
            <TableCell :content="header" />
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, rowIndex) in rows" :key="rowIndex">
          <td v-for="(cell, cellIndex) in row" :key="cellIndex" :style="getAlignment(alignments[cellIndex])">
            <TableCell :content="cell" />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
import TableCell from './TableCell.vue'

export default {
  name: 'MarkdownTable',
  components: {
    TableCell
  },
  props: {
    headers: {
      type: Array,
      required: true
    },
    rows: {
      type: Array,
      required: true
    },
    alignments: {
      type: Array,
      default: () => []
    }
  },
  methods: {
    getAlignment(align) {
      if (align === 'left') return { textAlign: 'left' }
      if (align === 'right') return { textAlign: 'right' }
      if (align === 'center') return { textAlign: 'center' }
      return { textAlign: 'left' }
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
  background-color: #2a2b32;
  border-radius: 6px;
  overflow: hidden;
}

.markdown-table th,
.markdown-table td {
  padding: 10px 12px;
  border: 1px solid #565869;
}

.markdown-table th {
  background-color: #40414f;
  font-weight: 600;
  color: #ececf1;
}

.markdown-table td {
  color: #d1d5db;
}

.markdown-table tr:hover {
  background-color: #353640;
}
</style>
