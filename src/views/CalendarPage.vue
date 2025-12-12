<template>
  <div class="calendar-page">
    <div class="calendar-header">
      <button class="nav-btn" @click="goHome" title="Back to Home">
        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
        </svg>
      </button>
      <h1>Activity Calendar</h1>
    </div>

    <SlideTransition appear direction="vertical">
      <div :key="monthYearLabel" class="calendar-content">
        <div class="month-navigation">
          <button class="month-nav-btn" @click="previousMonth">
            <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
              <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
            </svg>
          </button>
          <h2 class="month-title">{{ monthYearLabel }}</h2>
          <button class="month-nav-btn" @click="nextMonth">
            <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
              <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
            </svg>
          </button>
        </div>

        <div class="calendar-grid">
          <div class="weekday-header" v-for="day in weekDays" :key="day">{{ day }}</div>
          <div
            v-for="(day, index) in calendarDays"
            :key="index"
            class="calendar-day"
            :class="{
              'empty': !day.date,
              'today': day.isToday,
              'has-questions': day.questionCount > 0
            }"
            @click="day.date && day.questionCount > 0 && openDayModal(day)"
          >
            <span v-if="day.date" class="day-number">{{ day.dayOfMonth }}</span>
            <span v-if="day.questionCount > 0" class="question-count">{{ day.questionCount }}</span>
          </div>
        </div>
      </div>
    </SlideTransition>

    <CalendarDayModal
      :visible="showDayModal"
      :date="selectedDate"
      :questions="selectedDayQuestions"
      @close="showDayModal = false"
      @open-question="handleOpenQuestion"
    />

    <MobileFooter active-page="calendar" show-home />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '../stores/chat.js'
import CalendarDayModal from '../components/Modal/CalendarDayModal.vue'
import MobileFooter from '../components/MobileFooter.vue'
import SlideTransition from '../components/SlideTransition.vue'

const router = useRouter()
const chatStore = useChatStore()

const currentDate = ref(new Date())
const showDayModal = ref(false)
const selectedDate = ref(null)
const selectedDayQuestions = ref([])

const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const monthYearLabel = computed(() => {
  return currentDate.value.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric'
  })
})

// Get all messages with their notebook info
const allMessagesWithNotebook = computed(() => {
  const result = []

  for (const chat of chatStore.chats) {
    const collectMessages = (messageId) => {
      const msg = chatStore.messagesById[messageId]
      if (!msg) return

      result.push({
        id: msg.id,
        question: msg.questionSummarized || msg.question,
        createdAt: msg.createdAt,
        chatId: chat.id,
        chatName: chat.name || 'Untitled Notebook'
      })

      if (msg.childIds?.length) {
        for (const childId of msg.childIds) {
          collectMessages(childId)
        }
      }
    }

    for (const rootId of chat.rootMessageIds) {
      collectMessages(rootId)
    }
  }

  return result
})

// Group messages by date string (YYYY-MM-DD)
const messagesByDate = computed(() => {
  const grouped = {}

  for (const msg of allMessagesWithNotebook.value) {
    if (!msg.createdAt) continue

    const date = new Date(msg.createdAt)
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

    if (!grouped[dateKey]) {
      grouped[dateKey] = []
    }
    grouped[dateKey].push(msg)
  }

  return grouped
})

const calendarDays = computed(() => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()

  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)

  const startDayOfWeek = firstDayOfMonth.getDay()
  const daysInMonth = lastDayOfMonth.getDate()

  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const days = []

  // Add empty cells for days before the first of the month
  for (let i = 0; i < startDayOfWeek; i++) {
    days.push({ date: null, dayOfMonth: null, questionCount: 0 })
  }

  // Add cells for each day of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const questionsForDay = messagesByDate.value[dateKey] || []

    days.push({
      date: new Date(year, month, day),
      dayOfMonth: day,
      dateKey,
      isToday: dateKey === todayKey,
      questionCount: questionsForDay.length,
      questions: questionsForDay
    })
  }

  return days
})

function previousMonth() {
  currentDate.value = new Date(
    currentDate.value.getFullYear(),
    currentDate.value.getMonth() - 1,
    1
  )
}

function nextMonth() {
  currentDate.value = new Date(
    currentDate.value.getFullYear(),
    currentDate.value.getMonth() + 1,
    1
  )
}

function openDayModal(day) {
  selectedDate.value = day.date
  selectedDayQuestions.value = day.questions
  showDayModal.value = true
}

function handleOpenQuestion({ chatId, questionId }) {
  showDayModal.value = false
  router.push({ name: 'question', params: { id: chatId, questionId } })
}

function goHome() {
  router.push({ name: 'home' })
}
</script>

<style scoped>
.calendar-page {
  min-height: 100vh;
  background-color: var(--color-bg-base);
  padding: 2rem;
}

.calendar-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  max-width: 800px;
  margin: 0 auto 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--color-border-base);
}

.calendar-header h1 {
  font-family: 'Georgia', 'Palatino Linotype', serif;
  font-size: 2rem;
  font-weight: 400;
  color: var(--color-text-message);
  margin: 0;
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  background: var(--color-bg-page);
  border: 1px solid var(--color-border-base);
  border-radius: 6px;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.2s;
}

.nav-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-base);
  border-color: var(--color-border-accent);
}

.month-navigation {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  max-width: 800px;
  margin: 0 auto 1.5rem;
}

.month-title {
  font-family: 'Georgia', serif;
  font-size: 1.5rem;
  font-weight: 400;
  color: var(--color-text-message);
  margin: 0;
  min-width: 200px;
  text-align: center;
}

.month-nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  background: var(--color-bg-page);
  border: 1px solid var(--color-border-base);
  border-radius: 6px;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.2s;
}

.month-nav-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-base);
  border-color: var(--color-border-accent);
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  max-width: 800px;
  margin: 0 auto;
}

.weekday-header {
  padding: 0.75rem 0.5rem;
  text-align: center;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.calendar-day {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  background: var(--color-bg-page);
  border: 1px solid var(--color-border-base);
  border-radius: 8px;
  transition: all 0.2s;
  position: relative;
}

.calendar-day.empty {
  background: transparent;
  border-color: transparent;
}

.calendar-day.today {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 1px var(--color-accent);
}

.calendar-day.has-questions {
  cursor: pointer;
  background: var(--color-bg-hover);
}

.calendar-day.has-questions:hover {
  border-color: var(--color-border-accent);
  box-shadow: 0 2px 8px var(--shadow-primary);
  transform: translateY(-1px);
}

.day-number {
  font-size: 1rem;
  color: var(--color-text-message);
  font-weight: 500;
}

.calendar-day.today .day-number {
  color: var(--color-accent);
}

.question-count {
  position: absolute;
  bottom: 4px;
  right: 4px;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  font-size: 0.7rem;
  font-weight: 600;
  line-height: 20px;
  text-align: center;
  background: var(--color-accent);
  color: white;
  border-radius: 10px;
}

@media (max-width: 768px) {
  .calendar-page {
    padding: 1rem;
    padding-bottom: 5rem;
  }

  .calendar-header {
    margin-bottom: 1.5rem;
  }

  .calendar-header h1 {
    font-size: 1.5rem;
  }

  .month-title {
    font-size: 1.25rem;
    min-width: 150px;
  }

  .weekday-header {
    padding: 0.5rem 0.25rem;
    font-size: 0.75rem;
  }

  .calendar-day {
    padding: 0.25rem;
  }

  .day-number {
    font-size: 0.85rem;
  }

  .question-count {
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    font-size: 0.6rem;
    line-height: 16px;
    bottom: 2px;
    right: 2px;
  }
}
</style>
