// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { downscaleImage, MAX_EDGE } from '@/lib/image'

const drawImage = vi.fn()
const close = vi.fn()
const createImageBitmap = vi.fn()
const toDataURL = vi.fn(() => 'data:image/jpeg;base64,resized')

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function stubBrowser(width: number, height: number): void {
  createImageBitmap.mockResolvedValue({ width, height, close })
  vi.stubGlobal('createImageBitmap', createImageBitmap)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage
  } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(toDataURL)
}

describe('downscaleImage', () => {
  it('resizes a large screenshot to the maximum edge before upload', async () => {
    stubBrowser(3600, 2400)

    const result = await downscaleImage(new File(['pixels'], 'shot.png', { type: 'image/png' }))

    expect(createImageBitmap).toHaveBeenCalledOnce()
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, MAX_EDGE, 1200)
    expect(toDataURL).toHaveBeenCalledWith('image/jpeg', 0.85)
    expect(result).toBe('data:image/jpeg;base64,resized')
    expect(close).toHaveBeenCalledOnce()
  })

  it('leaves an image that is already small enough unchanged', async () => {
    stubBrowser(800, 600)

    await downscaleImage(new File(['pixels'], 'shot.png', { type: 'image/png' }))

    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 800, 600)
  })

  it('honours a custom maximum edge', async () => {
    stubBrowser(2000, 1000)

    await downscaleImage(new File(['pixels'], 'shot.png', { type: 'image/png' }), 500)

    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 500, 250)
  })
})
