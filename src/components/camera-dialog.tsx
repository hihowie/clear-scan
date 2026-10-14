import { useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { messages } from '@/lib/i18n'
import { useLocale } from '@/hooks/use-locale'

interface ImageCaptureInstance {
  takePhoto: () => Promise<Blob>
}

interface ImageCaptureConstructor {
  new (track: MediaStreamTrack): ImageCaptureInstance
}

export function CameraDialog({
  open,
  onOpenChange,
  onCapture,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCapture: (file: File) => void
}) {
  useLocale()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setCapturing(false)
    setError(undefined)
    if (!navigator.mediaDevices?.getUserMedia) {
      setLoading(false)
      setError(window.isSecureContext ? messages.cameraUnavailable : messages.cameraNeedsHttps)
      return
    }
    void navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 2560 },
          height: { ideal: 1920 },
        },
      })
      .then(async (stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        try {
          if (videoRef.current) {
            videoRef.current.srcObject = stream
            await videoRef.current.play()
          }
        } catch (reason) {
          stream.getTracks().forEach((track) => track.stop())
          if (streamRef.current === stream) streamRef.current = undefined
          throw reason
        }
        setLoading(false)
      })
      .catch((reason: unknown) => {
        if (cancelled) return
        setLoading(false)
        setError(reason instanceof Error ? reason.message : messages.cameraAccessFailed)
      })

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = undefined
    }
  }, [open])

  const capture = async () => {
    const stream = streamRef.current
    const video = videoRef.current
    if (!stream || !video || capturing) return
    setCapturing(true)
    try {
      let blob: Blob
      const track = stream.getVideoTracks()[0]
      const Capture = (window as unknown as { ImageCapture?: ImageCaptureConstructor }).ImageCapture
      if (Capture) {
        blob = await new Capture(track).takePhoto()
      } else {
        const settings = track.getSettings()
        const canvas = document.createElement('canvas')
        canvas.width = settings.width ?? video.videoWidth
        canvas.height = settings.height ?? video.videoHeight
        const context = canvas.getContext('2d')
        if (!context) throw new Error(messages.cameraFrameFailed)
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (value) => (value ? resolve(value) : reject(new Error(messages.captureFailed))),
            'image/jpeg',
            0.95,
          ),
        )
      }
      onCapture(new File([blob], `camera-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' }))
      onOpenChange(false)
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : messages.captureFailed)
    } finally {
      setCapturing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-[#0c1813] p-3 text-white">
        <DialogHeader className="px-3 pt-2">
          <DialogTitle className="text-white">{messages.cameraTitle}</DialogTitle>
        </DialogHeader>
        <div className="paper-grid relative aspect-[4/3] overflow-hidden rounded-2xl bg-black">
          <video ref={videoRef} playsInline muted className="size-full object-cover" />
          {loading && (
            <div className="absolute inset-0 grid place-items-center bg-black/55">
              <LoaderCircle className="size-8 animate-spin" />
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 px-6 text-center">
              <CameraOff className="size-8 text-red-300" />
              <p className="text-sm">{error}</p>
              <p className="text-xs text-white/60">{messages.cameraPermissionHint}</p>
            </div>
          )}
          {!error && !loading && (
            <div className="pointer-events-none absolute inset-[9%] rounded-lg border border-emerald-300/70">
              <span className="absolute -left-px -top-px size-7 border-l-2 border-t-2 border-emerald-300" />
              <span className="absolute -right-px -top-px size-7 border-r-2 border-t-2 border-emerald-300" />
              <span className="absolute -bottom-px -left-px size-7 border-b-2 border-l-2 border-emerald-300" />
              <span className="absolute -bottom-px -right-px size-7 border-b-2 border-r-2 border-emerald-300" />
            </div>
          )}
        </div>
        <div className="flex justify-center pb-2">
          <Button
            size="lg"
            disabled={loading || capturing || Boolean(error)}
            onClick={() => void capture()}
            className="size-14 rounded-full p-0 ring-4 ring-white/20"
          >
            {capturing ? (
              <LoaderCircle className="size-6 animate-spin" />
            ) : (
              <Camera className="size-6" />
            )}
            <span className="sr-only">{capturing ? messages.capturing : messages.takePhoto}</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
