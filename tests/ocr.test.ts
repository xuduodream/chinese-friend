import { describe, expect, it, vi } from 'vitest'
import { pinyinWith, recognizeWith, type FetchLike } from '../server/ocr'

const image = { mimeType: 'image/png' as const, data: 'aW1hZ2U=' }

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

describe('recognizeWith', () => {
  it('posts the image and returns the recognized text', async () => {
    const fetchImpl = vi.fn<FetchLike>(async () =>
      jsonResponse({ chinese: '银行', pinyin: 'yín háng', reading: 'yin2 hang2' })
    )

    const result = await recognizeWith(fetchImpl, 'http://ocr', image)

    expect(result).toEqual({ chinese: '银行', pinyin: 'yín háng', reading: 'yin2 hang2' })
    const [url, init] = fetchImpl.mock.calls[0] ?? []
    expect(url).toBe('http://ocr/ocr')
    expect(JSON.parse(String(init?.body))).toEqual({
      image: 'aW1hZ2U=',
      mimeType: 'image/png'
    })
  })

  it('reports an unreachable sidecar as unavailable', async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => {
      throw new Error('connect ECONNREFUSED')
    })

    await expect(recognizeWith(fetchImpl, 'http://ocr', image)).rejects.toMatchObject({
      status: 503,
      code: 'OCR_UNAVAILABLE'
    })
  })

  it('reports a sidecar error response as a failure', async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => jsonResponse({ error: 'boom' }, 500))

    await expect(recognizeWith(fetchImpl, 'http://ocr', image)).rejects.toMatchObject({
      status: 502,
      code: 'OCR_FAILED'
    })
  })

  it('rejects a malformed sidecar payload', async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => jsonResponse({ chinese: '银行' }))

    await expect(recognizeWith(fetchImpl, 'http://ocr', image)).rejects.toMatchObject({
      status: 502,
      code: 'OCR_FAILED'
    })
  })

  it('rejects a non-JSON body', async () => {
    const fetchImpl = vi.fn<FetchLike>(
      async () => new Response('not json', { status: 200 })
    )

    await expect(recognizeWith(fetchImpl, 'http://ocr', image)).rejects.toMatchObject({
      status: 502,
      code: 'OCR_FAILED'
    })
  })
})

describe('pinyinWith', () => {
  it('returns pinyin for the given text', async () => {
    const fetchImpl = vi.fn<FetchLike>(async () =>
      jsonResponse({ pinyin: 'nǐ hǎo', reading: 'ni3 hao3' })
    )

    const result = await pinyinWith(fetchImpl, 'http://ocr', '你好')

    expect(result).toEqual({ pinyin: 'nǐ hǎo', reading: 'ni3 hao3' })
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toEqual({ text: '你好' })
  })
})
