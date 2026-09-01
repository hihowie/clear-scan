import { useEffect, useState } from 'react'
import { Progress } from '@/components/ui/progress'
import { hasCachedEngineAsset } from '@/lib/engine-cache'

export function RouteLoadingOverlay({ scanner = false }: { scanner?: boolean }) {
  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-background/90 px-6 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <div className="w-full max-w-sm rounded-3xl border border-border bg-background p-6 shadow-xl">
        <p className="text-sm font-bold">{scanner ? '正在打开扫描页面' : '正在打开页面'}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {scanner ? '正在准备图像引擎加载界面，请稍候' : '正在加载页面资源，请稍候'}
        </p>
        <Progress indeterminate className="mt-4" />
      </div>
    </div>
  )
}

export function ScannerRouteLoadingFallback() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    let cancelled = false
    void hasCachedEngineAsset().then((cached) => {
      if (!cancelled) setShow(!cached)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return show ? <RouteLoadingOverlay scanner /> : null
}
