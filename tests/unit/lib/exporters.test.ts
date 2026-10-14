import { afterEach, describe, expect, it, vi } from 'vitest'
import { PDFDocument } from 'pdf-lib'

const { renderMock } = vi.hoisted(() => ({
  renderMock: vi.fn(),
}))

vi.mock('@/lib/scanner-client', () => ({
  scannerClient: { render: renderMock },
}))

import { exportProject } from '@/lib/exporters'
import { makePage, makeProject } from '../../support/scan-fixtures'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('image package export', () => {
  it('keeps full render settings and stores already-compressed JPEG entries', async () => {
    renderMock.mockReset()
    renderMock.mockResolvedValue({
      blob: new Blob(['jpeg-data'], { type: 'image/jpeg' }),
      width: 3000,
      height: 2250,
    })
    const result = await exportProject(
      makeProject(),
      [makePage({ id: 'page-2', order: 1 }), makePage()],
      'zip',
      'content',
    )

    expect(renderMock).toHaveBeenCalledTimes(2)
    expect(renderMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ id: 'page-1' }),
      { maxEdge: 3000, mimeType: 'image/jpeg', quality: 0.94 },
      { intent: 'export' },
    )
    const bytes = new DataView(await result.blob.arrayBuffer())
    expect(bytes.getUint32(0, true)).toBe(0x04034b50)
    expect(bytes.getUint16(8, true)).toBe(0)
    expect(result.fileName).toBe('测试文档-图片包.zip')
  })
})

describe('ID card image export', () => {
  it.each([
    ['png', 'image/png'],
    ['jpg', 'image/jpeg'],
  ] as const)(
    'uses %s for both intermediate images and the composed sheet',
    async (format, mimeType) => {
      renderMock.mockReset()
      renderMock.mockResolvedValue({
        blob: new Blob(['image'], { type: mimeType }),
        width: 1200,
        height: 750,
      })
      const close = vi.fn()
      vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ close }))
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
        fillRect: vi.fn(),
        drawImage: vi.fn(),
      } as unknown as CanvasRenderingContext2D)
      const encode = vi
        .spyOn(HTMLCanvasElement.prototype, 'toBlob')
        .mockImplementation((callback, type) => {
          callback(new Blob(['sheet'], { type }))
        })
      const result = await exportProject(
        makeProject({ name: '身份证', mode: 'id-card' }),
        [
          makePage({ id: 'front', role: 'front' }),
          makePage({ id: 'back', order: 1, role: 'back' }),
        ],
        format,
        'a4',
      )

      expect(renderMock).toHaveBeenCalledTimes(2)
      for (const [page, options, request] of renderMock.mock.calls) {
        expect(['front', 'back']).toContain(page.role)
        expect(options).toEqual({ maxEdge: 3000, mimeType, quality: 0.94 })
        expect(request).toEqual({ intent: 'export' })
      }
      expect(encode).toHaveBeenCalledWith(expect.any(Function), mimeType, 0.94)
      expect(close).toHaveBeenCalledTimes(2)
      expect(result.blob.type).toBe(mimeType)
      expect(result.fileName).toBe(`身份证.${format}`)
    },
  )
})

describe('content-sized PDF export', () => {
  it.each([
    [100, 2000, 39.6, 792],
    [2000, 100, 792, 39.6],
    [20, 40, 20, 40],
  ])('preserves the aspect ratio of a %ix%i page', async (width, height, pdfWidth, pdfHeight) => {
    renderMock.mockReset()
    // A valid PNG keeps PDF embedding and serialization in the regression test.
    const png = new Uint8Array(
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2n9sAAAAASUVORK5CYII=',
        'base64',
      ),
    )
    renderMock.mockResolvedValue({ blob: new Blob([png], { type: 'image/png' }), width, height })
    const result = await exportProject(makeProject(), [makePage()], 'pdf', 'content')
    const pdf = await PDFDocument.load(await result.blob.arrayBuffer())
    const size = pdf.getPages()[0].getSize()
    expect(size.width).toBeCloseTo(pdfWidth)
    expect(size.height).toBeCloseTo(pdfHeight)
    expect(size.width / size.height).toBeCloseTo(width / height)
  })
})
