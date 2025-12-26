<template>
  <div class="chart-container">
    <div ref="chartRef" class="chart"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  option: {
    type: Object,
    required: true
  },
  height: {
    type: String,
    default: '300px'
  }
})

const chartRef = ref(null)
let chartInstance = null
const isDark = ref(false)

// Detect dark mode
function detectDarkMode() {
  isDark.value = document.documentElement.classList.contains('dark') ||
                 window.matchMedia('(prefers-color-scheme: dark)').matches
}

// Theme-aware colors
const themeColors = computed(() => {
  if (isDark.value) {
    return {
      textColor: '#e5e7eb',
      textColorSecondary: '#9ca3af',
      backgroundColor: 'transparent',
      borderColor: '#374151',
      axisLineColor: '#4b5563',
      splitLineColor: '#374151'
    }
  }
  return {
    textColor: '#374151',
    textColorSecondary: '#6b7280',
    backgroundColor: 'transparent',
    borderColor: '#e5e7eb',
    axisLineColor: '#9ca3af',
    splitLineColor: '#e5e7eb'
  }
})

// Merge user options with theme defaults
function getThemedOption(userOption) {
  const colors = themeColors.value

  // Deep merge with theme defaults
  return {
    backgroundColor: colors.backgroundColor,
    textStyle: {
      color: colors.textColor,
      ...userOption.textStyle
    },
    title: {
      textStyle: {
        color: colors.textColor
      },
      subtextStyle: {
        color: colors.textColorSecondary
      },
      ...userOption.title
    },
    legend: {
      textStyle: {
        color: colors.textColor
      },
      ...userOption.legend
    },
    tooltip: {
      backgroundColor: isDark.value ? '#1f2937' : '#ffffff',
      borderColor: colors.borderColor,
      textStyle: {
        color: colors.textColor
      },
      ...userOption.tooltip
    },
    xAxis: Array.isArray(userOption.xAxis)
      ? userOption.xAxis.map(axis => ({
          axisLine: { lineStyle: { color: colors.axisLineColor } },
          axisLabel: { color: colors.textColor },
          splitLine: { lineStyle: { color: colors.splitLineColor } },
          ...axis
        }))
      : userOption.xAxis ? {
          axisLine: { lineStyle: { color: colors.axisLineColor } },
          axisLabel: { color: colors.textColor },
          splitLine: { lineStyle: { color: colors.splitLineColor } },
          ...userOption.xAxis
        } : undefined,
    yAxis: Array.isArray(userOption.yAxis)
      ? userOption.yAxis.map(axis => ({
          axisLine: { lineStyle: { color: colors.axisLineColor } },
          axisLabel: { color: colors.textColor },
          splitLine: { lineStyle: { color: colors.splitLineColor } },
          ...axis
        }))
      : userOption.yAxis ? {
          axisLine: { lineStyle: { color: colors.axisLineColor } },
          axisLabel: { color: colors.textColor },
          splitLine: { lineStyle: { color: colors.splitLineColor } },
          ...userOption.yAxis
        } : undefined,
    series: userOption.series?.map(s => ({
      label: {
        color: colors.textColor,
        ...s.label
      },
      ...s
    })),
    ...userOption
  }
}

// Initialize chart
function initChart() {
  if (!chartRef.value) return

  // Dispose existing instance
  if (chartInstance) {
    chartInstance.dispose()
  }

  // Detect theme before creating chart
  detectDarkMode()

  // Create new instance with theme
  chartInstance = echarts.init(chartRef.value, isDark.value ? 'dark' : null)
  chartInstance.setOption(getThemedOption(props.option))
}

// Handle resize
function handleResize() {
  if (chartInstance) {
    chartInstance.resize()
  }
}

// Handle theme changes
function handleThemeChange() {
  const wasDark = isDark.value
  detectDarkMode()
  if (wasDark !== isDark.value) {
    // Reinitialize chart with new theme
    initChart()
  }
}

// Watch for option changes
watch(() => props.option, (newOption) => {
  if (chartInstance && newOption) {
    chartInstance.setOption(getThemedOption(newOption), true)
  }
}, { deep: true })

// Watch for theme changes
let themeObserver = null

onMounted(() => {
  initChart()
  window.addEventListener('resize', handleResize)

  // Watch for theme changes on document
  themeObserver = new MutationObserver(handleThemeChange)
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  })

  // Also watch for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', handleThemeChange)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', handleThemeChange)

  if (themeObserver) {
    themeObserver.disconnect()
  }

  if (chartInstance) {
    chartInstance.dispose()
    chartInstance = null
  }
})
</script>

<style scoped>
.chart-container {
  width: 100%;
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-border-base);
  border-radius: 8px;
  padding: 1rem;
}

.chart {
  width: 100%;
  height: v-bind(height);
}
</style>
