import { debugLog } from '@/utils/debug'

export const getIsDev = () => import.meta.env.DEV

const DEV_TOOLBAR_KEY = 'devToolbarEnabled'

export function getDevToolbarEnabled(): boolean {
  const stored = localStorage.getItem(DEV_TOOLBAR_KEY)
  return stored === 'true'
}

export function setDevToolbarEnabled(enabled: boolean): void {
  localStorage.setItem(DEV_TOOLBAR_KEY, String(enabled))
}

export function getDefaultQuestions(): string[] {
  const isDev = getIsDev()
  const answers = [
    'Explain quantum physics in simple terms',
    'How does photosynthesis work?',
    'Teach me about the French Revolution',
  ]
  if (isDev) {
    answers.unshift('give me 20 random words', 'give me 50 random words')
  }
  return answers
}
