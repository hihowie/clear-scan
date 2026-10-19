import { fitWithin } from './geometry'
import { getIdCardSheetLayout } from './id-card-layout'
import { scannerClient } from './scanner-client'
import type { ScanPage, ScanProject } from './types'
import { sanitizeFileName } from './utils'
import { messages } from './i18n'

export type ExportFormat = 'jpg' | 'png' | 'pdf' | 'zip'
export type PdfLayout = 'content' | 'a4'

interface ExportResult {
  blob: Blob
  fileName: string
}

interface RenderedPage {
  blob: Blob
  width: number
  height: number
}

const A4_POINTS = { width: 595.28, height: 841.89 }
const A4_PIXELS = { width: 2480, height: 3508 }

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: 'image/jpeg' | 'image/png',
  quality = 0.94,
) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error(messages.exportImageFailed))),
      mimeType,
      quality,
    )
  })
}

async function renderScanPage(page: ScanPage, mimeType: 'image/jpeg' | 'image/png') {
  return scannerClient.render(
    page,
    { maxEdge: 3000, mimeType, quality: 0.94 },
    { intent: 'export' },
  )
}

export async function composeIdCard(
  pages: ScanPage[],
  mimeType: 'image/jpeg' | 'image/png',
  onProgress?: (value: number, label: string) => void,
  watermark = '',
) {
  const front = pages.find((page) => page.role === 'front')
  const back = pages.find((page) => page.role === 'back')
  if (!front || !back) throw new Error(messages.idCardIncomplete)

  onProgress?.(15, messages.processingFront)
  const frontImage = await renderScanPage(front, mimeType)
  onProgress?.(48, messages.processingBack)
  const backImage = await renderScanPage(back, mimeType)
  const [frontBitmap, backBitmap] = await Promise.all([
    createImageBitmap(frontImage.blob),
    createImageBitmap(backImage.blob),
  ])

  const canvas = document.createElement('canvas')
  canvas.width = A4_PIXELS.width
  canvas.height = A4_PIXELS.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error(messages.idCardCanvasFailed)
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)

  const layout = getIdCardSheetLayout(canvas.width, canvas.height)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(
    frontBitmap,
    layout.front.x,
    layout.front.y,
    layout.front.width,
    layout.front.height,
  )
  context.drawImage(backBitmap, layout.back.x, layout.back.y, layout.back.width, layout.back.height)
  if (watermark.trim()) {
    await document.fonts.ready
    for (const rectangle of [layout.front, layout.back]) {
      context.save()
      context.beginPath()
      context.rect(rectangle.x, rectangle.y, rectangle.width, rectangle.height)
      context.clip()
      context.translate(rectangle.x + rectangle.width / 2, rectangle.y + rectangle.height / 2)
      context.rotate(-Math.PI / 8)
      context.font = `500 ${Math.round(rectangle.width * 0.027)}px "PingFang SC", "Microsoft YaHei", sans-serif`
      context.fillStyle = 'rgba(90, 90, 90, 0.3)'
      context.textAlign = 'center'
      for (let row = -3; row <= 3; row += 1) {
        context.fillText(
          watermark.trim().slice(0, 60),
          0,
          row * rectangle.height * 0.22,
          rectangle.width * 0.95,
        )
      }
      context.restore()
    }
  }
  frontBitmap.close()
  backBitmap.close()

  onProgress?.(85, messages.composingA4)
  const blob = await canvasToBlob(canvas, mimeType)
  return { blob, width: canvas.width, height: canvas.height }
}

async function createPdf(renderedPages: RenderedPage[], layout: PdfLayout, forceA4 = false) {
  const { PDFDocument } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  pdf.setProducer(messages.pdfProducer)
  pdf.setCreator(messages.appName)
  pdf.setCreationDate(new Date())

  for (const rendered of renderedPages) {
    const bytes = await rendered.blob.arrayBuffer()
    const image =
      rendered.blob.type === 'image/png' ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes)
    const useA4 = forceA4 || layout === 'a4'
    if (useA4) {
      const page = pdf.addPage([A4_POINTS.width, A4_POINTS.height])
      if (forceA4) {
        page.drawImage(image, { x: 0, y: 0, width: A4_POINTS.width, height: A4_POINTS.height })
        continue
      }
      const placement = fitWithin(
        rendered.width,
        rendered.height,
        A4_POINTS.width - 48,
        A4_POINTS.height - 48,
      )
      page.drawImage(image, {
        x: placement.x + 24,
        y: A4_POINTS.height - placement.y - placement.height - 24,
        width: placement.width,
        height: placement.height,
      })
    } else {
      const maxSide = 792
      const scale = Math.min(1, maxSide / Math.max(rendered.width, rendered.height))
      const width = rendered.width * scale
      const height = rendered.height * scale
      const page = pdf.addPage([width, height])
      page.drawImage(image, { x: 0, y: 0, width, height })
    }
  }

  const bytes = await pdf.save()
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer
  return new Blob([buffer], { type: 'application/pdf' })
}

export async function exportProject(
  project: ScanProject,
  pages: ScanPage[],
  format: ExportFormat,
  layout: PdfLayout,
  onProgress?: (value: number, label: string) => void,
  watermark = '',
): Promise<ExportResult> {
  const baseName = sanitizeFileName(project.name)
  const orderedPages = [...pages].sort((left, right) => left.order - right.order)
  if (orderedPages.length === 0) throw new Error(messages.noExportPages)

  if (project.mode === 'id-card') {
    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg'
    const composition = await composeIdCard(orderedPages, mimeType, onProgress, watermark)
    if (format === 'pdf') {
      const pdf = await createPdf([composition], 'a4', true)
      onProgress?.(100, messages.pdfGenerated)
      return { blob: pdf, fileName: `${baseName}.pdf` }
    }
    if (format === 'zip') throw new Error(messages.idCardExportFormat)
    onProgress?.(100, messages.combinedImageGenerated)
    return { blob: composition.blob, fileName: `${baseName}.${format}` }
  }

  if (format === 'jpg' || format === 'png') {
    if (orderedPages.length > 1) throw new Error(messages.multiPageExportFormat)
    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg'
    onProgress?.(20, messages.processingPage)
    const rendered = await renderScanPage(orderedPages[0], mimeType)
    onProgress?.(100, messages.imageGenerated)
    return { blob: rendered.blob, fileName: `${baseName}.${format}` }
  }

  if (format === 'zip') {
    const { default: JSZip } = await import('jszip')
    const zip = new JSZip()
    for (let index = 0; index < orderedPages.length; index += 1) {
      onProgress?.(
        Math.round((index / orderedPages.length) * 85),
        messages.processingPageNumber(index + 1),
      )
      const rendered = await renderScanPage(orderedPages[index], 'image/jpeg')
      zip.file(`${baseName}-${String(index + 1).padStart(2, '0')}.jpg`, rendered.blob)
    }
    // JPEG pages are already compressed; deflating them again costs CPU while
    // usually saving almost no space, especially on mobile devices.
    const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' })
    onProgress?.(100, messages.zipGenerated)
    return { blob, fileName: messages.zipFileName(baseName) }
  }

  const renderedPages: RenderedPage[] = []
  for (let index = 0; index < orderedPages.length; index += 1) {
    onProgress?.(
      Math.round((index / orderedPages.length) * 82),
      messages.processingPageNumber(index + 1),
    )
    renderedPages.push(await renderScanPage(orderedPages[index], 'image/jpeg'))
  }
  const blob = await createPdf(renderedPages, layout)
  onProgress?.(100, messages.pdfGenerated)
  return { blob, fileName: `${baseName}.pdf` }
}
