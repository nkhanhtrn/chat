// Composable for environment-related functionality
// Extracted for easier testing

export const getIsDev = () => import.meta.env.DEV

// DevToolbar visibility (persisted in localStorage)
const DEV_TOOLBAR_KEY = 'devToolbarEnabled'

export const getDevToolbarEnabled = () => {
  const stored = localStorage.getItem(DEV_TOOLBAR_KEY)
  // Default to false if not set
  return stored === 'true'
}

export const setDevToolbarEnabled = (enabled) => {
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
