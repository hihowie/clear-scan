import { expect, test } from '@playwright/test'
import path from 'node:path'
import { PDFDocument } from 'pdf-lib'

test('makes a local A4 copy with a watermark, downloads PDF and clears on refresh', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '身份证复印件, 一步到位.' })).toBeVisible()
  await expect(page.getByRole('button', { name: '下载 PDF', exact: true })).toBeDisabled()
  const fixture = path.resolve('tests/e2e/fixtures/document.png')
  for (const side of ['人像面', '国徽面']) {
    await page.getByLabel(`选择${side}照片`).setInputFiles(fixture)
    await expect(page.getByRole('status')).toHaveCount(0, { timeout: 120_000 })
    const confirm = page.getByRole('button', { name: '确认裁剪', exact: true })
    if (await confirm.isVisible()) await confirm.click()
  }
  await page.getByLabel('用途水印').fill('仅供测试使用')
  await page.getByLabel('黑白复印').check()
  const download = page.getByRole('button', { name: '下载 PDF', exact: true })
  await expect(download).toBeEnabled({ timeout: 60_000 })
  await expect(page.getByAltText('身份证正反面 A4 复印件预览')).toBeVisible()
  await page.screenshot({
    path: `test-results/quick-copy-${test.info().project.name}.png`,
    fullPage: true,
  })
  const pending = page.waitForEvent('download')
  await download.click()
  const file = await pending
  const stream = await file.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk))
  const pdf = await PDFDocument.load(Buffer.concat(chunks))
  expect(pdf.getPageCount()).toBe(1)
  expect(pdf.getPage(0).getWidth()).toBeCloseTo(595.28)
  expect(pdf.getPage(0).getHeight()).toBeCloseTo(841.89)
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('.copy-print-sheet')).toBeVisible()
  await expect(page.locator('#root')).toBeHidden()
  await page.emulateMedia({ media: 'screen' })
  const storedCount = await page.evaluate(async () => {
    const databases = await indexedDB.databases()
    return databases.length
  })
  expect(storedCount).toBe(0)
  await page.reload()
  await expect(download).toBeDisabled()
  await expect(page.getByAltText('身份证正反面 A4 复印件预览')).toHaveCount(0)
})
