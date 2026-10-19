import { describe, expect, it } from 'vitest'
import { getIdCardSheetLayout } from '@/lib/id-card-layout'

describe('ID card sheet layout', () => {
  it('preserves physical card dimensions and a 15 mm gap on an A4 sheet', () => {
    for (const [width, height] of [
      [2480, 3508],
      [1240, 1754],
    ]) {
      const { front, back } = getIdCardSheetLayout(width, height)
      expect((front.width / width) * 210).toBeCloseTo(85.6, 5)
      expect((front.height / height) * 297).toBeCloseTo(53.98, 5)
      expect(((back.y - front.y - front.height) / height) * 297).toBeCloseTo(15, 5)
      expect(back.width).toBe(front.width)
      expect(back.x).toBe(front.x)
      expect(front.x * 2 + front.width).toBeCloseTo(width, 5)
      expect(back.y + back.height).toBeLessThan(height)
    }
  })
})
