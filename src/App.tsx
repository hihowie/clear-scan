import { lazy, Suspense } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/app-shell'
import {
  RouteLoadingFallback,
  ScannerRouteLoadingFallback,
} from '@/components/route-loading-overlay'
import { QuickCopyPage } from '@/pages/quick-copy-page'
import { HomePage } from '@/pages/home-page'

const HistoryPage = lazy(() =>
  import('@/pages/history-page').then((module) => ({ default: module.HistoryPage })),
)

const importScanPage = () => import('@/pages/scan-page')
let scanPagePromise: ReturnType<typeof importScanPage> | undefined

function loadScanPage() {
  scanPagePromise ??= importScanPage().catch((error: unknown) => {
    scanPagePromise = undefined
    throw error
  })
  return scanPagePromise
}

void loadScanPage().catch(() => undefined)

const ScanPage = lazy(() => loadScanPage().then((module) => ({ default: module.ScanPage })))

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route index element={<QuickCopyPage />} />
        <Route element={<AppShell />}>
          <Route path="tools" element={<HomePage />} />
          <Route
            path="history"
            element={
              <Suspense fallback={<RouteLoadingFallback />}>
                <HistoryPage />
              </Suspense>
            }
          />
          <Route
            path="scan/:mode"
            element={
              <Suspense fallback={<ScannerRouteLoadingFallback />}>
                <ScanPage />
              </Suspense>
            }
          />
          <Route
            path="project/:projectId"
            element={
              <Suspense fallback={<ScannerRouteLoadingFallback />}>
                <ScanPage />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
