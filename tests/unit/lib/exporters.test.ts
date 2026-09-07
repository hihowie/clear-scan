import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_QUAD } from '@/lib/geometry'
import { DEFAULT_ADJUSTMENTS, SMART_EFFECTS, type ScanPage, type ScanProject } from '@/lib/types'

const { renderMock } = vi.hoisted(() => ({
  renderMock: vi.fn(),
}))

vi.mock('@/lib/scanner-client', () => ({
  scannerClient: { render: renderMock },
}))

import { exportProject } from '@/lib/exporters'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function makePage(id: string, order: number): ScanPage {
  return {
    id,
    projectId: 'project-1',
    order,
    role: 'page',
    source: new Blob([id], { type: 'image/jpeg' }),
    sourceName: `${id}.jpg`,
    width: 1200,
    height: 900,
    corners: DEFAULT_QUAD,
    confidence: 0.9,
    cornerSource: 'detected',
    cropConfirmed: true,
    glareLevel: 'none',
    rotation: 0,
    effects: { ...SMART_EFFECTS },
    adjustments: { ...DEFAULT_ADJUSTMENTS },
    createdAt: order,
    updatedAt: order,
  }
}

describe('image package export', () => {
  it('keeps full render settings and stores already-compressed JPEG entries', async () => {
    renderMock.mockReset()
    renderMock.mockResolvedValue({
      blob: new Blob(['jpeg-data'], { type: 'image/jpeg' }),
      width: 3000,
      height: 2250,
    })
    const project: ScanProject = {
      id: 'project-1',
      name: '测试文档',
      mode: 'document',
      createdAt: 1,
      updatedAt: 1,
    }

    const result = await exportProject(
      project,
      [makePage('page-2', 1), makePage('page-1', 0)],
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
      const project: ScanProject = {
        id: 'project-1',
        name: '身份证',
        mode: 'id-card',
        createdAt: 1,
        updatedAt: 1,
      }
      const result = await exportProject(
        project,
        [
          { ...makePage('front', 0), role: 'front' },
          { ...makePage('back', 1), role: 'back' },
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
