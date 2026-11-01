import { toPinyinToneNumbers } from 'pinyin-tone2'
import type { TtsRequest } from '@shared/card'
import { AppError } from './errors'

const DEFAULT_VOICE = 'zh-CN-XiaoxiaoNeural'
const DEFAULT_OUTPUT = 'audio-24khz-48kbitrate-mono-mp3'
const PROVIDER_TIMEOUT_MS = 20_000

/**
 * The analysis step returns syllable-separated numbered pinyin such as
 * "yin2 hang2". Tone-marked input is accepted too, but must keep its spaces so
 * each syllable can be converted independently.
 */
export function toSapiReading(reading: string): string {
  const normalized = reading.trim().replace(/\s+/g, ' ')
  if (/[1-5]/.test(normalized)) return normalized.toLowerCase()
  // SAPI pinyin expects a tone digit on every syllable; 5 is the neutral tone.
  return toPinyinToneNumbers(normalized, { neutralToneNumber: '5' })
}

/** Isolated words are where context-free TTS guesses a polyphone wrong. */
export function shouldUsePhoneme(chinese: string, sapiReading: string): boolean {
  if (process.env.AZURE_SSML_MODE === 'plain') return false
  const wordLike = [...chinese].length <= 6
  const readingLike = /^[a-z0-9\s]+$/i.test(sapiReading)
  return wordLike && readingLike
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function buildSsml(input: TtsRequest, voice = DEFAULT_VOICE): string {
  const reading = toSapiReading(input.reading)
  const body = shouldUsePhoneme(input.chinese, reading)
    ? `<phoneme alphabet="sapi" ph="${escapeXml(reading)}">${escapeXml(input.chinese)}</phoneme>`
    : escapeXml(input.chinese)

  return [
    '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN">',
    `  <voice name="${escapeXml(voice)}">${body}</voice>`,
    '</speak>'
  ].join('\n')
}

export interface TtsConfig {
  key: string
  region: string
  voice: string
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>

export async function synthesizeSpeechWith(
  fetchImpl: FetchLike,
  config: TtsConfig,
  input: TtsRequest
): Promise<Buffer> {
  const url = `https://${config.region}.tts.speech.microsoft.com/cognitiveservices/v1`

  let response: Response
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': config.key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': DEFAULT_OUTPUT,
        'User-Agent': 'chinese-friend'
      },
      body: buildSsml(input, config.voice),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS)
    })
  } catch (error) {
    throw new AppError(502, 'TTS_FAILED', 'The speech provider could not be reached.', error)
  }

  if (!response.ok) {
    throw new AppError(
      502,
      'TTS_FAILED',
      `The speech provider returned ${response.status}. Try generating the audio again.`
    )
  }

  const audio = Buffer.from(await response.arrayBuffer())
  if (audio.length === 0) {
    throw new AppError(502, 'TTS_FAILED', 'The speech provider returned no audio.')
  }
  return audio
}

/** Real provider used by the server unless a test injects one. */
export async function synthesizeSpeech(input: TtsRequest): Promise<Buffer> {
  const key = process.env.AZURE_SPEECH_KEY
  const region = process.env.AZURE_SPEECH_REGION
  if (!key || !region) {
    throw new AppError(
      503,
      'TTS_NOT_CONFIGURED',
      'AZURE_SPEECH_KEY and AZURE_SPEECH_REGION are not set on the server.'
    )
  }

  return synthesizeSpeechWith(fetch, {
    key,
    region,
    voice: process.env.AZURE_SPEECH_VOICE ?? DEFAULT_VOICE
  }, input)
}
