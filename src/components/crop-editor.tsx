import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { CornerSource, NormalizedQuad } from '@/lib/types'
import { clamp } from '@/lib/geometry'
import { cn } from '@/lib/utils'
import { messages } from '@/lib/i18n'
import { useLocale } from '@/hooks/use-locale'

interface ActiveDrag {
  index: number
  pointerId: number
  changed: boolean
  handleOffset: { x: number; y: number }
  grabOffset: { x: number; y: number }
  viewport: {
    width: number
    height: number
    left?: number
    top?: number
    right?: number
    bottom?: number
  }
}

const HANDLE_OFFSET_DISTANCE = 36
const HANDLE_OFFSET_COMPONENT = HANDLE_OFFSET_DISTANCE / Math.sqrt(2)
const HANDLE_OFFSETS = [
  { x: -HANDLE_OFFSET_COMPONENT, y: -HANDLE_OFFSET_COMPONENT },
  { x: HANDLE_OFFSET_COMPONENT, y: -HANDLE_OFFSET_COMPONENT },
  { x: HANDLE_OFFSET_COMPONENT, y: HANDLE_OFFSET_COMPONENT },
  { x: -HANDLE_OFFSET_COMPONENT, y: HANDLE_OFFSET_COMPONENT },
] as const
const MAGNIFIER_ZOOM = 2.5

function cloneCorners(corners: NormalizedQuad) {
  return corners.map((point) => ({ ...point })) as NormalizedQuad
}

function getMagnifierGeometry(
  point: NormalizedQuad[number],
  index: number,
  viewport: ActiveDrag['viewport'],
) {
  const minSide = Math.min(viewport.width, viewport.height)
  const maxSize = Math.max(32, minSide - 8)
  const size = Math.min(104, Math.max(64, minSide * 0.42), maxSize)
  const pointX = point.x * viewport.width
  const pointY = point.y * viewport.height
  const gap = 14
  const opensRight = index === 0 || index === 3
  const opensDown = index === 0 || index === 1
  const preferredLeft = opensRight ? pointX + gap : pointX - size - gap
  const preferredTop = opensDown ? pointY + gap : pointY - size - gap
  const minLeft = Math.max(4, (viewport.left ?? 0) + 4)
  const minTop = Math.max(4, (viewport.top ?? 0) + 4)
  const maxLeft = Math.max(minLeft, (viewport.right ?? viewport.width) - size - 4)
  const maxTop = Math.max(minTop, (viewport.bottom ?? viewport.height) - size - 4)

  return {
    size,
    left: clamp(preferredLeft, minLeft, maxLeft),
    top: clamp(preferredTop, minTop, maxTop),
    imageLeft: size / 2 - pointX * MAGNIFIER_ZOOM,
    imageTop: size / 2 - pointY * MAGNIFIER_ZOOM,
    imageWidth: viewport.width * MAGNIFIER_ZOOM,
    imageHeight: viewport.height * MAGNIFIER_ZOOM,
  }
}

export function CropEditor({
  sourceUrl,
  width,
  height,
  corners,
  cornerSource,
  onChange,
}: {
  sourceUrl: string
  width: number
  height: number
  corners: NormalizedQuad
  cornerSource: CornerSource
  onChange: (corners: NormalizedQuad) => void
}) {
  useLocale()
  const viewportRef = useRef<HTMLDivElement>(null)
  const panRef = useRef<
    { pointerId: number; x: number; y: number; left: number; top: number } | undefined
  >(undefined)
  const [zoom, setZoom] = useState(1)
  const [viewportSize, setViewportSize] = useState({ width: 640, height: 360 })
  const zoomRef = useRef(1)
  const zoomAnchorRef = useRef<{ x: number; y: number; u: number; v: number } | undefined>(
    undefined,
  )
  const touchesRef = useRef(new Map<number, { x: number; y: number }>())
  const pinchRef = useRef<{ distance: number; zoom: number } | undefined>(undefined)
  const containerRef = useRef<HTMLDivElement>(null)
  const [draftCorners, setDraftCorners] = useState(() => cloneCorners(corners))
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined)
  const draftCornersRef = useRef(draftCorners)
  const receivedCornersRef = useRef(corners)
  const dragRef = useRef<ActiveDrag | undefined>(undefined)
  const pendingPointRef = useRef<NormalizedQuad[number] | undefined>(undefined)
  const frameRef = useRef<number | undefined>(undefined)

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const measure = () =>
      setViewportSize({ width: viewport.clientWidth, height: viewport.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  const changeZoom = useCallback((next: number, clientX?: number, clientY?: number) => {
    const value = clamp(next, 1, 4)
    if (value === zoomRef.current) return
    const viewport = viewportRef.current?.getBoundingClientRect()
    const image = containerRef.current?.getBoundingClientRect()
    if (viewport && image && image.width > 0 && image.height > 0) {
      const x = clientX ?? viewport.left + viewport.width / 2
      const y = clientY ?? viewport.top + viewport.height / 2
      zoomAnchorRef.current = {
        x: x - viewport.left,
        y: y - viewport.top,
        u: (x - image.left) / image.width,
        v: (y - image.top) / image.height,
      }
    }
    zoomRef.current = value
    setZoom(value)
  }, [])

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const image = containerRef.current?.getBoundingClientRect()
    const anchor = zoomAnchorRef.current
    if (!viewport || !image || !anchor) return
    const bounds = viewport.getBoundingClientRect()
    viewport.scrollLeft += image.left + anchor.u * image.width - bounds.left - anchor.x
    viewport.scrollTop += image.top + anchor.v * image.height - bounds.top - anchor.y
    zoomAnchorRef.current = undefined
  }, [zoom])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      if (dragRef.current || pinchRef.current) return
      const delta =
        event.deltaY *
        (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1)
      changeZoom(zoomRef.current * Math.exp(-delta * 0.002), event.clientX, event.clientY)
    }
    viewport.addEventListener('wheel', wheel, { passive: false })
    return () => viewport.removeEventListener('wheel', wheel)
  }, [changeZoom])

  const fitScale = Math.min(
    Math.max(1, viewportSize.width - 112) / width,
    Math.max(1, viewportSize.height - 128) / height,
  )
  const imageWidth = width * fitScale * zoom
  const imageHeight = height * fitScale * zoom

  useLayoutEffect(() => {
    if (dragRef.current || receivedCornersRef.current === corners) return
    receivedCornersRef.current = corners
    const next = cloneCorners(corners)
    draftCornersRef.current = next
    setDraftCorners(next)
  }, [corners])

  const flushPendingPoint = useCallback(() => {
    frameRef.current = undefined
    const drag = dragRef.current
    const point = pendingPointRef.current
    if (!drag || !point) return draftCornersRef.current
    pendingPointRef.current = undefined
    const next = [...draftCornersRef.current] as NormalizedQuad
    next[drag.index] = point
    draftCornersRef.current = next
    setDraftCorners(next)
    return next
  }, [])

  const startDrag = useCallback((index: number, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragRef.current) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.focus({ preventScroll: true })
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0 || rect.height <= 0) return
    const visible = viewportRef.current?.getBoundingClientRect()
    const point = draftCornersRef.current[index]
    const handleOffset = HANDLE_OFFSETS[index]
    const handleCenter = {
      x: rect.left + point.x * rect.width + handleOffset.x,
      y: rect.top + point.y * rect.height + handleOffset.y,
    }
    pendingPointRef.current = undefined
    dragRef.current = {
      index,
      pointerId: event.pointerId,
      changed: false,
      handleOffset,
      grabOffset: {
        x: event.clientX - handleCenter.x,
        y: event.clientY - handleCenter.y,
      },
      viewport: {
        width: rect.width,
        height: rect.height,
        left: visible ? Math.max(0, visible.left - rect.left) : 0,
        top: visible ? Math.max(0, visible.top - rect.top) : 0,
        right: visible ? Math.min(rect.width, visible.right - rect.left) : rect.width,
        bottom: visible ? Math.min(rect.height, visible.bottom - rect.top) : rect.height,
      },
    }
    setActiveIndex(index)
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Pointer capture is an enhancement; the drag still works without it.
    }
  }, [])

  const moveDrag = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect || rect.width <= 0 || rect.height <= 0) return
      const point = {
        x: clamp(
          (event.clientX - rect.left - drag.handleOffset.x - drag.grabOffset.x) / rect.width,
          0.005,
          0.995,
        ),
        y: clamp(
          (event.clientY - rect.top - drag.handleOffset.y - drag.grabOffset.y) / rect.height,
          0.005,
          0.995,
        ),
      }
      const current = pendingPointRef.current ?? draftCornersRef.current[drag.index]
      if (current.x === point.x && current.y === point.y) return
      pendingPointRef.current = point
      drag.changed = true
      if (frameRef.current === undefined) {
        frameRef.current = window.requestAnimationFrame(flushPendingPoint)
      }
    },
    [flushPendingPoint],
  )

  const commitDrag = useCallback(() => {
    const drag = dragRef.current
    if (!drag) return
    if (frameRef.current !== undefined) window.cancelAnimationFrame(frameRef.current)
    const next = flushPendingPoint()
    dragRef.current = undefined
    pendingPointRef.current = undefined
    setActiveIndex(undefined)
    if (drag.changed) {
      receivedCornersRef.current = next
      onChange(next)
    }
  }, [flushPendingPoint, onChange])

  const finishDrag = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (dragRef.current?.pointerId === event.pointerId) commitDrag()
    },
    [commitDrag],
  )

  const finishGesture = (event: ReactPointerEvent<HTMLDivElement>) => {
    touchesRef.current.delete(event.pointerId)
    if (pinchRef.current && touchesRef.current.size < 2) {
      pinchRef.current = undefined
      const remaining = [...touchesRef.current.entries()][0]
      panRef.current = remaining
        ? {
            pointerId: remaining[0],
            x: remaining[1].x,
            y: remaining[1].y,
            left: event.currentTarget.scrollLeft,
            top: event.currentTarget.scrollTop,
          }
        : undefined
    } else if (panRef.current?.pointerId === event.pointerId) {
      panRef.current = undefined
    }
  }

  useEffect(() => {
    return () => {
      if (frameRef.current !== undefined) window.cancelAnimationFrame(frameRef.current)
    }
  }, [])

  const polygon = draftCorners.map((point) => `${point.x * 100},${point.y * 100}`).join(' ')
  const activeDrag = activeIndex === undefined ? undefined : dragRef.current
  const magnifier = activeDrag
    ? getMagnifierGeometry(draftCorners[activeDrag.index], activeDrag.index, activeDrag.viewport)
    : undefined

  return (
    <div className="absolute inset-0 flex min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/15 px-3 py-2 text-white">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={messages.cropZoomOut}
            disabled={zoom <= 1}
            onClick={() => changeZoom(zoom - 0.25)}
          >
            <ZoomOut />
          </Button>
          <output
            aria-label={messages.cropZoomLevel}
            className="w-12 text-center text-xs tabular-nums"
          >
            {Math.round(zoom * 100)}%
          </output>
          <Button
            variant="ghost"
            size="icon"
            aria-label={messages.cropZoomIn}
            disabled={zoom >= 4}
            onClick={() => changeZoom(zoom + 0.25)}
          >
            <ZoomIn />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => changeZoom(1)}>
            <Maximize />
            {messages.cropFit}
          </Button>
        </div>
        <p className="text-[10px] text-white/65">{messages.cropPrecisionHint}</p>
      </div>
      <div
        ref={viewportRef}
        data-testid="crop-viewport"
        className="min-h-0 flex-1 touch-none overflow-auto overscroll-contain cursor-grab active:cursor-grabbing"
        onPointerDownCapture={(event) => {
          if (event.pointerType !== 'touch') return
          touchesRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
          if (touchesRef.current.size !== 2) return
          event.preventDefault()
          event.stopPropagation()
          commitDrag()
          panRef.current = undefined
          const [first, second] = [...touchesRef.current.values()]
          pinchRef.current = {
            distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
            zoom: zoomRef.current,
          }
          for (const id of touchesRef.current.keys()) event.currentTarget.setPointerCapture(id)
        }}
        onPointerDown={(event) => {
          if (dragRef.current || panRef.current || (event.target as HTMLElement).closest('button'))
            return
          panRef.current = {
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            left: event.currentTarget.scrollLeft,
            top: event.currentTarget.scrollTop,
          }
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          if (touchesRef.current.has(event.pointerId))
            touchesRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
          const pinch = pinchRef.current
          if (pinch && touchesRef.current.size >= 2) {
            const [first, second] = [...touchesRef.current.values()]
            changeZoom(
              (pinch.zoom * Math.hypot(second.x - first.x, second.y - first.y)) / pinch.distance,
              (first.x + second.x) / 2,
              (first.y + second.y) / 2,
            )
            return
          }
          const pan = panRef.current
          if (!pan || pan.pointerId !== event.pointerId) return
          event.currentTarget.scrollLeft = pan.left - event.clientX + pan.x
          event.currentTarget.scrollTop = pan.top - event.clientY + pan.y
        }}
        onPointerUp={finishGesture}
        onPointerCancel={finishGesture}
        onLostPointerCapture={(event) => {
          if (event.target === event.currentTarget) finishGesture(event)
        }}
      >
        <div
          className="flex items-center justify-center"
          style={{
            width: Math.max(viewportSize.width, imageWidth + 112),
            height: Math.max(viewportSize.height, imageHeight + 128),
          }}
        >
          <div
            ref={containerRef}
            className="relative shrink-0 select-none overflow-visible shadow-[0_18px_60px_rgba(0,0,0,.4)]"
            style={{ width: imageWidth, height: imageHeight }}
          >
            <img
              src={sourceUrl}
              alt={messages.cropImageAlt}
              className="pointer-events-none size-full object-fill"
              draggable={false}
            />
            <svg
              className="pointer-events-none absolute inset-0 size-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <mask id="crop-mask">
                  <rect width="100" height="100" fill="white" />
                  <polygon points={polygon} fill="black" />
                </mask>
              </defs>
              <rect width="100" height="100" fill="rgba(0,0,0,.52)" mask="url(#crop-mask)" />
              <polygon
                points={polygon}
                className="fill-primary/5 stroke-crop-guide"
                strokeWidth="0.55"
                vectorEffect="non-scaling-stroke"
              />
              {draftCorners.map((point, index) => {
                const next = draftCorners[(index + 1) % draftCorners.length]
                return (
                  <line
                    key={`line-${index}`}
                    x1={point.x * 100}
                    y1={point.y * 100}
                    x2={next.x * 100}
                    y2={next.y * 100}
                    stroke="rgba(255,255,255,.7)"
                    strokeWidth="0.18"
                    strokeDasharray="1 1"
                    vectorEffect="non-scaling-stroke"
                  />
                )
              })}
            </svg>
            {draftCorners.map((point, index) => {
              const offset = HANDLE_OFFSETS[index]
              const angle = Math.atan2(offset.y, offset.x)
              return (
                <div key={index}>
                  <span
                    data-testid={`crop-connector-${index}`}
                    className="pointer-events-none absolute z-[8] h-0.5 origin-left rounded-full bg-white/80 shadow-sm"
                    style={{
                      left: `${point.x * 100}%`,
                      top: `${point.y * 100}%`,
                      width: `${HANDLE_OFFSET_DISTANCE}px`,
                      transform: `translateY(-50%) rotate(${angle}rad)`,
                    }}
                  />
                  <span
                    className="pointer-events-none absolute z-[9] size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow-sm"
                    style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
                  />
                  <button
                    type="button"
                    aria-label={messages.cropHandle(index + 1)}
                    className={cn(
                      'absolute z-20 grid size-12 -translate-x-1/2 -translate-y-1/2 touch-none place-items-center rounded-full bg-transparent outline-none transition-transform hover:scale-105 focus-visible:ring-4 focus-visible:ring-white/75',
                      activeIndex === index && 'scale-110',
                    )}
                    style={{
                      left: `${point.x * 100}%`,
                      top: `${point.y * 100}%`,
                      marginLeft: `${offset.x}px`,
                      marginTop: `${offset.y}px`,
                    }}
                    onKeyDown={(event) => {
                      const directions: Record<string, { x: number; y: number }> = {
                        ArrowLeft: { x: -1, y: 0 },
                        ArrowRight: { x: 1, y: 0 },
                        ArrowUp: { x: 0, y: -1 },
                        ArrowDown: { x: 0, y: 1 },
                      }
                      const direction = directions[event.key]
                      if (!direction || dragRef.current) return
                      event.preventDefault()
                      const step = event.shiftKey ? 10 : 1
                      const next = cloneCorners(draftCornersRef.current)
                      next[index] = {
                        x: clamp(next[index].x + (direction.x * step) / width, 0.005, 0.995),
                        y: clamp(next[index].y + (direction.y * step) / height, 0.005, 0.995),
                      }
                      draftCornersRef.current = next
                      receivedCornersRef.current = next
                      setDraftCorners(next)
                      onChange(next)
                    }}
                    onPointerDown={(event) => {
                      startDrag(index, event)
                    }}
                    onPointerMove={moveDrag}
                    onPointerUp={finishDrag}
                    onPointerCancel={finishDrag}
                    onLostPointerCapture={finishDrag}
                  >
                    <span
                      className={cn(
                        'pointer-events-none size-6 rounded-full border-2 border-white bg-primary shadow-[0_3px_14px_rgba(0,0,0,.5)] ring-2 ring-primary/45 transition-all',
                        activeIndex === index && 'bg-white ring-4 ring-primary/65',
                      )}
                    />
                  </button>
                </div>
              )
            })}
            {magnifier && activeDrag && (
              <div
                data-testid="crop-magnifier"
                className="pointer-events-none absolute z-30 overflow-hidden rounded-full border-2 border-white bg-workspace shadow-[0_8px_28px_rgba(0,0,0,.6)] ring-2 ring-primary/80"
                style={{
                  left: magnifier.left,
                  top: magnifier.top,
                  width: magnifier.size,
                  height: magnifier.size,
                }}
              >
                <img
                  src={sourceUrl}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  className="absolute max-w-none select-none"
                  style={{
                    left: magnifier.imageLeft,
                    top: magnifier.imageTop,
                    width: magnifier.imageWidth,
                    height: magnifier.imageHeight,
                  }}
                />
                <span className="absolute left-1/2 top-1/2 h-px w-6 -translate-x-1/2 -translate-y-1/2 bg-white shadow-[0_0_2px_#000]" />
                <span className="absolute left-1/2 top-1/2 h-6 w-px -translate-x-1/2 -translate-y-1/2 bg-white shadow-[0_0_2px_#000]" />
                <span className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary bg-white" />
              </div>
            )}
            <Badge
              variant={
                cornerSource === 'detected' || cornerSource === 'manual' ? 'default' : 'warning'
              }
              className={cn(
                'pointer-events-none absolute -top-10 left-0 shadow-sm',
                (cornerSource === 'detected' || cornerSource === 'manual') &&
                  'border-crop-guide/30 bg-workspace/90 text-crop-guide',
              )}
            >
              {cornerSource === 'detected'
                ? messages.cropDetectedHint
                : cornerSource === 'manual'
                  ? messages.cropAdjustedHint
                  : messages.cropFallbackHint}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  )
}
