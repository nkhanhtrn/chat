// Utility function to capitalize the first letter of each word in a string
export function capitalizeWords(str) {
  if (!str) return ''
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1))
}
