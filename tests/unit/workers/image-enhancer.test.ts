// @vitest-environment node
import { createRequire } from 'node:module'
import type { CV } from '@techstark/opencv-js'
import { beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_ADJUSTMENTS, ORIGINAL_EFFECTS, SMART_EFFECTS } from '@/lib/types'
import {
  createLightingResult,
  processEffects,
  processEffectsFromLighting,
} from '@/workers/image-enhancer'

// This build is a self-resolving thenable; load it without promise assimilation.
const cv = createRequire(import.meta.url)('@techstark/opencv-js') as CV

beforeAll(async () => {
  if (!cv.Mat) {
    await new Promise<void>((resolve) => {
      ;(cv as typeof cv & { onRuntimeInitialized: () => void }).onRuntimeInitialized = resolve
    })
  }
})

describe.each(['enhanced-color', 'grayscale', 'black-white'] as const)('%s documents', (color) => {
  it.each([180, 230, 255])('preserves sparse ink on paper with brightness %i', (paper) => {
    const source = new cv.Mat(320, 240, cv.CV_8UC4, new cv.Scalar(paper, paper, paper, 255))
    // Five small glyph strokes cover less than 0.5% of the page.
    for (let glyph = 0; glyph < 5; glyph += 1) {
      for (let y = 156; y < 164; y += 1) {
        for (let x = 90 + glyph * 12; x < 96 + glyph * 12; x += 1) {
          source.data.set([24, 24, 24, 255], (y * source.cols + x) * 4)
        }
      }
    }
    const output = processEffects(cv, source, { ...SMART_EFFECTS, color }, DEFAULT_ADJUSTMENTS)
    try {
      expect(output.data[0]).toBeGreaterThan(240)
      for (let glyph = 0; glyph < 5; glyph += 1) {
        const offset = (160 * source.cols + 93 + glyph * 12) * 4
        expect(output.data[offset]).toBeLessThan(50)
      }
    } finally {
      output.delete()
      source.delete()
    }
  })

  it('keeps a blank white page white', () => {
    const source = new cv.Mat(320, 240, cv.CV_8UC4, new cv.Scalar(255, 255, 255, 255))
    const output = processEffects(cv, source, { ...SMART_EFFECTS, color }, DEFAULT_ADJUSTMENTS)
    try {
      for (let index = 0; index < output.data.length; index += 4) {
        expect(output.data[index]).toBeGreaterThan(240)
      }
    } finally {
      output.delete()
      source.delete()
    }
  })
})

describe.each(['original', 'enhanced-color', 'grayscale', 'black-white'] as const)(
  '%s tone adjustments',
  (color) => {
    it('changes final brightness in both the full and cached pipelines', () => {
      const source = new cv.Mat(120, 120, cv.CV_8UC4, new cv.Scalar(210, 210, 210, 255))
      for (let y = 0; y < 120; y += 1) {
        for (let x = 0; x < 40; x += 1) {
          const value = x < 12 ? 40 : 120
          source.data.set([value, value, value, 255], (y * source.cols + x) * 4)
        }
      }
      const effects = { ...ORIGINAL_EFFECTS, shadow: 'balance' as const, color }
      const adjustments = { ...DEFAULT_ADJUSTMENTS, shadowStrength: 0 }
      const lighting = createLightingResult(cv, source, effects, adjustments)
      const samples: number[] = []
      try {
        for (const brightness of [0, 10, 20]) {
          const settings = { ...adjustments, brightness }
          const full = processEffects(cv, source, effects, settings)
          const cached = processEffectsFromLighting(cv, lighting, effects, settings)
          try {
            expect(cached.data).toEqual(full.data)
            samples.push(full.data[(60 * source.cols + 26) * 4])
          } finally {
            full.delete()
            cached.delete()
          }
        }
        expect(samples[1] - samples[0]).toBe(10)
        expect(samples[2] - samples[0]).toBe(20)
        expect(source.data[(60 * source.cols + 26) * 4]).toBe(120)
      } finally {
        lighting.delete()
        source.delete()
      }
    })
  },
)
