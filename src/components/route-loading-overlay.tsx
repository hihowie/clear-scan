import { useEffect, useState } from 'react'
import { Progress } from '@/components/ui/progress'
import { hasCachedEngineAsset } from '@/lib/engine-cache'
import { messages } from '@/lib/i18n'
import { useLocale } from '@/hooks/use-locale'

const ROUTE_LOADING_DELAY_MS = 300

export function RouteLoadingOverlay({ scanner = false }: { scanner?: boolean }) {
  useLocale()
  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-background/90 px-6 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <div className="w-full max-w-sm rounded-3xl border border-border bg-background p-6 shadow-xl">
        <p className="text-sm font-bold">
          {scanner ? messages.openingScanner : messages.openingPage}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {scanner ? messages.preparingEngineScreen : messages.loadingPageResources}
        </p>
        <Progress indeterminate className="mt-4" />
      </div>
    </div>
  )
}

function useRouteLoadingDelay() {
  const [elapsed, setElapsed] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setElapsed(true), ROUTE_LOADING_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [])

  return elapsed
}

export function RouteLoadingFallback() {
  return useRouteLoadingDelay() ? <RouteLoadingOverlay /> : null
}

export function ScannerRouteLoadingFallback() {
  const delayElapsed = useRouteLoadingDelay()
  const [engineCached, setEngineCached] = useState<boolean>()

  useEffect(() => {
    let cancelled = false
    void hasCachedEngineAsset().then((cached) => {
      if (!cancelled) setEngineCached(cached)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return delayElapsed && engineCached === false ? <RouteLoadingOverlay scanner /> : null
}
