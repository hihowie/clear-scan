import { useEffect, useState } from 'react'
import { Download, MoreHorizontal, RefreshCw, Share, WifiOff } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { messages } from '@/lib/i18n'
import { useLocale } from '@/hooks/use-locale'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PwaLifecycle() {
  useLocale()
  const {
    offlineReady: [offlineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  useEffect(() => {
    if (offlineReady)
      toast.success(messages.offlineReady, {
        description: messages.engineCacheNotice,
      })
  }, [offlineReady])

  useEffect(() => {
    if (!needRefresh) return
    toast(messages.updateAvailable, {
      description: messages.updatePrompt,
      action: {
        label: messages.updateNow,
        onClick: () => {
          void updateServiceWorker(true).catch((reason: unknown) => {
            toast.error(messages.updateFailed, {
              description: reason instanceof Error ? reason.message : messages.refreshRetry,
            })
          })
        },
      },
      duration: 10_000,
    })
  }, [needRefresh, updateServiceWorker])

  return null
}

export function OnlineBadge() {
  useLocale()
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  if (online) return null
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
      <WifiOff className="size-3" /> {messages.offlineMode}
    </span>
  )
}

export function InstallButton() {
  useLocale()
  const [prompt, setPrompt] = useState<InstallPromptEvent>()
  const [showIos, setShowIos] = useState(false)
  const standalone = window.matchMedia('(display-mode: standalone)').matches
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent)

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault()
      setPrompt(event as InstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (standalone) return null

  const install = async () => {
    try {
      if (prompt) {
        await prompt.prompt()
        await prompt.userChoice
        setPrompt(undefined)
      } else if (isIos) {
        setShowIos(true)
      } else {
        toast(messages.installFromMenu, {
          description: messages.installMenuHint,
        })
      }
    } catch (reason) {
      toast.error(messages.installFailed, {
        description: reason instanceof Error ? reason.message : messages.installRetry,
      })
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => void install()}
        className="sm:hidden"
        aria-label={messages.installApp}
      >
        <Download />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => void install()}
        className="hidden text-sm sm:inline-flex"
      >
        <Download /> {messages.installApp}
      </Button>
      <Dialog open={showIos} onOpenChange={setShowIos}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{messages.addToHomeScreen}</DialogTitle>
            <DialogDescription>{messages.installDescription}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 rounded-2xl bg-muted p-4 text-sm leading-6">
            <p className="flex gap-3">
              <Share className="mt-1 size-4 shrink-0 text-primary" />
              {messages.safariShare}
            </p>
            <p className="flex gap-3">
              <MoreHorizontal className="mt-1 size-4 shrink-0 text-primary" />
              {messages.safariAdd}
            </p>
            <p className="flex gap-3">
              <RefreshCw className="mt-1 size-4 shrink-0 text-primary" />
              {messages.safariOffline}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
