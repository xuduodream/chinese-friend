import { toPinyinToneNumbers } from 'pinyin-tone2'
import type { TtsRequest } from '@shared/card'
import { AppError } from './errors'

const DEFAULT_TTS_URL = 'http://127.0.0.1:7862'
const PROVIDER_TIMEOUT_MS = 30_000

/**
 * The analysis step returns syllable-separated numbered pinyin such as
 * "yin2 hang2". Tone-marked input is accepted too, but must keep its spaces so
 * each syllable can be converted independently.
 */
export function toNumberedReading(reading: string): string {
  const normalized = reading.trim().replace(/\s+/g, ' ')
  if (/[1-5]/.test(normalized)) return normalized.toLowerCase()
  // The sidecar expects a tone digit on every syllable; 5 is the neutral tone.
  return toPinyinToneNumbers(normalized, { neutralToneNumber: '5' })
}

export interface TtsConfig {
  url: string
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>

export async function synthesizeSpeechWith(
  fetchImpl: FetchLike,
  config: TtsConfig,
  input: TtsRequest
): Promise<Buffer> {
  const url = `${config.url.replace(/\/+$/, '')}/tts`

  let response: Response
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chinese: input.chinese,
        reading: toNumberedReading(input.reading)
      }),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS)
    })
  } catch (error) {
    throw new AppError(
      503,
      'TTS_UNAVAILABLE',
      'The local TTS sidecar is not running. Start it with `npm run tts:dev`.',
      error
    )
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { message?: string }
    } | null
    throw new AppError(
      502,
      'TTS_FAILED',
      payload?.error?.message ?? `The speech sidecar returned ${response.status}. Try again.`
    )
  }

  const audio = Buffer.from(await response.arrayBuffer())
  if (audio.length === 0) {
    throw new AppError(502, 'TTS_FAILED', 'The speech sidecar returned no audio.')
  }
  return audio
}

/** Real sidecar used by the server unless a test injects one. */
export async function synthesizeSpeech(input: TtsRequest): Promise<Buffer> {
  return synthesizeSpeechWith(
    fetch,
    { url: process.env.TTS_URL ?? DEFAULT_TTS_URL },
    input
  )
}
