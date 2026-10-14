import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveLocale } from '@/lib/i18n'
import { en } from '@/lib/i18n/en'

afterEach(() => {
  vi.restoreAllMocks()
  window.localStorage.clear()
  vi.resetModules()
})

describe('browser language selection', () => {
  it.each([
    [['fr-FR', 'zh-TW', 'en-US'], 'zh-CN'],
    [['en-GB', 'zh-CN'], 'en'],
    [['ZH-hant-HK'], 'zh-CN'],
    [['zh'], 'zh-CN'],
    [['de-DE'], 'en'],
    [[], 'en'],
  ] as const)('selects %j as %s', (languages, expected) => {
    expect(resolveLocale(languages)).toBe(expected)
  })

  it('uses navigator.language when the preference list is empty', async () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue([])
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('zh-SG')
    vi.resetModules()
    expect((await import('@/lib/i18n')).locale).toBe('zh-CN')
  })

  it('uses a saved preference ahead of the browser language', async () => {
    window.localStorage.setItem('clear-scan-locale', 'en')
    vi.resetModules()
    const i18n = await import('@/lib/i18n')
    expect(i18n.locale).toBe('en')

    i18n.selectLocale('zh-CN')
    vi.resetModules()
    expect((await import('@/lib/i18n')).locale).toBe('zh-CN')
  })

  it('still switches the live interface when local storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage blocked', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage blocked', 'SecurityError')
    })
    vi.resetModules()
    const i18n = await import('@/lib/i18n')
    expect(i18n.locale).toBe('zh-CN')
    const notify = vi.fn()
    const unsubscribe = i18n.subscribeLocale(notify)
    i18n.selectLocale('en')
    expect(i18n.locale).toBe('en')
    expect(notify).toHaveBeenCalledOnce()
    unsubscribe()
  })
})

describe('English messages', () => {
  it('uses complete sentences and singular or plural counts', () => {
    expect([0, 1, 2].map(en.pageCount)).toEqual(['0 pages', '1 page', '2 pages'])
    expect([1, 2].map(en.skippedFiles)).toEqual([
      'Skipped 1 unsupported file',
      'Skipped 2 unsupported files',
    ])
    expect(en.photoProgress('Reading photo', 2, 3)).toBe('Reading photo - Photo 2 of 3')
  })

  it('uses the selected locale for generated names and dates', async () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US'])
    vi.resetModules()
    const { formatDate, modeDefaultName, sanitizeFileName } = await import('@/lib/utils')
    const time = new Date(2026, 9, 14, 10, 30).getTime()
    expect(formatDate(time)).toBe(
      new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(time),
    )
    expect(modeDefaultName('document')).toMatch(/^Scanned document /)
    expect(sanitizeFileName('')).toBe('Clear Scan')
    expect(sanitizeFileName('我的项目')).toBe('我的项目')
  })
})
