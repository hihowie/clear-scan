import { en } from './en'
import { zh } from './zh'

export type Locale = 'zh-CN' | 'en'

export function resolveLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const base = language.toLowerCase().split('-')[0]
    if (base === 'zh') return 'zh-CN'
    if (base === 'en') return 'en'
  }
  return 'en'
}

const STORAGE_KEY = 'clear-scan-locale'
const listeners = new Set<() => void>()

function readPreference(): Locale | undefined {
  try {
    const saved = typeof window === 'undefined' ? null : window.localStorage.getItem(STORAGE_KEY)
    if (saved === 'zh-CN' || saved === 'en') return saved
  } catch {
    // Browser privacy settings can make local storage unavailable.
  }
}

const browserLanguages =
  typeof navigator === 'undefined'
    ? []
    : navigator.languages?.length
      ? navigator.languages
      : [navigator.language]

export let locale = readPreference() ?? resolveLocale(browserLanguages)
export let messages = locale === 'zh-CN' ? zh : en

export function subscribeLocale(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function setLocale(next: Locale) {
  if (next === locale) return
  locale = next
  messages = locale === 'zh-CN' ? zh : en
  listeners.forEach((listener) => listener())
}

export function selectLocale(next: Locale) {
  try {
    window.localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // Switching still works for this session when persistence is unavailable.
  }
  setLocale(next)
}
