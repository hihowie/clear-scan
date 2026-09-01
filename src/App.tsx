import { lazy, Suspense } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/app-shell'
import {
  RouteLoadingOverlay,
  ScannerRouteLoadingFallback,
} from '@/components/route-loading-overlay'

const HomePage = lazy(() =>
  import('@/pages/home-page').then((module) => ({ default: module.HomePage })),
)
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
        <Route element={<AppShell />}>
          <Route
            index
            element={
              <Suspense fallback={<RouteLoadingOverlay />}>
                <HomePage />
              </Suspense>
            }
          />
          <Route
            path="history"
            element={
              <Suspense fallback={<RouteLoadingOverlay />}>
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
