import Dexie, { type EntityTable } from 'dexie'
import { DEFAULT_ADJUSTMENTS, type ScanPage, type ScanProject } from './types'

interface StoredBinary {
  data: ArrayBuffer
  type: string
}

type StoredScanPage = Omit<ScanPage, 'source' | 'thumbnail'> & {
  source: StoredBinary
  thumbnail?: StoredBinary
}

type StoredPageMetadata = Omit<StoredScanPage, 'id' | 'source' | 'thumbnail'>

class ScannerDatabase extends Dexie {
  projects!: EntityTable<ScanProject, 'id'>
  pages!: EntityTable<StoredScanPage, 'id'>

  constructor() {
    super('clear-scan-db')
    this.version(3).stores({
      projects: 'id, mode, createdAt, updatedAt',
      pages: 'id, projectId, [projectId+order], role, updatedAt',
    })
  }
}

export const db = new ScannerDatabase()

interface PendingPageWrite {
  projectId: string
  promise: Promise<unknown>
}

const pageWrites = new Map<string, PendingPageWrite>()

function queuePageWrite<T>(page: ScanPage, write: () => Promise<T>): Promise<T> {
  // Thumbnail encoding and slow writes must finish before newer edits to the
  // same page, including autosaves and flushes triggered by navigation.
  const previous = pageWrites.get(page.id)?.promise ?? Promise.resolve()
  const pending = previous.catch(() => undefined).then(write)
  const entry = { projectId: page.projectId, promise: pending }
  pageWrites.set(page.id, entry)
  const release = () => {
    if (pageWrites.get(page.id) === entry) pageWrites.delete(page.id)
  }
  void pending.then(release, release)
  return pending
}

async function waitForProjectWrites(projectId: string) {
  // The queue outlives ScanPage mounts. Editable reads must observe writes
  // from previous mounts, including saves appended while a read is waiting.
  for (;;) {
    const pending = [...pageWrites.values()]
      .filter((entry) => entry.projectId === projectId)
      .map((entry) => entry.promise)
    if (!pending.length) return
    // Writers report their own errors; a failed write must not strand readers.
    await Promise.allSettled(pending)
  }
}

async function encodeBinary(blob: Blob): Promise<StoredBinary> {
  return {
    data: await blob.arrayBuffer(),
    type: blob.type || 'application/octet-stream',
  }
}

function decodeBinary(binary: StoredBinary) {
  return new Blob([binary.data], { type: binary.type })
}

async function encodePage(page: ScanPage): Promise<StoredScanPage> {
  const { source, thumbnail, ...metadata } = page
  return {
    ...metadata,
    source: await encodeBinary(source),
    thumbnail: thumbnail ? await encodeBinary(thumbnail) : undefined,
  }
}

function pageMetadata(page: ScanPage): StoredPageMetadata {
  const { id: _id, source: _source, thumbnail: _thumbnail, ...metadata } = page
  return metadata
}

function decodePage(page: StoredScanPage): ScanPage {
  const { source, thumbnail, adjustments, cornerSource, cropConfirmed, ...metadata } = page
  return {
    ...metadata,
    source: decodeBinary(source),
    thumbnail: thumbnail ? decodeBinary(thumbnail) : undefined,
    cornerSource: cornerSource ?? 'unverified',
    cropConfirmed: cropConfirmed ?? false,
    adjustments: {
      ...DEFAULT_ADJUSTMENTS,
      ...adjustments,
    },
  }
}

export async function putPage(page: ScanPage) {
  return db.pages.put(await encodePage(page))
}

export async function bulkPutPages(pages: ScanPage[]) {
  const storedPages = await Promise.all(pages.map(encodePage))
  return db.pages.bulkPut(storedPages)
}

export async function updatePageMetadata(page: ScanPage) {
  // Creation goes through putPage(). A queued edit that outlives a page,
  // project or history deletion must never insert the deleted image again.
  return queuePageWrite(page, () => db.pages.update(page.id, pageMetadata(page)))
}

export async function updatePageWithThumbnail(page: ScanPage, thumbnail: Blob) {
  return queuePageWrite(page, async () => {
    return db.pages.update(page.id, {
      ...pageMetadata(page),
      thumbnail: await encodeBinary(thumbnail),
    })
  })
}

export async function bulkUpdatePageMetadata(pages: ScanPage[]) {
  return Promise.all(pages.map(updatePageMetadata))
}

async function readProjectPages(projectId: string) {
  const pages = await db.pages.where('projectId').equals(projectId).sortBy('order')
  return pages.map(decodePage)
}

export async function getProjectPages(projectId: string) {
  await waitForProjectWrites(projectId)
  return readProjectPages(projectId)
}

export async function getProjectPageSummary(projectId: string) {
  // Summaries display committed data without creating editable snapshots, so
  // Home/History can remain available while a thumbnail save is pending.
  const [pageCount, coverPage] = await Promise.all([
    db.pages.where('projectId').equals(projectId).count(),
    db.pages
      .where('[projectId+order]')
      .between([projectId, Dexie.minKey], [projectId, Dexie.maxKey], true, true)
      .first(),
  ])
  const cover = coverPage?.thumbnail ?? coverPage?.source
  return {
    pageCount,
    thumbnail: cover ? decodeBinary(cover) : undefined,
  }
}

export async function getProjectWithPages(projectId: string) {
  await waitForProjectWrites(projectId)
  const [project, pages] = await Promise.all([
    db.projects.get(projectId),
    readProjectPages(projectId),
  ])
  return { project, pages }
}

export async function deleteProject(projectId: string) {
  await db.transaction('rw', db.projects, db.pages, async () => {
    await db.pages.where('projectId').equals(projectId).delete()
    await db.projects.delete(projectId)
  })
}

export async function clearScannerData() {
  await db.transaction('rw', db.projects, db.pages, async () => {
    await db.pages.clear()
    await db.projects.clear()
  })
}
