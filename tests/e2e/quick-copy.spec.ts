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

test('zooms and pans the crop image while preserving precise corner coordinates', async ({
  page,
}) => {
  await page.goto('/')
  await page
    .getByLabel('选择人像面照片')
    .setInputFiles(path.resolve('tests/e2e/fixtures/document.png'))
  await expect(page.getByRole('status')).toHaveCount(0, { timeout: 120_000 })
  if (!(await page.getByRole('dialog').isVisible())) {
    await page.getByRole('button', { name: '调整裁剪' }).click()
  }
  const dialog = page.getByRole('dialog')
  const image = dialog.getByRole('img', { name: '待裁剪文档' })
  const handle = dialog.getByRole('button', { name: '拖动第 1 个裁剪点' })
  const before = await image.boundingBox()
  const initialLeft = await handle.evaluate((element) => Number.parseFloat(element.style.left))
  const zoomLevel = dialog.getByLabel('裁剪缩放比例')
  await page.mouse.move(before!.x + before!.width / 2, before!.y + before!.height / 2)
  await page.mouse.wheel(0, -200)
  await expect.poll(async () => Number.parseInt(await zoomLevel.innerText())).toBeGreaterThan(100)
  expect(await handle.evaluate((element) => Number.parseFloat(element.style.left))).toBe(
    initialLeft,
  )
  await page.mouse.wheel(0, 1000)
  await expect(zoomLevel).toHaveText('100%')
  for (let step = 0; step < 4; step += 1)
    await dialog.getByRole('button', { name: '放大裁剪图片' }).click()
  await expect(dialog.getByLabel('裁剪缩放比例')).toHaveText('200%')
  expect((await image.boundingBox())!.width).toBeCloseTo(before!.width * 2, 0)
  expect(await handle.evaluate((element) => Number.parseFloat(element.style.left))).toBe(
    initialLeft,
  )
  const viewport = dialog.getByTestId('crop-viewport')
  const bounds = (await viewport.boundingBox())!
  const scrollBefore = await viewport.evaluate((element) => element.scrollLeft)
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  await page.mouse.down()
  await page.mouse.move(bounds.x + bounds.width / 2 - 25, bounds.y + bounds.height / 2 - 20, {
    steps: 5,
  })
  await page.mouse.up()
  expect(await viewport.evaluate((element) => element.scrollLeft)).toBeGreaterThan(scrollBefore)
  await handle.scrollIntoViewIfNeeded()
  const handleBox = (await handle.boundingBox())!
  const renderedWidth = (await image.boundingBox())!.width
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(handleBox.x + handleBox.width / 2 + 8, handleBox.y + handleBox.height / 2, {
    steps: 4,
  })
  await page.mouse.up()
  const draggedLeft = await handle.evaluate((element) => Number.parseFloat(element.style.left))
  expect(draggedLeft - initialLeft).toBeCloseTo((8 / renderedWidth) * 100, 1)
  await expect(handle).toBeFocused()
  await page.keyboard.press('ArrowRight')
  const sourceWidth = await image.evaluate((element) => (element as HTMLImageElement).naturalWidth)
  const nudgedLeft = await handle.evaluate((element) => Number.parseFloat(element.style.left))
  expect(nudgedLeft - draggedLeft).toBeCloseTo(100 / sourceWidth, 3)
  await page.keyboard.press('Shift+ArrowRight')
  expect(
    (await handle.evaluate((element) => Number.parseFloat(element.style.left))) - nudgedLeft,
  ).toBeCloseTo(1000 / sourceWidth, 3)
  await page.screenshot({ path: `test-results/crop-zoom-${test.info().project.name}.png` })
  await dialog.getByRole('button', { name: '适应窗口' }).click()
  await expect(dialog.getByLabel('裁剪缩放比例')).toHaveText('100%')
  await dialog.getByRole('button', { name: '确认裁剪', exact: true }).click()
  await expect(dialog).toHaveCount(0)
})

test('pinches the crop image on mobile without moving crop corners or zooming the webpage', async ({
  page,
  context,
  isMobile,
}) => {
  test.skip(!isMobile, 'Touch gesture coverage uses the mobile browser project')
  await page.goto('/')
  await page
    .getByLabel('选择人像面照片')
    .setInputFiles(path.resolve('tests/e2e/fixtures/document.png'))
  await expect(page.getByRole('status')).toHaveCount(0, { timeout: 120_000 })
  if (!(await page.getByRole('dialog').isVisible()))
    await page.getByRole('button', { name: '调整裁剪' }).click()
  const dialog = page.getByRole('dialog')
  const viewport = dialog.getByTestId('crop-viewport')
  const bounds = (await viewport.boundingBox())!
  const x = bounds.x + bounds.width / 2
  const y = bounds.y + bounds.height / 2
  const handle = dialog.getByRole('button', { name: '拖动第 1 个裁剪点' })
  const corner = await handle.getAttribute('style')
  const session = await context.newCDPSession(page)
  const points = (spread: number) => [
    { x: x - spread, y, id: 1 },
    { x: x + spread, y, id: 2 },
  ]
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(30) })
  for (const spread of [36, 42, 48, 54, 60]) {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: points(spread),
    })
  }
  await expect(dialog.getByLabel('裁剪缩放比例')).toHaveText('200%')
  for (const spread of [54, 48, 42, 36, 30]) {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: points(spread),
    })
  }
  await expect(dialog.getByLabel('裁剪缩放比例')).toHaveText('100%')
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  expect(await handle.getAttribute('style')).toBe(corner)
  expect(await page.evaluate(() => window.visualViewport?.scale)).toBe(1)
  // A new single-finger pan must still work after ending a pinch.
  await dialog.getByRole('button', { name: '放大裁剪图片' }).click()
  await dialog.getByRole('button', { name: '放大裁剪图片' }).click()
  const scroll = await viewport.evaluate((element) => element.scrollLeft)
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y, id: 3 }],
  })
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: x - 20, y, id: 3 }],
  })
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  expect(await viewport.evaluate((element) => element.scrollLeft)).toBeGreaterThan(scroll)
  await session.detach()
})
