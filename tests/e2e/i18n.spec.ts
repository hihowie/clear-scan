import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement
    const buttons = [...document.querySelectorAll('button')].filter(
      (button) => button.getClientRects().length > 0,
    )
    return Math.max(
      root.scrollWidth - root.clientWidth,
      ...buttons.map((button) => button.scrollWidth - button.clientWidth),
    )
  })
  expect(overflow).toBeLessThanOrEqual(1)
}

test.describe('English scanning', () => {
  test.use({ locale: 'en-US' })

  test('localizes capture, worker progress, export, and saved history', async ({ page }) => {
    await page.addInitScript(() => {
      const labels: string[] = []
      Object.assign(window, { scanProgressLabels: labels })
      const NativeWorker = window.Worker
      window.Worker = class extends NativeWorker {
        constructor(url: string | URL, options?: WorkerOptions) {
          super(url, options)
          this.addEventListener('message', (event) => {
            if (event.data.type === 'progress') labels.push(event.data.label)
          })
        }
      }
    })
    await page.goto('/')
    await expect(
      page.getByRole('heading', { name: 'Turn your pocket camera into a clear scanner' }),
    ).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expectNoHorizontalOverflow(page)

    await page.getByRole('button', { name: 'Switch to Simplified Chinese' }).click()
    await expect(page.getByRole('heading', { name: /清晰扫描仪/ })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      'href',
      '/manifest.zh-CN.webmanifest',
    )
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
    await page.getByRole('button', { name: '开始扫描' }).click()
    await expect(page.getByRole('button', { name: '从相册或电脑上传' })).toBeEnabled({
      timeout: 30_000,
    })
    await page.getByRole('button', { name: '切换为英语' }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByRole('heading', { name: 'Add document pages' })).toBeVisible()
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      'href',
      '/manifest.en.webmanifest',
    )
    await page.evaluate(() => {
      ;(window as typeof window & { scanProgressLabels: string[] }).scanProgressLabels.length = 0
    })
    await expect(page.getByRole('button', { name: 'Upload photos' })).toBeEnabled({
      timeout: 30_000,
    })
    await page
      .locator('input[type="file"]')
      .nth(1)
      .setInputFiles(path.resolve('tests/e2e/fixtures/document.png'))
    await expect(page.getByRole('heading', { name: 'Confirm all four corners' })).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Project name' })).toHaveValue(
      /^Scanned document /,
    )
    await page.getByRole('textbox', { name: 'Project name' }).fill('Trip notes')
    await expectNoHorizontalOverflow(page)
    await page.getByRole('button', { name: 'Confirm crop', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Adjust scan effects' })).toBeVisible()
    await page.getByRole('button', { name: 'Grayscale', exact: true }).click()
    const documentStartedAt = await page.evaluate(() => performance.timeOrigin)
    await page.getByRole('button', { name: 'Switch to Simplified Chinese' }).click()
    await expect(page.getByRole('heading', { name: '调整扫描效果' })).toBeVisible()
    await expect(page.getByRole('button', { name: '灰度', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(page.getByRole('textbox', { name: '项目名称' })).toHaveValue('Trip notes')
    await page.getByRole('button', { name: '切换为英语' }).click()
    expect(await page.evaluate(() => performance.timeOrigin)).toBe(documentStartedAt)
    await expect(page.getByRole('button', { name: 'Grayscale', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await page.getByRole('button', { name: 'Save page', exact: true }).click()
    await expectNoHorizontalOverflow(page)

    const labels = await page.evaluate(
      () => (window as typeof window & { scanProgressLabels: string[] }).scanProgressLabels,
    )
    expect(labels).toContain('Analyzing document edges')
    expect(labels.some((label) => /\p{Script=Han}/u.test(label))).toBe(false)

    await page.getByRole('button', { name: 'Export', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('1 page', { exact: true })).toBeVisible()
    await expectNoHorizontalOverflow(page)
    const downloadPromise = page.waitForEvent('download')
    await dialog.getByRole('button', { name: 'Generate and download' }).click()
    expect((await downloadPromise).suggestedFilename()).toBe('Trip notes.pdf')
    await expect(dialog).toBeHidden()

    await page.getByRole('button', { name: 'Export', exact: true }).click()
    await dialog.getByRole('button', { name: /ZIP image archive/ }).click()
    const zipDownload = page.waitForEvent('download')
    await dialog.getByRole('button', { name: 'Generate and download' }).click()
    expect((await zipDownload).suggestedFilename()).toBe('Trip notes-images.zip')
    await expect(dialog).toBeHidden()

    await page.goto('/#/history')
    await expect(page.getByRole('heading', { name: 'Scan history', exact: true })).toBeVisible()
    await expect(page.getByText('Trip notes', { exact: true })).toBeVisible()
    await expect(page.getByText('1 page', { exact: true })).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })

  test('localizes engine download errors from the bootstrap worker', async ({ page }) => {
    await page.route('**/vendor/opencv.js', (route) => route.fulfill({ status: 503, body: '' }))
    await page.goto('/#/scan/document')
    const alert = page.getByRole('alert')
    await expect(alert).toContainText('Could not load the image engine')
    await expect(alert).toContainText('Image engine download failed (HTTP 503)')
    await expect(page.getByRole('button', { name: 'Reload', exact: true })).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })
})

for (const [browserLocale, locale, appName] of [
  ['zh-TW', 'zh-CN', '清晰扫描'],
  ['fr-FR', 'en', 'Clear Scan'],
] as const) {
  test.describe(`browser locale ${browserLocale}`, () => {
    test.use({ locale: browserLocale })

    test('selects matching document metadata and install information', async ({ page }) => {
      await page.goto('/')
      await expect(page.locator('html')).toHaveAttribute('lang', locale)
      await expect(page).toHaveTitle(new RegExp(appName))
      const manifestLink = page.locator('link[rel="manifest"]')
      await expect(manifestLink).toHaveAttribute('href', `/manifest.${locale}.webmanifest`)
      const manifest = await page.evaluate(async () => {
        const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')!
        return (await fetch(link.href)).json()
      })
      expect(manifest.name).toBe(appName)
      expect(manifest.lang).toBe(locale)
      expect(manifest.shortcuts[0].name).toBe(locale === 'en' ? 'Scan ID card' : '扫描身份证')
      await expectNoHorizontalOverflow(page)
    })
  })
}
