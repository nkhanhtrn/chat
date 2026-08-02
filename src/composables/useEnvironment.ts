import { debugLog } from '@/utils/debug'

export const getIsDev = () => import.meta.env.DEV

export function getDefaultQuestions(): string[] {
  const isDev = getIsDev()
  const answers = [
    'Deepdive quantum physics in simple terms',
    'How does photosynthesis work?',
    'Teach me about the French Revolution',
  ]
  if (isDev) {
    answers.unshift('give me 20 random words', 'give me 50 random words')
  }
  return answers
}
