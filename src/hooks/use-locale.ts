import { useSyncExternalStore } from 'react'
import { locale, subscribeLocale } from '@/lib/i18n'

const getLocale = () => locale

// Subscribe renders without capturing a stale dictionary in async callbacks.
export function useLocale() {
  return useSyncExternalStore(subscribeLocale, getLocale)
}
