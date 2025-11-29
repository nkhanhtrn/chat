// Composable for environment-related functionality
// Extracted for easier testing

export const getIsDev = () => import.meta.env.DEV

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
