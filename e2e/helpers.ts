import { expect, type Page } from '@playwright/test'

export async function waitForScannerReady(page: Page) {
  await expect(page.getByRole('button', { name: '从相册或电脑上传' })).toBeEnabled({
    timeout: 30_000,
  })
}
