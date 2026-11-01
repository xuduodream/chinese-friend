import { describe, expect, it } from 'vitest'
import { calculateDimensions, isSupportedImage, MAX_EDGE } from '@/lib/image'

describe('isSupportedImage', () => {
  it('accepts the image types the server understands', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/gif']) {
      expect(isSupportedImage(new File(['x'], 'screenshot', { type }))).toBe(true)
    }
  })

  it('rejects other files', () => {
    expect(isSupportedImage(new File(['x'], 'notes.pdf', { type: 'application/pdf' }))).toBe(false)
    expect(isSupportedImage(new File(['x'], 'no-type'))).toBe(false)
  })
})

describe('calculateDimensions', () => {
  it('leaves images within the limit unchanged', () => {
    expect(calculateDimensions(1200, 800)).toEqual({ width: 1200, height: 800 })
    expect(calculateDimensions(MAX_EDGE, 10)).toEqual({ width: MAX_EDGE, height: 10 })
  })

  it('scales a tall screenshot down to the longest edge', () => {
    expect(calculateDimensions(1170, 2532)).toEqual({ width: 832, height: 1800 })
  })

  it('scales a wide screenshot down to the longest edge', () => {
    expect(calculateDimensions(4000, 1000)).toEqual({ width: 1800, height: 450 })
  })

  it('never rounds a dimension down to zero', () => {
    expect(calculateDimensions(10000, 1)).toEqual({ width: 1800, height: 1 })
  })

  it('honours a custom limit', () => {
    expect(calculateDimensions(2000, 1000, 500)).toEqual({ width: 500, height: 250 })
  })
})
