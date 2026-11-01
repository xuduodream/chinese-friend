import { z } from 'zod'
import { AppError } from './errors'
import type { ImagePayload } from './http'

const DEFAULT_OCR_URL = 'http://127.0.0.1:7861'
const OCR_TIMEOUT_MS = 30_000

export interface OcrResult {
  chinese: string
  pinyin: string
  reading: string
}

export interface PinyinResult {
  pinyin: string
  reading: string
}

export interface OcrService {
  recognize(image: ImagePayload): Promise<OcrResult>
  pinyin(text: string): Promise<PinyinResult>
}

const ocrResponseSchema = z.object({
  chinese: z.string(),
  pinyin: z.string(),
  reading: z.string()
})

const pinyinResponseSchema = z.object({
  pinyin: z.string(),
  reading: z.string()
})

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>

const NOT_RUNNING = 'Local OCR is not running. Start it with `npm run ocr:dev`.'

async function postJson(
  fetchImpl: FetchLike,
  url: string,
  body: unknown
): Promise<unknown> {
  let response: Response
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(OCR_TIMEOUT_MS)
    })
  } catch (error) {
    throw new AppError(503, 'OCR_UNAVAILABLE', NOT_RUNNING, error)
  }

  if (!response.ok) {
    throw new AppError(502, 'OCR_FAILED', `Local OCR returned ${response.status}.`)
  }

  try {
    return await response.json()
  } catch (error) {
    throw new AppError(502, 'OCR_FAILED', 'Local OCR returned an unreadable response.', error)
  }
}

export async function recognizeWith(
  fetchImpl: FetchLike,
  baseUrl: string,
  image: ImagePayload
): Promise<OcrResult> {
  const payload = await postJson(fetchImpl, `${baseUrl}/ocr`, {
    image: image.data,
    mimeType: image.mimeType
  })
  const parsed = ocrResponseSchema.safeParse(payload)
  if (!parsed.success) {
    throw new AppError(502, 'OCR_FAILED', 'Local OCR returned an unreadable response.')
  }
  return parsed.data
}

export async function pinyinWith(
  fetchImpl: FetchLike,
  baseUrl: string,
  text: string
): Promise<PinyinResult> {
  const payload = await postJson(fetchImpl, `${baseUrl}/pinyin`, { text })
  const parsed = pinyinResponseSchema.safeParse(payload)
  if (!parsed.success) {
    throw new AppError(502, 'OCR_FAILED', 'Local OCR returned unreadable pinyin.')
  }
  return parsed.data
}

function serviceUrl(): string {
  return (process.env.OCR_URL ?? DEFAULT_OCR_URL).replace(/\/$/, '')
}

/** Real sidecar used by the server unless a test injects one. */
export const ocrService: OcrService = {
  recognize: (image) => recognizeWith(fetch, serviceUrl(), image),
  pinyin: (text) => pinyinWith(fetch, serviceUrl(), text)
}
