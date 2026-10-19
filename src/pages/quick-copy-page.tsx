import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import {
  Check,
  Download,
  FileImage,
  Fingerprint,
  LoaderCircle,
  Printer,
  RotateCw,
  ScanLine,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  X,
} from 'lucide-react'
import { CropEditor } from '@/components/crop-editor'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { composeIdCard, exportProject } from '@/lib/exporters'
import { scannerClient } from '@/lib/scanner-client'
import { DETECTION_CONFIDENCE_THRESHOLD } from '@/lib/document-detection'
import { DEFAULT_ADJUSTMENTS, ORIGINAL_EFFECTS, type ScanPage, type ScanProject } from '@/lib/types'
import { downloadBlob } from '@/lib/utils'

type Side = 'front' | 'back'
const sides: Side[] = ['front', 'back']
const sideNames = { front: '人像面', back: '国徽面' }

function useBlobUrl(blob?: Blob) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (!blob) {
      setUrl('')
      return
    }
    const next = URL.createObjectURL(blob)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [blob])
  return url
}

function SideCard({
  side,
  page,
  disabled,
  onFile,
  onEdit,
  onRotate,
}: {
  side: Side
  page?: ScanPage
  disabled: boolean
  onFile: (file: File) => void
  onEdit: () => void
  onRotate: () => void
}) {
  const url = useBlobUrl(page?.source)
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-bold">
          <span className="grid size-6 place-items-center rounded-full bg-secondary text-xs text-primary">
            {side === 'front' ? '1' : '2'}
          </span>
          {sideNames[side]}
        </h2>
        {page && (
          <span className={`text-xs ${page.cropConfirmed ? 'text-emerald-600' : 'text-amber-700'}`}>
            {page.cropConfirmed ? '已就绪' : '请确认裁剪'}
          </span>
        )}
      </div>
      <label
        className={`relative flex aspect-[1.586] cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border-2 border-dashed border-primary/20 bg-secondary/30 transition hover:bg-secondary/70 ${disabled ? 'pointer-events-none opacity-50' : ''}`}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          const file = event.dataTransfer.files[0]
          if (file && !disabled) onFile(file)
        }}
      >
        {url ? (
          <img src={url} alt={`${sideNames[side]}原图`} className="size-full object-contain p-2" />
        ) : (
          <>
            <Upload className="size-7 text-primary/60" />
            <span className="text-sm font-semibold text-primary">选择{sideNames[side]}照片</span>
            <span className="text-xs text-muted-foreground">点击选择, 或将照片拖到这里</span>
          </>
        )}
        <input
          aria-label={`选择${sideNames[side]}照片`}
          type="file"
          accept="image/*"
          disabled={disabled}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) onFile(file)
          }}
        />
      </label>
      {page && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant={page.cropConfirmed ? 'outline' : 'secondary'}
            size="sm"
            disabled={disabled}
            onClick={onEdit}
          >
            <SlidersHorizontal />
            调整裁剪
          </Button>
          <Button variant="ghost" size="sm" disabled={disabled} onClick={onRotate}>
            <RotateCw />
            旋转
          </Button>
          <span className="self-center text-xs text-muted-foreground">点击照片可替换</span>
        </div>
      )}
      {page?.glareLevel === 'severe' && (
        <p className="mt-3 text-xs text-amber-700">照片反光较强, 建议重新拍摄以保留文字细节.</p>
      )}
    </section>
  )
}

export function QuickCopyPage() {
  useEffect(() => {
    const title = document.title
    const language = document.documentElement.lang
    document.title = '证件轻印 - 身份证复印件一键制作'
    document.documentElement.lang = 'zh-CN'
    return () => {
      document.title = title
      document.documentElement.lang = language
    }
  }, [])
  const [pages, setPages] = useState<Partial<Record<Side, ScanPage>>>({})
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [watermark, setWatermark] = useState('')
  const [grayscale, setGrayscale] = useState(false)
  const [editing, setEditing] = useState<Side>()
  const [sheet, setSheet] = useState<{ blob: Blob; key: string }>()
  const [rendering, setRendering] = useState(false)
  const generation = useRef(0)
  const pageRefs = useRef(pages)
  pageRefs.current = pages
  const project = useMemo<ScanProject>(
    () => ({
      id: crypto.randomUUID(),
      name: '身份证复印件',
      mode: 'id-card',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
    [],
  )
  const prepared = useMemo(
    () =>
      sides.flatMap((side) =>
        pages[side]
          ? [
              {
                ...pages[side],
                effects: {
                  ...pages[side]!.effects,
                  color: grayscale ? ('grayscale' as const) : ('original' as const),
                },
              } as ScanPage,
            ]
          : [],
      ),
    [pages, grayscale],
  )
  const complete = prepared.length === 2 && prepared.every((page) => page.cropConfirmed)
  const previewKey = JSON.stringify([
    prepared.map((page) => [page.id, page.corners, page.rotation]),
    grayscale,
    watermark,
  ])
  const sheetUrl = useBlobUrl(sheet?.blob)
  const ready = complete && sheet?.key === previewKey && !rendering && !busy && !!sheetUrl
  const editPage = editing ? pages[editing] : undefined
  const editUrl = useBlobUrl(editPage?.source)

  useEffect(
    () => () => {
      generation.current += 1
      Object.values(pageRefs.current).forEach((page) => scannerClient.invalidatePage(page.id))
    },
    [],
  )

  useEffect(() => {
    let cancelled = false
    setError('')
    setRendering(complete)
    if (!complete) {
      setSheet(undefined)
      return
    }
    const timeout = window.setTimeout(() => {
      void composeIdCard(prepared, 'image/png', undefined, watermark)
        .then((result) => {
          if (!cancelled) setSheet({ blob: result.blob, key: previewKey })
        })
        .catch((reason) => {
          if (!cancelled)
            setError(reason instanceof Error ? reason.message : '预览生成失败, 请重试.')
        })
        .finally(() => {
          if (!cancelled) setRendering(false)
        })
    }, 300)
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [complete, prepared, watermark, previewKey])

  async function importPhoto(side: Side, file: File) {
    if (busy) return
    if (!file.type.startsWith('image/')) {
      setError('请选择图片文件.')
      return
    }
    if (file.size > 30 * 1024 * 1024) {
      setError('单张照片请小于 30 MB.')
      return
    }
    const ticket = ++generation.current
    setBusy(`正在识别${sideNames[side]}...`)
    setError('')
    try {
      const detection = await scannerClient.detect(file, 'id-card', undefined, {
        onProgress: (_value, label) => {
          if (ticket === generation.current) setBusy(label)
        },
      })
      if (ticket !== generation.current) return
      const previous = pages[side]
      if (previous) scannerClient.invalidatePage(previous.id)
      const page: ScanPage = {
        ...detection,
        id: crypto.randomUUID(),
        projectId: project.id,
        role: side,
        order: side === 'front' ? 0 : 1,
        source: file,
        sourceName: file.name,
        cropConfirmed:
          detection.cornerSource === 'detected' &&
          detection.confidence >= DETECTION_CONFIDENCE_THRESHOLD &&
          detection.glareLevel !== 'severe',
        rotation: 0,
        effects: { ...ORIGINAL_EFFECTS },
        adjustments: { ...DEFAULT_ADJUSTMENTS },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      setPages((current) => ({ ...current, [side]: page }))
      if (!page.cropConfirmed) setEditing(side)
    } catch (reason) {
      if (ticket === generation.current)
        setError(reason instanceof Error ? reason.message : '照片处理失败, 请重新选择.')
    } finally {
      if (ticket === generation.current) setBusy('')
    }
  }

  function updatePage(side: Side, changes: Partial<ScanPage>) {
    setPages((current) => ({
      ...current,
      [side]: current[side] ? { ...current[side], ...changes } : undefined,
    }))
  }

  async function download(format: 'pdf' | 'png') {
    if (!ready) return
    setBusy('正在生成文件...')
    setError('')
    try {
      const result =
        format === 'png' && sheet
          ? { blob: sheet.blob, fileName: `${project.name}.png` }
          : await exportProject(project, prepared, format, 'a4', undefined, watermark)
      downloadBlob(result.blob, result.fileName)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '下载失败, 请重试.')
    } finally {
      setBusy('')
    }
  }

  function reset() {
    generation.current += 1
    Object.values(pages).forEach((page) => scannerClient.invalidatePage(page.id))
    setPages({})
    setSheet(undefined)
    setEditing(undefined)
    setError('')
    setBusy('')
  }

  return (
    <div className="min-h-svh">
      <header className="border-b border-border bg-card/90">
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between gap-3 px-5">
          <Link to="/" className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-primary text-white">
              <ScanLine />
            </span>
            <span className="font-bold">
              证件轻印
              <span className="mt-0.5 block text-[10px] font-medium tracking-widest text-muted-foreground">
                POWERED BY CLEAR SCAN
              </span>
            </span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 pb-12 pt-10 sm:pt-14">
        <div className="mb-9">
          <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            <ShieldCheck className="size-3.5" />
            本地处理, 照片不上传
          </span>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">身份证复印件, 一步到位.</h1>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            选好正反面, 自动裁剪摆正, 合成原尺寸 A4 复印件.
          </p>
        </div>
        <div className="grid items-start gap-7 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {sides.map((side) => (
                <SideCard
                  key={side}
                  side={side}
                  page={pages[side]}
                  disabled={!!busy}
                  onFile={(file) => void importPhoto(side, file)}
                  onEdit={() => setEditing(side)}
                  onRotate={() =>
                    updatePage(side, {
                      rotation: ((pages[side]!.rotation + 90) % 360) as ScanPage['rotation'],
                    })
                  }
                />
              ))}
            </div>
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-4 font-bold">复印设置</h2>
              <label htmlFor="watermark" className="mb-2 block text-sm font-medium">
                用途水印 <span className="font-normal text-muted-foreground">可选</span>
              </label>
              <input
                id="watermark"
                value={watermark}
                maxLength={60}
                disabled={!!busy}
                onChange={(event) => setWatermark(event.target.value)}
                placeholder="例如: 仅供办理入职使用, 他用无效"
                className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/25"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {['仅供入职使用', '仅供租房使用', '仅供办理业务使用'].map((text) => (
                  <button
                    key={text}
                    disabled={!!busy}
                    className="rounded-lg bg-muted px-2.5 py-1.5 text-xs text-muted-foreground hover:text-primary"
                    onClick={() => setWatermark(text)}
                  >
                    {text}
                  </button>
                ))}
              </div>
              <label className="mt-5 flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={grayscale}
                  disabled={!!busy}
                  onChange={(event) => setGrayscale(event.target.checked)}
                  className="size-4 accent-blue-600"
                />
                黑白复印
              </label>
              <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
                <span>A4 纸张 · 身份证原尺寸</span>
                <span>85.6 × 53.98 mm</span>
              </div>
            </section>
            {(busy || rendering) && (
              <p role="status" className="flex items-center gap-2 text-sm text-primary">
                <LoaderCircle className="size-4 animate-spin" />
                {busy || '正在生成 A4 预览...'}
              </p>
            )}
            {error && (
              <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
                {error}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg" disabled={!ready} onClick={() => void download('pdf')}>
                <Download />
                下载 PDF
              </Button>
              <Button variant="outline" size="lg" disabled={!ready} onClick={() => window.print()}>
                <Printer />
                打印
              </Button>
              <Button variant="ghost" disabled={!ready} onClick={() => void download('png')}>
                <FileImage />
                保存图片
              </Button>
            </div>
            <p className="text-xs leading-6 text-muted-foreground">
              打印请选择 A4, 缩放为 100% / 实际大小, 关闭页眉页脚.
              下载前请检查裁剪和文字是否完整清晰.
            </p>
          </div>
          <section className="rounded-2xl border border-border bg-slate-100 p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold">A4 预览</h2>
              <span className="text-xs text-muted-foreground">210 × 297 mm</span>
            </div>
            <div className="relative mx-auto aspect-[210/297] w-full max-w-sm overflow-hidden bg-white shadow-md">
              {sheetUrl && complete ? (
                <img src={sheetUrl} alt="身份证正反面 A4 复印件预览" className="size-full" />
              ) : (
                <div className="flex size-full flex-col items-center justify-center gap-6 px-[29.6%]">
                  {sides.map((side) => (
                    <div
                      key={side}
                      className="flex aspect-[1.586] w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-slate-200 text-slate-300"
                    >
                      <Fingerprint className="size-6" />
                      <span className="text-[10px]">{sideNames[side]}</span>
                    </div>
                  ))}
                </div>
              )}
              {rendering && (
                <div className="absolute inset-0 grid place-items-center bg-white/75">
                  <LoaderCircle className="animate-spin text-primary" />
                </div>
              )}
            </div>
            <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Check className="size-3.5" />
              正反面同页, 原尺寸排版
            </p>
            <Button
              className="mt-4 w-full"
              variant="ghost"
              disabled={!!busy || !prepared.length}
              onClick={reset}
            >
              <X />
              清空照片, 重新制作
            </Button>
          </section>
        </div>
      </main>
      <Dialog
        open={!!editing && !!editPage}
        onOpenChange={(open) => {
          if (!open) setEditing(undefined)
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>调整{editing ? sideNames[editing] : ''}裁剪</DialogTitle>
            <DialogDescription>
              拖动四角对齐证件边缘, 然后确认. 自动识别不可靠时需要手动确认.
            </DialogDescription>
          </DialogHeader>
          <div className="relative h-[min(50svh,440px)] overflow-hidden rounded-xl bg-workspace p-10">
            {editPage && editUrl && editing && (
              <CropEditor
                key={editPage.id}
                sourceUrl={editUrl}
                width={editPage.width}
                height={editPage.height}
                corners={editPage.corners}
                cornerSource={editPage.cornerSource}
                onChange={(corners) =>
                  updatePage(editing, { corners, cornerSource: 'manual', cropConfirmed: false })
                }
              />
            )}
          </div>
          <Button
            onClick={() => {
              if (editing) updatePage(editing, { cropConfirmed: true })
              setEditing(undefined)
            }}
          >
            <Check />
            确认裁剪
          </Button>
        </DialogContent>
      </Dialog>
      {sheetUrl &&
        createPortal(
          <div className="copy-print-sheet">
            <img src={sheetUrl} alt="待打印的身份证复印件" />
          </div>,
          document.body,
        )}
    </div>
  )
}
