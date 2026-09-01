import { createContext, useContext } from 'react'

export type OpenScanner = (path: string) => void

export const ScannerNavigationContext = createContext<OpenScanner | undefined>(undefined)

export function useScannerNavigation() {
  const openScanner = useContext(ScannerNavigationContext)
  if (!openScanner) throw new Error('ScannerNavigationContext is missing')
  return openScanner
}
