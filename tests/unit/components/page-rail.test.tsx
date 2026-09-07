import { StrictMode } from 'react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makePage } from '../../support/scan-fixtures'
import { PageRail } from '@/components/page-rail'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const callbacks = {
  onSelect: vi.fn(),
  onAdd: vi.fn(),
  onDelete: vi.fn(),
  onMove: vi.fn(),
}

describe('PageRail image URLs', () => {
  it('reuses unchanged sources across edits and reorders, releasing only removed or replaced images', () => {
    let sequence = 0
    const createUrl = vi
      .spyOn(URL, 'createObjectURL')
      .mockImplementation(() => `blob:${++sequence}`)
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const pages = Array.from({ length: 10 }, (_, order) => makePage({ id: `page-${order}`, order }))
    const { container, rerender, unmount } = render(
      <PageRail mode="document" pages={pages} {...callbacks} />,
    )
    const initialUrls = Array.from(container.querySelectorAll('img'), (image) => image.src)

    const edited = pages.map((page, index) =>
      index === 0 ? { ...page, effects: { ...page.effects, color: 'grayscale' as const } } : page,
    )
    rerender(<PageRail mode="document" pages={edited} {...callbacks} />)
    expect(Array.from(container.querySelectorAll('img'), (image) => image.src)).toEqual(initialUrls)
    expect(createUrl).toHaveBeenCalledTimes(10)
    expect(revokeUrl).not.toHaveBeenCalled()

    rerender(
      <PageRail
        mode="document"
        pages={edited.map((page) => ({ ...page, order: 9 - page.order }))}
        {...callbacks}
      />,
    )
    expect(Array.from(container.querySelectorAll('img'), (image) => image.src)).toEqual(
      [...initialUrls].reverse(),
    )
    expect(createUrl).toHaveBeenCalledTimes(10)
    expect(revokeUrl).not.toHaveBeenCalled()

    const replacement = { ...edited[0], source: new Blob(['replacement']) }
    rerender(<PageRail mode="document" pages={[replacement, ...edited.slice(2)]} {...callbacks} />)
    expect(createUrl).toHaveBeenCalledTimes(11)
    expect(revokeUrl.mock.calls.flat().sort()).toEqual([initialUrls[0], initialUrls[1]].sort())

    rerender(
      <PageRail
        mode="document"
        pages={[replacement, ...edited.slice(2), makePage({ id: 'new-page', order: 10 })]}
        {...callbacks}
      />,
    )
    expect(createUrl).toHaveBeenCalledTimes(12)
    expect(revokeUrl).toHaveBeenCalledTimes(2)
    unmount()
    expect(revokeUrl.mock.calls.flat().sort()).toEqual(
      createUrl.mock.results.map(({ value }) => value).sort(),
    )
  })

  it('retains live URLs and releases all allocations under StrictMode', () => {
    let sequence = 0
    const createUrl = vi
      .spyOn(URL, 'createObjectURL')
      .mockImplementation(() => `blob:${++sequence}`)
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const { container, unmount } = render(
      <StrictMode>
        <PageRail mode="document" pages={[makePage()]} {...callbacks} />
      </StrictMode>,
    )
    expect(revokeUrl).not.toHaveBeenCalledWith(container.querySelector('img')!.src)
    unmount()
    expect(revokeUrl.mock.calls.flat().sort()).toEqual(
      createUrl.mock.results.map(({ value }) => value).sort(),
    )
  })
})
