import { afterEach, describe, expect, it, vi } from 'vitest'
import { analyzeImage, analyzeImageWith, type TextCompletion } from '../server/analyze'
import { AppError } from '../server/errors'
import type { OcrService } from '../server/ocr'
import type { Draft } from '@shared/card'

const image = { mimeType: 'image/png' as const, data: 'aW1hZ2U=' }

const annotation = {
  english: 'hello',
  explanation: 'A common greeting.',
  exampleChinese: '你好吗？',
  exampleEnglish: 'How are you?'
}

const draft: Draft = {
  chinese: '你好',
  pinyin: 'nǐ hǎo',
  english: 'hello',
  explanation: 'A common greeting.',
  exampleChinese: '你好吗？',
  examplePinyin: 'nǐ hǎo ma',
  exampleEnglish: 'How are you?',
  reading: 'ni3 hao3'
}

function makeOcr(overrides: Partial<OcrService> = {}): OcrService {
  return {
    recognize: vi.fn(async () => ({ chinese: '你好', pinyin: 'nǐ hǎo', reading: 'ni3 hao3' })),
    pinyin: vi.fn(async () => ({ pinyin: 'nǐ hǎo ma', reading: 'ni3 hao3 ma5' })),
    ...overrides
  }
}

function makeCompletion(content: string | (() => Promise<string>)): TextCompletion {
  return typeof content === 'string' ? vi.fn(async () => content) : vi.fn(content)
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('analyzeImageWith', () => {
  it('merges local OCR and pinyin with the model annotation', async () => {
    const ocr = makeOcr()
    const complete = makeCompletion(JSON.stringify(annotation))

    const result = await analyzeImageWith(ocr, complete, image)

    expect(result).toEqual(draft)
    expect(ocr.recognize).toHaveBeenCalledWith(image)
    expect(ocr.pinyin).toHaveBeenCalledWith('你好吗？')
  })

  it('sends only the recognized text to the model, never the image', async () => {
    const complete = makeCompletion(JSON.stringify(annotation))

    await analyzeImageWith(makeOcr(), complete, image)

    const [request] = vi.mocked(complete).mock.calls[0] ?? []
    expect(request?.user).toContain('你好')
    expect(request?.user).not.toContain('aW1hZ2U=')
    expect(JSON.stringify(request)).not.toContain('base64')
  })

  it('retries once when the model returns malformed JSON', async () => {
    const complete = vi
      .fn<TextCompletion>()
      .mockResolvedValueOnce('not json')
      .mockResolvedValueOnce(JSON.stringify(annotation))

    const result = await analyzeImageWith(makeOcr(), complete, image)

    expect(result).toEqual(draft)
    expect(complete).toHaveBeenCalledTimes(2)
  })

  it('retries when the JSON is missing a required field', async () => {
    const complete = vi
      .fn<TextCompletion>()
      .mockResolvedValueOnce(JSON.stringify({ english: 'hello' }))
      .mockResolvedValueOnce(JSON.stringify(annotation))

    const result = await analyzeImageWith(makeOcr(), complete, image)

    expect(result).toEqual(draft)
    expect(complete).toHaveBeenCalledTimes(2)
  })

  it('accepts JSON wrapped in a fenced block', async () => {
    const complete = makeCompletion('```json\n' + JSON.stringify(annotation) + '\n```')

    const result = await analyzeImageWith(makeOcr(), complete, image)

    expect(result).toEqual(draft)
  })

  it('fails after two malformed responses', async () => {
    const complete = vi.fn<TextCompletion>().mockResolvedValue('{"english": 42}')

    await expect(analyzeImageWith(makeOcr(), complete, image)).rejects.toMatchObject({
      status: 502,
      code: 'ANALYSIS_FAILED'
    })
    expect(complete).toHaveBeenCalledTimes(2)
  })

  it('surfaces provider failures without retrying', async () => {
    const complete = vi.fn<TextCompletion>().mockRejectedValue(new Error('provider down'))

    await expect(analyzeImageWith(makeOcr(), complete, image)).rejects.toMatchObject({
      status: 502,
      code: 'ANALYSIS_FAILED'
    })
    expect(complete).toHaveBeenCalledTimes(1)
  })

  it('passes a configuration error through untouched', async () => {
    const complete = vi.fn<TextCompletion>().mockRejectedValue(
      new AppError(503, 'ANALYSIS_NOT_CONFIGURED', 'missing key')
    )

    await expect(analyzeImageWith(makeOcr(), complete, image)).rejects.toMatchObject({
      status: 503,
      code: 'ANALYSIS_NOT_CONFIGURED'
    })
  })

  it('reports an image with no Chinese text before calling the model', async () => {
    const ocr = makeOcr({
      recognize: vi.fn(async () => ({ chinese: 'Welcome', pinyin: '', reading: '' }))
    })
    const complete = makeCompletion(JSON.stringify(annotation))

    await expect(analyzeImageWith(ocr, complete, image)).rejects.toMatchObject({
      status: 422,
      code: 'NO_CHINESE_TEXT'
    })
    expect(complete).not.toHaveBeenCalled()
  })

  it('passes an unavailable OCR sidecar through', async () => {
    const ocr = makeOcr({
      recognize: vi.fn(async () => {
        throw new AppError(503, 'OCR_UNAVAILABLE', 'sidecar down')
      })
    })
    const complete = makeCompletion(JSON.stringify(annotation))

    await expect(analyzeImageWith(ocr, complete, image)).rejects.toMatchObject({
      status: 503,
      code: 'OCR_UNAVAILABLE'
    })
    expect(complete).not.toHaveBeenCalled()
  })

  it('fails the request when the example cannot be given pinyin', async () => {
    const ocr = makeOcr({
      pinyin: vi.fn(async () => {
        throw new AppError(502, 'OCR_FAILED', 'pinyin failed')
      })
    })

    await expect(
      analyzeImageWith(ocr, makeCompletion(JSON.stringify(annotation)), image)
    ).rejects.toMatchObject({ code: 'OCR_FAILED' })
  })
})

describe('analyzeImage', () => {
  it('reports missing configuration before touching the image', async () => {
    vi.stubEnv('DEEPSEEK_API_KEY', '')

    await expect(analyzeImage(image)).rejects.toMatchObject({
      status: 503,
      code: 'ANALYSIS_NOT_CONFIGURED'
    })
  })
})
