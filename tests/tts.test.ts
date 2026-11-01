import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  synthesizeSpeech,
  synthesizeSpeechWith,
  toNumberedReading,
  type FetchLike
} from '../server/tts'

const config = { url: 'http://127.0.0.1:7862' }

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('toNumberedReading', () => {
  it('keeps numbered, syllable-separated pinyin as-is', () => {
    expect(toNumberedReading('yin2 hang2')).toBe('yin2 hang2')
  })

  it('converts tone-marked pinyin to tone numbers', () => {
    expect(toNumberedReading('nǐ hǎo')).toBe('ni3 hao3')
    expect(toNumberedReading('yín háng')).toBe('yin2 hang2')
  })

  it('maps ü to v', () => {
    expect(toNumberedReading('lǜ')).toBe('lv4')
  })

  it('marks neutral tones as tone 5', () => {
    expect(toNumberedReading('de')).toBe('de5')
    expect(toNumberedReading('xiè xie')).toBe('xie4 xie5')
  })
})

describe('synthesizeSpeechWith', () => {
  it('posts the text and numbered reading to the sidecar', async () => {
    const fetchImpl: FetchLike = vi.fn(async () =>
      new Response(new Uint8Array([1, 2, 3]), { status: 200 })
    )

    const audio = await synthesizeSpeechWith(fetchImpl, config, {
      chinese: '银行',
      reading: 'yín háng'
    })

    expect(audio).toEqual(Buffer.from([1, 2, 3]))
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0] ?? []
    expect(url).toBe('http://127.0.0.1:7862/tts')
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json' })
    expect(JSON.parse(String(init?.body))).toEqual({
      chinese: '银行',
      reading: 'yin2 hang2'
    })
  })

  it('tolerates a trailing slash in the configured URL', async () => {
    const fetchImpl: FetchLike = vi.fn(async () => new Response(new Uint8Array([1]), { status: 200 }))

    await synthesizeSpeechWith(fetchImpl, { url: 'http://127.0.0.1:7862/' }, {
      chinese: '行',
      reading: 'xing2'
    })

    expect(vi.mocked(fetchImpl).mock.calls[0]?.[0]).toBe('http://127.0.0.1:7862/tts')
  })

  it('reports a sidecar error with its message', async () => {
    const fetchImpl: FetchLike = vi.fn(async () =>
      new Response(JSON.stringify({ error: { code: 'TTS_FAILED', message: 'voice missing' } }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    )

    await expect(
      synthesizeSpeechWith(fetchImpl, config, { chinese: '银行', reading: 'yin2 hang2' })
    ).rejects.toMatchObject({ status: 502, code: 'TTS_FAILED', message: 'voice missing' })
  })

  it('reports an unreachable sidecar', async () => {
    const fetchImpl: FetchLike = vi.fn(async () => {
      throw new Error('offline')
    })

    await expect(
      synthesizeSpeechWith(fetchImpl, config, { chinese: '银行', reading: 'yin2 hang2' })
    ).rejects.toMatchObject({ status: 503, code: 'TTS_UNAVAILABLE' })
  })

  it('reports an empty audio response', async () => {
    const fetchImpl: FetchLike = vi.fn(async () => new Response(new Uint8Array(), { status: 200 }))

    await expect(
      synthesizeSpeechWith(fetchImpl, config, { chinese: '银行', reading: 'yin2 hang2' })
    ).rejects.toMatchObject({ status: 502, code: 'TTS_FAILED' })
  })
})

describe('synthesizeSpeech configuration', () => {
  it('uses TTS_URL when it is set', async () => {
    vi.stubEnv('TTS_URL', 'http://tts.local:9000')
    const fetchImpl = vi.fn<FetchLike>(
      async () => new Response(new Uint8Array([1]), { status: 200 })
    )
    vi.stubGlobal('fetch', fetchImpl)

    await synthesizeSpeech({ chinese: '行', reading: 'xing2' })

    expect(fetchImpl.mock.calls[0]?.[0]).toBe('http://tts.local:9000/tts')
  })
})
