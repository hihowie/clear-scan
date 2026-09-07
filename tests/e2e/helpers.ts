import { expect, type Page } from '@playwright/test'

export async function waitForScannerReady(page: Page) {
  await expect(page.getByRole('button', { name: '从相册或电脑上传' })).toBeEnabled({
    timeout: 30_000,
  })
}

export async function holdNextThumbnailEncoding(page: Page) {
  const gate = await page.evaluateHandle(() => {
    let release!: () => void
    let started = false
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    const read = Blob.prototype.arrayBuffer
    // Metadata saves do not read blobs. Hold the next manual thumbnail save
    // without delaying IndexedDB reads or the worker's image processing.
    Blob.prototype.arrayBuffer = function () {
      Blob.prototype.arrayBuffer = read
      started = true
      return pending.then(() => read.call(this))
    }
    return {
      get started() {
        return started
      },
      release() {
        Blob.prototype.arrayBuffer = read
        release()
      },
    }
  })
  return {
    waitUntilBlocked: () => expect.poll(() => gate.evaluate((gate) => gate.started)).toBe(true),
    release: async () => {
      await gate.evaluate((gate) => gate.release())
      await gate.dispose()
    },
  }
}
