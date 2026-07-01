export type ReaderTheme = 'light' | 'dark'

const ORDER: ReaderTheme[] = ['light', 'dark']
const LABELS: Record<ReaderTheme, string> = { light: 'Light', dark: 'Dark' }

export function getTheme(): ReaderTheme {
  const t = localStorage.getItem('theme')
  return (ORDER as string[]).includes(t ?? '') ? (t as ReaderTheme) : 'light'
}

export function setTheme(t: ReaderTheme): void {
  localStorage.setItem('theme', t)
  document.documentElement.setAttribute('data-theme', t)
}

export function cycleTheme(): ReaderTheme {
  const cur = getTheme()
  const next = ORDER[(ORDER.indexOf(cur) + 1) % ORDER.length]
  setTheme(next)
  return next
}

export function themeLabel(t: ReaderTheme): string {
  return LABELS[t]
}
