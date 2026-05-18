<template>
  <AppLayout storage-key="sidebar">
    <template #side><div class="side-playground-wrapper"><SideChatPlayground /></div></template>
    <div class="calendar-page">
      <div class="calendar-header">
        <h1>Activity Calendar</h1>
        <div class="month-nav">
          <button class="nav-btn" @click="previousMonth">&larr;</button>
          <div class="month-label-wrapper">
            <button class="month-label" @click="toggleDatePicker">{{ monthYearLabel }}</button>
            <div v-if="showDatePicker" class="date-picker-dropdown">
              <button class="today-btn" @click="goToCurrentMonth">Today</button>
              <div class="picker-row">
                <select v-model="selectedMonth" class="picker-select">
                  <option v-for="(m, i) in months" :key="i" :value="i">{{ m }}</option>
                </select>
                <select v-model="selectedYear" class="picker-select">
                  <option v-for="y in availableYears" :key="y" :value="y">{{ y }}</option>
                </select>
              </div>
              <button class="go-btn" @click="applyDateSelection">Go</button>
            </div>
          </div>
          <button class="nav-btn" @click="nextMonth">&rarr;</button>
        </div>
      </div>
      <div class="calendar-grid">
        <div v-for="day in weekdays" :key="day" class="weekday-header">{{ day }}</div>
        <div
          v-for="(day, idx) in calendarDays"
          :key="idx"
          class="calendar-day"
          :class="{ 'other-month': !day.currentMonth, 'today': day.isToday, 'has-questions': day.questionCount > 0, 'clickable': true }"
          @click="openDayModal(day)"
        >
          <span class="day-number">{{ day.day || '' }}</span>
          <span v-if="day.questionCount > 0" class="question-badge">{{ day.questionCount }}</span>
        </div>
      </div>
      <CalendarDayModal
        :visible="showDayModal"
        :date="selectedDate"
        :questions="selectedDayQuestions"
        @close="showDayModal = false"
        @open-question="handleOpenQuestion"
      />
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'
import SideChatPlayground from '@/components/SideChatPlayground.vue'
import CalendarDayModal from '@/components/modal/CalendarDayModal.vue'
import { useNotebookStore } from '@/stores/notebook'
import { useMessageTreeStore } from '@/stores/messageTree'

interface DayInfo {
  day: number
  date: Date
  currentMonth: boolean
  isToday: boolean
  questionCount: number
}

const router = useRouter()
const notebookStore = useNotebookStore()
const treeStore = useMessageTreeStore()

const currentDate = ref(new Date())
const showDayModal = ref(false)
const showDatePicker = ref(false)
const selectedMonth = ref(new Date().getMonth())
const selectedYear = ref(new Date().getFullYear())
const selectedDate = ref<Date | null>(null)
const selectedDayQuestions = ref<Array<{ id: string; question: string; questionSummarized: string | null; chatId: string; notebookName: string }>>([])


const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const monthYearLabel = computed(() => {
  return `${months[currentDate.value.getMonth()]} ${currentDate.value.getFullYear()}`
})

const allMessagesWithNotebook = computed(() => {
  const result: Array<{ id: string; question: string; questionSummarized: string | null; createdAt: number; chatId: string; notebookName: string }> = []
  for (const chat of notebookStore.chats) {
    for (const rootId of chat.rootMessageIds) {
      const msg = treeStore.getMessageById(rootId)
      if (msg) {
        result.push({
          id: msg.id,
          question: msg.question,
          questionSummarized: msg.questionSummarized,
          createdAt: msg.createdAt ?? 0,
          chatId: chat.id,
          notebookName: chat.name || 'Untitled'
        })
      }
    }
  }
  return result
})

const availableYears = computed(() => {
  const years = new Set<number>()
  years.add(new Date().getFullYear())
  for (const msg of allMessagesWithNotebook.value) {
    if (msg.createdAt) years.add(new Date(msg.createdAt).getFullYear())
  }
  return Array.from(years).sort((a, b) => b - a)
})

const messagesByDate = computed(() => {
  const map = new Map<string, typeof allMessagesWithNotebook.value>()
  for (const msg of allMessagesWithNotebook.value) {
    if (!msg.createdAt) continue
    const d = new Date(msg.createdAt)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(msg)
  }
  return map
})

const calendarDays = computed((): DayInfo[] => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()
  const today = new Date()
  const days: DayInfo[] = []

  // Previous month trailing days
  for (let i = firstDay - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i
    const date = new Date(year, month - 1, day)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    days.push({
      day,
      date,
      currentMonth: false,
      isToday: false,
      questionCount: messagesByDate.value.get(key)?.length ?? 0
    })
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d)
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    days.push({
      day: d,
      date,
      currentMonth: true,
      isToday: today.getFullYear() === year && today.getMonth() === month && today.getDate() === d,
      questionCount: messagesByDate.value.get(key)?.length ?? 0
    })
  }

  // Next month leading days
  const remaining = 42 - days.length
  for (let d = 1; d <= remaining; d++) {
    const date = new Date(year, month + 1, d)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    days.push({
      day: d,
      date,
      currentMonth: false,
      isToday: false,
      questionCount: messagesByDate.value.get(key)?.length ?? 0
    })
  }

  return days
})

const previousMonth = () => {
  const d = new Date(currentDate.value)
  d.setMonth(d.getMonth() - 1)
  currentDate.value = d
}

const nextMonth = () => {
  const d = new Date(currentDate.value)
  d.setMonth(d.getMonth() + 1)
  currentDate.value = d
}

const toggleDatePicker = () => {
  showDatePicker.value = !showDatePicker.value
  if (showDatePicker.value) {
    selectedMonth.value = currentDate.value.getMonth()
    selectedYear.value = currentDate.value.getFullYear()
  }
}

const applyDateSelection = () => {
  currentDate.value = new Date(selectedYear.value, selectedMonth.value, 1)
  showDatePicker.value = false
}

const goToCurrentMonth = () => {
  currentDate.value = new Date()
  showDatePicker.value = false
}

const openDayModal = (day: DayInfo) => {
  selectedDate.value = day.date
  const key = `${day.date.getFullYear()}-${String(day.date.getMonth() + 1).padStart(2, '0')}-${String(day.date.getDate()).padStart(2, '0')}`
  selectedDayQuestions.value = (messagesByDate.value.get(key) ?? []).map(m => ({
    id: m.id,
    question: m.question,
    questionSummarized: m.questionSummarized,
    chatId: m.chatId,
    notebookName: m.notebookName
  }))
  showDayModal.value = true
}

const handleOpenQuestion = (data: { id: string; chatId: string }) => {
  const chatId = data.chatId
  if (!chatId) return
  if (notebookStore.currentChatId !== chatId) notebookStore.switchToChat(chatId)
  router.push({ name: 'question', params: { id: chatId, questionId: data.id } })
}

onMounted(async () => {
  for (const chat of notebookStore.chats) {
    if (chat.rootMessageIds.length > 0 && chat.id !== notebookStore.currentChatId) {
      await notebookStore.switchToChat(chat.id)
    }
  }
  if (notebookStore.currentChatId && notebookStore.chats.length > 0) {
    notebookStore.switchToChat(notebookStore.chats[0].id)
  }
})
</script>

<style scoped>
.side-playground-wrapper { height: 100%; }
.calendar-page { height: 100%; overflow-y: auto; background-color: var(--color-bg-base); padding: 2rem; }
.calendar-header { max-width: 800px; margin: 0 auto 2rem; display: flex; justify-content: space-between; align-items: center; padding-bottom: 1rem; border-bottom: 1px solid var(--color-border-base); }
.calendar-header h1 { font-family: Georgia, serif; font-size: 2rem; font-weight: 400; color: var(--color-text-message); margin: 0; }
.month-nav { display: flex; align-items: center; gap: 0.5rem; }
.nav-btn { padding: 0.4rem 0.8rem; background: var(--color-bg-page); border: 1px solid var(--color-border-base); border-radius: 4px; color: var(--color-text-message); cursor: pointer; font-size: 1rem; }
.nav-btn:hover { background: var(--color-bg-hover); }
.month-label-wrapper { position: relative; }
.month-label { padding: 0.4rem 0.8rem; background: transparent; border: 1px solid var(--color-border-base); border-radius: 4px; color: var(--color-text-message); cursor: pointer; font-family: Georgia, serif; font-size: 0.95rem; }
.month-label:hover { background: var(--color-bg-hover); }
.date-picker-dropdown { position: absolute; top: 100%; left: 50%; transform: translateX(-50%); background: var(--color-bg-base); border: 1px solid var(--color-border-base); border-radius: 8px; padding: 1rem; z-index: 100; display: flex; flex-direction: column; gap: 0.75rem; box-shadow: 0 4px 12px var(--shadow-primary); min-width: 200px; }
.today-btn { padding: 0.3rem 0.6rem; background: var(--color-primary); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85rem; }
.picker-row { display: flex; gap: 0.5rem; }
.picker-select { flex: 1; padding: 0.3rem; background: var(--color-bg-page); border: 1px solid var(--color-border-base); border-radius: 4px; color: var(--color-text-message); }
.go-btn { padding: 0.3rem 1rem; background: var(--color-bg-page); border: 1px solid var(--color-border-base); border-radius: 4px; color: var(--color-text-message); cursor: pointer; }
.calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; max-width: 800px; margin: 0 auto; }
.weekday-header { text-align: center; padding: 0.75rem 0; font-weight: 600; color: var(--color-text-muted); font-size: 0.85rem; border-bottom: 1px solid var(--color-border-base); }
.calendar-day { position: relative; min-height: 80px; padding: 0.5rem; background: var(--color-bg-page); border: 1px solid var(--color-border-subtle); display: flex; flex-direction: column; align-items: flex-start; transition: background 0.15s; }
.calendar-day.other-month { opacity: 0.4; }
.calendar-day.today { background: var(--color-bg-primary-subtle); border-color: var(--color-border-accent); }
.calendar-day.has-questions { cursor: pointer; }
.calendar-day.has-questions:hover { background: var(--color-bg-hover); }
.calendar-day.clickable { cursor: pointer; }
.calendar-day.clickable:hover { background: var(--color-bg-hover); }
.day-number { font-size: 0.85rem; color: var(--color-text-message); }
.question-badge { position: absolute; top: 0.25rem; right: 0.25rem; background: var(--color-primary); color: white; font-size: 0.7rem; width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
@media (max-width: 768px) { .calendar-page { padding: 1rem; } .calendar-day { min-height: 50px; } .calendar-header { flex-direction: column; gap: 1rem; } }
</style>
