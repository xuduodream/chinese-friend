import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildSsml,
  shouldUsePhoneme,
  synthesizeSpeech,
  synthesizeSpeechWith,
  toSapiReading,
  type FetchLike
} from '../server/tts'

const config = { key: 'test-key', region: 'westeurope', voice: 'zh-CN-XiaoxiaoNeural' }

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('toSapiReading', () => {
  it('keeps numbered, syllable-separated pinyin as-is', () => {
    expect(toSapiReading('yin2 hang2')).toBe('yin2 hang2')
  })

  it('converts tone-marked pinyin to tone numbers', () => {
    expect(toSapiReading('nǐ hǎo')).toBe('ni3 hao3')
    expect(toSapiReading('yín háng')).toBe('yin2 hang2')
  })

  it('maps ü to v', () => {
    expect(toSapiReading('lǜ')).toBe('lv4')
  })

  it('marks neutral tones as tone 5 for SAPI', () => {
    expect(toSapiReading('de')).toBe('de5')
    expect(toSapiReading('xiè xie')).toBe('xie4 xie5')
  })
})

describe('shouldUsePhoneme', () => {
  it('uses it for short word-like cards', () => {
    expect(shouldUsePhoneme('银行', 'yin2 hang2')).toBe(true)
  })

  it('skips it for longer sentences', () => {
    expect(shouldUsePhoneme('请问，洗手间在哪里？', 'qing3 wen4, xi3 shou3 jian1 zai4 na3 li3?')).toBe(false)
  })

  it('skips it when plain mode is forced', () => {
    vi.stubEnv('AZURE_SSML_MODE', 'plain')
    expect(shouldUsePhoneme('银行', 'yin2 hang2')).toBe(false)
  })
})

describe('buildSsml', () => {
  it('wraps an isolated word in a SAPI phoneme', () => {
    const ssml = buildSsml({ chinese: '银行', reading: 'yin2 hang2' }, config.voice)

    expect(ssml).toContain('<phoneme alphabet="sapi" ph="yin2 hang2">银行</phoneme>')
    expect(ssml).toContain('xml:lang="zh-CN"')
    expect(ssml).toContain('name="zh-CN-XiaoxiaoNeural"')
  })

  it('speaks longer text without a phoneme override', () => {
    const ssml = buildSsml(
      { chinese: '请问，洗手间在哪里？', reading: 'qing3 wen4, xi3 shou3 jian1 zai4 na3 li3?' },
      config.voice
    )

    expect(ssml).not.toContain('<phoneme')
    expect(ssml).toContain('请问，洗手间在哪里？')
  })

  it('escapes XML in text and phonemes', () => {
    const ssml = buildSsml({ chinese: 'A&B', reading: 'a' }, config.voice)

    expect(ssml).toContain('A&amp;B')
  })
})

describe('synthesizeSpeechWith', () => {
  it('returns the audio bytes from the provider', async () => {
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
    expect(url).toBe('https://westeurope.tts.speech.microsoft.com/cognitiveservices/v1')
    expect(init?.headers).toMatchObject({
      'Ocp-Apim-Subscription-Key': 'test-key',
      'Content-Type': 'application/ssml+xml'
    })
    expect(String(init?.body)).toContain('ph="yin2 hang2"')
  })

  it('reports a provider error', async () => {
    const fetchImpl: FetchLike = vi.fn(async () => new Response('nope', { status: 500 }))

    await expect(
      synthesizeSpeechWith(fetchImpl, config, { chinese: '银行', reading: 'yin2 hang2' })
    ).rejects.toMatchObject({ status: 502, code: 'TTS_FAILED' })
  })

  it('reports a network failure', async () => {
    const fetchImpl: FetchLike = vi.fn(async () => {
      throw new Error('offline')
    })

    await expect(
      synthesizeSpeechWith(fetchImpl, config, { chinese: '银行', reading: 'yin2 hang2' })
    ).rejects.toMatchObject({ status: 502, code: 'TTS_FAILED' })
  })

  it('reports an empty audio response', async () => {
    const fetchImpl: FetchLike = vi.fn(async () => new Response(new Uint8Array(), { status: 200 }))

    await expect(
      synthesizeSpeechWith(fetchImpl, config, { chinese: '银行', reading: 'yin2 hang2' })
    ).rejects.toMatchObject({ status: 502, code: 'TTS_FAILED' })
  })
})

describe('synthesizeSpeech configuration', () => {
  it('reports missing configuration', async () => {
    vi.stubEnv('AZURE_SPEECH_KEY', '')
    vi.stubEnv('AZURE_SPEECH_REGION', '')

    await expect(synthesizeSpeech({ chinese: '银行', reading: 'yin2 hang2' })).rejects.toMatchObject({
      status: 503,
      code: 'TTS_NOT_CONFIGURED'
    })
  })
})
