<template>
  <a ref="link" :href="href" :download="filename" style="display: none"></a>
</template>
<script setup>
import { ref, defineExpose } from 'vue'
const props = defineProps({
  href: String,
  filename: String
})
const link = ref(null)
function triggerDownload() {
  if (link.value) link.value.click()
}
defineExpose({ triggerDownload })
</script>
