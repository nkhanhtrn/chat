<template>
  <div class="table-wrapper">
    <CollapseToggle :is-collapsed="isCollapsed" :label="`Table (${rows.length} rows)`" @toggle="isCollapsed = !isCollapsed">
      <div class="table-container">
        <table class="markdown-table desktop-table">
          <thead v-if="headers.length > 0">
            <tr>
              <th v-for="(header, index) in headers" :key="index" :style="getAlignment(alignments[index])">
                <TableCell :children="header" @highlight-click="$emit('highlight-click', $event)" @note-click="$emit('note-click', $event)" />
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, rowIndex) in rows" :key="rowIndex">
              <td v-for="(cell, cellIndex) in row" :key="cellIndex" :style="getAlignment(alignments[cellIndex])">
                <TableCell :children="cell" @highlight-click="$emit('highlight-click', $event)" @note-click="$emit('note-click', $event)" />
              </td>
            </tr>
          </tbody>
        </table>
        <div class="mobile-cards">
          <div v-for="(row, rowIndex) in rows" :key="rowIndex" class="mobile-card">
            <div v-for="(cell, cellIndex) in row" :key="cellIndex" class="mobile-card-row">
              <div class="mobile-card-label">
                <TableCell v-if="headers[cellIndex]" :children="headers[cellIndex]" @highlight-click="$emit('highlight-click', $event)" @note-click="$emit('note-click', $event)" />
              </div>
              <div class="mobile-card-value">
                <TableCell :children="cell" @highlight-click="$emit('highlight-click', $event)" @note-click="$emit('note-click', $event)" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </CollapseToggle>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ASTNodeType } from '@/services/ASTMarkdownRenderer'
import TableCell from './TableCell.vue'
import CollapseToggle from './CollapseToggle.vue'

const props = defineProps<{
  node: ASTNodeType
}>()

defineEmits<{ 'highlight-click': [event: unknown]; 'note-click': [event: unknown] }>()

const isCollapsed = ref(false)

const headers = computed(() => {
  const headerCells: ASTNodeType[][] = []
  const n = props.node as Record<string, unknown>
  const children = n.children as Record<string, unknown>[] | undefined
  const theadNode = children?.find(child => child.type === 'thead') as Record<string, unknown> | undefined
  if (theadNode) {
    const trNode = (theadNode.children as Record<string, unknown>[] | undefined)?.find(child => child.type === 'tr') as Record<string, unknown> | undefined
    if (trNode) {
      const trChildren = trNode.children as Record<string, unknown>[] | undefined
      trChildren?.forEach(th => {
        if (th.type === 'th') headerCells.push((th.children || []) as ASTNodeType[])
      })
    }
  }
  return headerCells
})

const rows = computed(() => {
  const bodyRows: ASTNodeType[][][] = []
  const n = props.node as Record<string, unknown>
  const children = n.children as Record<string, unknown>[] | undefined
  const tbodyNode = children?.find(child => child.type === 'tbody') as Record<string, unknown> | undefined
  if (tbodyNode) {
    const trNodes = tbodyNode.children as Record<string, unknown>[] | undefined
    trNodes?.forEach(tr => {
      if (tr.type === 'tr') {
        const row: ASTNodeType[][] = []
        const cells = tr.children as Record<string, unknown>[] | undefined
        cells?.forEach(td => {
          if (td.type === 'td') row.push((td.children || []) as ASTNodeType[])
        })
        bodyRows.push(row)
      }
    })
  }
  return bodyRows
})

const alignments = computed(() => {
  const aligns: string[] = []
  const n = props.node as Record<string, unknown>
  const children = n.children as Record<string, unknown>[] | undefined
  const theadNode = children?.find(child => child.type === 'thead') as Record<string, unknown> | undefined
  if (theadNode) {
    const trNode = (theadNode.children as Record<string, unknown>[] | undefined)?.find(child => child.type === 'tr') as Record<string, unknown> | undefined
    if (trNode) {
      const trChildren = trNode.children as Record<string, unknown>[] | undefined
      trChildren?.forEach(th => {
        if (th.type === 'th') aligns.push(extractAlignment(th.align as string | undefined))
      })
    }
  }
  return aligns
})

function extractAlignment(style: string | undefined): string {
  if (!style) return 'left'
  if (style.includes('text-align:center')) return 'center'
  if (style.includes('text-align:right')) return 'right'
  return 'left'
}

function getAlignment(align: string): Record<string, string> {
  return { textAlign: align || 'left' }
}
</script>

<style scoped>
.table-wrapper { overflow-x: auto; margin: 12px 0; }
.markdown-table { border-collapse: collapse; width: 100%; background-color: var(--color-table-bg); border-radius: 6px; overflow: hidden; }
.markdown-table th, .markdown-table td { padding: 10px 12px; border: 1px solid var(--color-table-border); }
.markdown-table th { background-color: var(--color-table-header-bg); font-weight: 600; color: var(--color-code-block-header-text); }
.markdown-table td { color: var(--color-code-block-text); }
.markdown-table tr:hover { background-color: var(--color-table-hover-bg); }
.mobile-cards { display: none; flex-direction: column; gap: 12px; width: 100%; }
.mobile-card { background-color: var(--color-table-bg); border: 1px solid var(--color-table-border); border-radius: 8px; overflow: hidden; }
.mobile-card-row { display: flex; border-bottom: 1px solid var(--color-table-border); }
.mobile-card-row:last-child { border-bottom: none; }
.mobile-card-label { flex: 0 0 40%; padding: 8px 10px; background-color: var(--color-table-header-bg); font-weight: 600; font-size: 13px; color: var(--color-code-block-header-text); word-break: break-word; }
.mobile-card-value { flex: 1; padding: 8px 10px; color: var(--color-code-block-text); word-break: break-word; }
@media (max-width: 768px) { .desktop-table { display: none; } .mobile-cards { display: flex; } }
</style>
