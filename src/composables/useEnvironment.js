// Composable for environment-related functionality
// Extracted for easier testing

import { debugLog } from '../utils/debug.js'

export const getIsDev = () => import.meta.env.DEV

// DevToolbar visibility (persisted in localStorage)
const DEV_TOOLBAR_KEY = 'devToolbarEnabled'

export const getDevToolbarEnabled = () => {
  const stored = localStorage.getItem(DEV_TOOLBAR_KEY)
  debugLog('[useEnvironment.getDevToolbarEnabled] Reading from localStorage:', DEV_TOOLBAR_KEY, stored)
  // Default to false if not set
  return stored === 'true'
}

export const setDevToolbarEnabled = (enabled) => {
  debugLog('[useEnvironment.setDevToolbarEnabled] Writing to localStorage:', DEV_TOOLBAR_KEY, String(enabled))
  localStorage.setItem(DEV_TOOLBAR_KEY, String(enabled))
}

export const getDefaultQuestions = () => {
  const isDev = getIsDev()
  let answers = [
      'Explain quantum physics in simple terms',
      'How does photosynthesis work?',
      'Teach me about the French Revolution',
  ];
  if (isDev) {
    answers.unshift(...[
      'give me 20 random words',
      'give me 50 random words',
    ]
    )
  }
  return answers
}
