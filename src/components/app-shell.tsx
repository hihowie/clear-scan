import { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Code2, FolderClock, Home, ScanLine } from 'lucide-react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { BrandLogo } from './brand-logo'
import { LanguageButton } from './language-button'
import { InstallButton, OnlineBadge, PwaLifecycle } from './pwa-controls'
import { RouteLoadingOverlay } from './route-loading-overlay'
import { Button } from '@/components/ui/button'
import { ScannerNavigationContext } from '@/hooks/use-scanner-navigation'
import { hasCachedEngineAsset } from '@/lib/engine-cache'
import { cn } from '@/lib/utils'
import { messages } from '@/lib/i18n'
import { useLocale } from '@/hooks/use-locale'

export function AppShell() {
  useLocale()
  const navItems = [
    { to: '/', label: messages.home, icon: Home, exact: true },
    { to: '/history', label: messages.history, icon: FolderClock },
  ]
  const location = useLocation()
  const navigate = useNavigate()
  const [scannerOpening, setScannerOpening] = useState(false)
  const scannerNavigationRef = useRef(0)
  const scannerRoute =
    location.pathname.startsWith('/scan/') || location.pathname.startsWith('/project/')
  const openScanner = useCallback(
    (path: string) => {
      const navigation = ++scannerNavigationRef.current
      void hasCachedEngineAsset().then((cached) => {
        if (cached || scannerNavigationRef.current !== navigation) return
        flushSync(() => setScannerOpening(true))
      })
      navigate(path)
    },
    [navigate],
  )

  useEffect(() => {
    scannerNavigationRef.current += 1
    setScannerOpening(false)
  }, [location.key])

  return (
    <div className="min-h-svh">
      <PwaLifecycle />
      <header className="sticky top-0 z-40 h-16 border-b border-border/70 bg-background/88 backdrop-blur-xl">
        <div className="relative mx-auto flex h-full max-w-[1480px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <NavLink to="/" aria-label={messages.homeLink}>
            <BrandLogo />
          </NavLink>
          <nav
            aria-label={messages.mainNavigation}
            className="hidden items-center gap-1 md:flex lg:absolute lg:left-1/2 lg:-translate-x-1/2"
          >
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                className={({ isActive }) =>
                  cn(
                    'flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground',
                    isActive && 'bg-secondary text-secondary-foreground',
                  )
                }
              >
                <item.icon className="size-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-1 sm:gap-2">
            <OnlineBadge />
            <LanguageButton />
            <Button asChild variant="ghost" size="icon" className="sm:hidden">
              <a
                href="https://github.com/rmb122/clear-scan"
                target="_blank"
                rel="noreferrer"
                aria-label={messages.viewSource}
              >
                <Code2 />
              </a>
            </Button>
            <Button asChild variant="outline" size="sm" className="hidden text-sm sm:inline-flex">
              <a
                href="https://github.com/rmb122/clear-scan"
                target="_blank"
                rel="noreferrer"
                aria-label={messages.viewSource}
              >
                <Code2 /> {messages.sourceCode}
              </a>
            </Button>
            <InstallButton />
          </div>
        </div>
      </header>

      <main className={cn(scannerRoute ? 'w-full' : 'mx-auto max-w-7xl px-4 sm:px-6 lg:px-8')}>
        <ScannerNavigationContext.Provider value={openScanner}>
          <Outlet />
        </ScannerNavigationContext.Provider>
      </main>

      <nav
        aria-label={messages.mobileNavigation}
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 grid h-[calc(4rem+env(safe-area-inset-bottom))] grid-cols-3 border-t border-border bg-background/95 px-4 pt-2 backdrop-blur-xl md:hidden"
      >
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            cn(
              'col-start-1 flex flex-col items-center gap-1 py-1 text-[10px] font-semibold text-muted-foreground',
              isActive && 'text-primary',
            )
          }
        >
          <Home className="size-5" />
          {messages.home}
        </NavLink>
        <NavLink
          to="/scan/document"
          onClick={(event) => {
            event.preventDefault()
            openScanner('/scan/document')
          }}
          className="absolute left-1/2 top-0 flex -translate-x-1/2 -translate-y-5 flex-col items-center gap-1 text-[10px] font-semibold text-primary"
        >
          <span className="grid size-12 place-items-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/25">
            <ScanLine className="size-5" />
          </span>
          {messages.scan}
        </NavLink>
        <NavLink
          to="/history"
          className={({ isActive }) =>
            cn(
              'col-start-3 flex flex-col items-center gap-1 py-1 text-[10px] font-semibold text-muted-foreground',
              isActive && 'text-primary',
            )
          }
        >
          <FolderClock className="size-5" />
          {messages.historyShort}
        </NavLink>
      </nav>
      <Toaster
        position="top-center"
        richColors
        closeButton
        containerAriaLabel={messages.notifications}
        toastOptions={{ closeButtonAriaLabel: messages.close }}
      />
      {scannerOpening && <RouteLoadingOverlay scanner />}
    </div>
  )
}
