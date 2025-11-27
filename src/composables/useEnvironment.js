// Composable for environment-related functionality
// Extracted for easier testing

export const getIsDev = () => import.meta.env.DEV

export const getDefaultQuestions = () => {
  const isDev = getIsDev()

  if (isDev) {
    return [
      'give me 20 random words',
      'give me 50 random words',
      'give me 100 random words',
    ]
  } else {
    return [
      'Explain quantum physics in simple terms',
      'How does photosynthesis work?',
      'Teach me about the French Revolution',
    ]
  }
}
