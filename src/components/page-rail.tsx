import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ScanMode, ScanPage } from '@/lib/types'
import { cn } from '@/lib/utils'
import { messages } from '@/lib/i18n'
import { useLocale } from '@/hooks/use-locale'

function PageThumbnail({ source }: { source: Blob }) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    const nextUrl = URL.createObjectURL(source)
    setUrl(nextUrl)
    return () => URL.revokeObjectURL(nextUrl)
  }, [source])

  return <img src={url} alt="" className="size-full object-cover" />
}

export function PageRail({
  mode,
  pages,
  activeId,
  onSelect,
  onAdd,
  onDelete,
  onMove,
}: {
  mode: ScanMode
  pages: ScanPage[]
  activeId?: string
  onSelect: (page: ScanPage) => void
  onAdd: () => void
  onDelete: (page: ScanPage) => void
  onMove: (page: ScanPage, direction: -1 | 1) => void
}) {
  useLocale()
  const sorted = useMemo(() => [...pages].sort((a, b) => a.order - b.order), [pages])

  return (
    <div
      aria-label={messages.scanPages}
      className="hide-scrollbar flex gap-2 overflow-x-auto p-3 lg:h-full lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:p-2"
    >
      {sorted.map((page, index) => {
        const label =
          mode === 'id-card'
            ? page.role === 'front'
              ? messages.frontSide
              : messages.backSide
            : messages.pageLabel(index + 1)
        const active = page.id === activeId
        return (
          <div
            key={page.id}
            className={cn(
              'group relative shrink-0 rounded-xl border bg-background p-1 transition lg:w-full',
              active
                ? 'border-primary ring-2 ring-primary/15'
                : 'border-border hover:border-primary/30',
            )}
          >
            <button
              type="button"
              aria-label={messages.openPage(label)}
              aria-pressed={active}
              onClick={() => onSelect(page)}
              className="block w-28 lg:w-full"
            >
              <div className="aspect-[4/3] overflow-hidden rounded-lg bg-muted">
                <PageThumbnail source={page.source} />
              </div>
              <span className="mt-1.5 block truncate px-1 text-[10px] font-semibold">
                {label}
                {!page.cropConfirmed && (
                  <span className="ml-1 text-amber-600">{messages.pendingConfirmation}</span>
                )}
              </span>
            </button>
            {active && (
              <div className="mt-1 grid grid-cols-3 overflow-hidden rounded-lg border border-border/80 bg-muted/60 text-muted-foreground">
                <button
                  type="button"
                  aria-label={messages.movePageEarlier(label)}
                  disabled={index === 0}
                  onClick={() => onMove(page, -1)}
                  className="grid h-9 place-items-center border-r border-border/70 transition hover:bg-background hover:text-foreground disabled:opacity-30"
                >
                  <ChevronLeft className="size-3.5 lg:hidden" />
                  <ChevronUp className="hidden size-3.5 lg:block" />
                </button>
                <button
                  type="button"
                  aria-label={messages.movePageLater(label)}
                  disabled={index === sorted.length - 1}
                  onClick={() => onMove(page, 1)}
                  className="grid h-9 place-items-center border-r border-border/70 transition hover:bg-background hover:text-foreground disabled:opacity-30"
                >
                  <ChevronRight className="size-3.5 lg:hidden" />
                  <ChevronDown className="hidden size-3.5 lg:block" />
                </button>
                <button
                  type="button"
                  aria-label={messages.deletePage(label)}
                  onClick={() => onDelete(page)}
                  className="grid h-9 w-full place-items-center transition hover:bg-red-50 hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            )}
          </div>
        )
      })}
      {(mode !== 'id-card' || pages.length < 2) && (
        <Button
          variant="outline"
          onClick={onAdd}
          className="h-auto min-h-20 w-28 shrink-0 flex-col border-dashed text-xs lg:w-full"
        >
          <Plus />
          {messages.addPage}
        </Button>
      )}
    </div>
  )
}
