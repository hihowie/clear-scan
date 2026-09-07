import { DEFAULT_QUAD } from '@/lib/geometry'
import { DEFAULT_ADJUSTMENTS, SMART_EFFECTS, type ScanPage, type ScanProject } from '@/lib/types'

export function makeProject(overrides: Partial<ScanProject> = {}): ScanProject {
  return {
    id: 'project-1',
    name: '测试文档',
    mode: 'document',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

export function makePage(overrides: Partial<ScanPage> = {}): ScanPage {
  return {
    id: 'page-1',
    projectId: 'project-1',
    order: 0,
    role: 'page',
    source: new Blob(['source'], { type: 'image/png' }),
    sourceName: 'page.png',
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
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}
