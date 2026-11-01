import { AppError } from './errors'

export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const

export type SupportedImageType = (typeof SUPPORTED_IMAGE_TYPES)[number]

export interface ImagePayload {
  mimeType: SupportedImageType
  data: string
}

const DATA_URL = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/

export function parseImageDataUrl(value: string): ImagePayload {
  const match = DATA_URL.exec(value.trim())
  if (!match) {
    throw new AppError(
      400,
      'INVALID_IMAGE',
      'Send the image as a data URL: data:image/jpeg;base64,...'
    )
  }

  const data = match[2].replace(/\s/g, '')
  if (data.length === 0) {
    throw new AppError(400, 'INVALID_IMAGE', 'The image data is empty.')
  }

  return { mimeType: match[1] as SupportedImageType, data }
}
