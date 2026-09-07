import Dexie, { type EntityTable } from 'dexie'
import {
  DEFAULT_ADJUSTMENTS,
  ORIGINAL_EFFECTS,
  SMART_EFFECTS,
  type EnhancementEffects,
  type ScanPage,
  type ScanProject,
} from './types'

interface StoredBinary {
  data: ArrayBuffer
  type: string
}

type LegacyFilter =
  | 'original'
  | 'smart'
  | 'deshadow'
  | 'ai-deshadow'
  | 'deglare'
  | 'grayscale'
  | 'black-white'
  | 'sharpen'
  | 'vivid'

type StoredEffects = Omit<EnhancementEffects, 'shadow' | 'color'> & {
  shadow: EnhancementEffects['shadow'] | 'ai-deshadow'
  color: EnhancementEffects['color'] | 'vivid'
}

type StoredScanPage = Omit<ScanPage, 'source' | 'thumbnail' | 'effects'> & {
  source: StoredBinary
  thumbnail?: StoredBinary
  effects?: StoredEffects
  filter?: LegacyFilter
}

type StoredPageMetadata = Omit<StoredScanPage, 'id' | 'source' | 'thumbnail' | 'order' | 'filter'>

const LEGACY_FILTER_EFFECTS: Record<LegacyFilter, EnhancementEffects> = {
  original: ORIGINAL_EFFECTS,
  smart: SMART_EFFECTS,
  deshadow: { ...ORIGINAL_EFFECTS, shadow: 'deshadow' },
  'ai-deshadow': { ...ORIGINAL_EFFECTS, shadow: 'deshadow' },
  deglare: { ...ORIGINAL_EFFECTS, glare: 'deglare' },
  grayscale: { ...ORIGINAL_EFFECTS, color: 'grayscale' },
  'black-white': { ...ORIGINAL_EFFECTS, color: 'black-white' },
  sharpen: { ...ORIGINAL_EFFECTS, detail: 'sharpen' },
  vivid: { ...ORIGINAL_EFFECTS, color: 'enhanced-color' },
}

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
const thumbnailWrites = new Map<string, PendingPageWrite>()

function queuePageWrite<T>(
  page: Pick<ScanPage, 'id' | 'projectId'>,
  write: () => Promise<T>,
  queue = pageWrites,
): Promise<T> {
  const previous = queue.get(page.id)?.promise ?? Promise.resolve()
  const pending = previous.catch(() => undefined).then(write)
  const entry = { projectId: page.projectId, promise: pending }
  queue.set(page.id, entry)
  const release = () => {
    if (queue.get(page.id) === entry) queue.delete(page.id)
  }
  void pending.then(release, release)
  return pending
}

async function waitForProjectWrites(projectId: string) {
  // Editable reads wait for metadata from previous mounts, including writes
  // appended while waiting. Thumbnail encoding never blocks these edits.
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
  // Reordering owns the order field, so an older editor snapshot cannot undo it.
  const { id: _id, source: _source, thumbnail: _thumbnail, order: _order, ...metadata } = page
  return metadata
}

function decodePage(page: StoredScanPage): ScanPage {
  const {
    source,
    thumbnail,
    adjustments,
    cornerSource,
    cropConfirmed,
    effects,
    filter,
    ...metadata
  } = page
  const storedEffects = effects ?? (filter ? LEGACY_FILTER_EFFECTS[filter] : ORIGINAL_EFFECTS)
  return {
    ...metadata,
    source: decodeBinary(source),
    thumbnail: thumbnail ? decodeBinary(thumbnail) : undefined,
    cornerSource: cornerSource ?? 'unverified',
    cropConfirmed: cropConfirmed ?? false,
    // Preserve legacy presets and map retired effects to their supported equivalents.
    effects: {
      ...storedEffects,
      shadow: storedEffects.shadow === 'ai-deshadow' ? 'deshadow' : storedEffects.shadow,
      color: storedEffects.color === 'vivid' ? 'enhanced-color' : storedEffects.color,
    },
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
  // Commit metadata promptly. Slow thumbnail encoding must not delay later
  // edits or write an old metadata snapshot after they have been saved.
  const metadataWrite = updatePageMetadata(page)
  const thumbnailWrite = queuePageWrite(
    page,
    async () => {
      const encoded = await encodeBinary(thumbnail)
      await metadataWrite
      return db.pages.update(page.id, { thumbnail: encoded })
    },
    thumbnailWrites,
  )
  const [, updated] = await Promise.all([metadataWrite, thumbnailWrite])
  return updated
}

export async function bulkUpdatePageOrder(pages: Pick<ScanPage, 'id' | 'projectId' | 'order'>[]) {
  const updatedAt = Date.now()
  return Promise.all(
    pages.map((page) =>
      queuePageWrite(page, () => db.pages.update(page.id, { order: page.order, updatedAt })),
    ),
  )
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
