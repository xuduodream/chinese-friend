export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const

export const MAX_EDGE = 1800

export function isSupportedImage(file: File): boolean {
  return (SUPPORTED_IMAGE_TYPES as readonly string[]).includes(file.type)
}

export function calculateDimensions(
  width: number,
  height: number,
  maxEdge = MAX_EDGE
): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= maxEdge) return { width, height }

  const scale = maxEdge / longest
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  }
}

/** Resizes a screenshot before upload so requests stay small and fast. */
export async function downscaleImage(file: File, maxEdge = MAX_EDGE): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const { width, height } = calculateDimensions(bitmap.width, bitmap.height, maxEdge)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    throw new Error('This browser cannot resize images.')
  }

  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.85)
}
