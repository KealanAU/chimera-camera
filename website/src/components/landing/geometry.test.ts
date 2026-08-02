import { describe, expect, test } from 'vitest'
import type { LandingLayerId, Offset } from '@/components/landing/constants'
import {
  getFrontLayerObjectPositionXPercent,
  hitTestLayers,
} from '@/components/landing/geometry'

const ZERO_OFFSETS: Record<LandingLayerId, Offset> = {
  back: { x: 0, y: 0 },
  mid: { x: 0, y: 0 },
  lynx: { x: 0, y: 0 },
  front: { x: 0, y: 0 },
}

function hitAt(normalizedX: number, normalizedY: number) {
  return hitTestLayers(normalizedX, normalizedY, 1000, 1000, ZERO_OFFSETS, 50)
}

describe('landing geometry', () => {
  test('keeps centered object position for invalid aspect ratios', () => {
    expect(getFrontLayerObjectPositionXPercent(null)).toBe(50)
    expect(getFrontLayerObjectPositionXPercent(Number.NaN)).toBe(50)
  })

  test('biases the front layer as the aspect ratio narrows', () => {
    const wide = getFrontLayerObjectPositionXPercent(2)
    const narrow = getFrontLayerObjectPositionXPercent(0.6)

    expect(wide).toBe(50)
    expect(narrow).toBeLessThan(wide)
  })

  test('resolves the sky to the back layer', () => {
    expect(hitAt(0.5, 0.2)).toBe('back')
  })

  test('resolves the rolling hills to the mid layer', () => {
    expect(hitAt(0.5, 0.6)).toBe('mid')
  })

  test('resolves the lynx tap target in front of the mid layer', () => {
    expect(hitAt(0.4575, 0.689)).toBe('lynx')
  })

  test('resolves the lower center of the frame to the front layer', () => {
    expect(hitAt(0.5, 0.95)).toBe('front')
  })
})
