import { describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../server/app'
import { AppError } from '../server/errors'
import type { Draft } from '@shared/card'

const image = 'data:image/png;base64,aW1hZ2U='

const draft: Draft = {
  chinese: '你好',
  pinyin: 'nǐ hǎo',
  english: 'hello',
  explanation: 'A common greeting.',
  exampleChinese: '你好吗？',
  examplePinyin: 'nǐ hǎo ma',
  exampleEnglish: 'How are you?',
  reading: '你好'
}

describe('POST /api/analyze', () => {
  it('returns the draft for a valid image', async () => {
    const analyzeImage = vi.fn(async () => draft)
    const app = createApp({ analyzeImage })

    const response = await request(app).post('/api/analyze').send({ image })

    expect(response.status).toBe(200)
    expect(response.body).toEqual(draft)
    expect(analyzeImage).toHaveBeenCalledWith({ mimeType: 'image/png', data: 'aW1hZ2U=' })
  })

  it('rejects a missing image field', async () => {
    const analyzeImage = vi.fn()
    const app = createApp({ analyzeImage })

    const response = await request(app).post('/api/analyze').send({})

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('INVALID_REQUEST')
    expect(analyzeImage).not.toHaveBeenCalled()
  })

  it('rejects a non-JSON content type', async () => {
    const app = createApp({ analyzeImage: vi.fn() })

    const response = await request(app)
      .post('/api/analyze')
      .set('Content-Type', 'text/plain')
      .send('not json')

    expect(response.status).toBe(415)
  })

  it('rejects a value that is not an image data URL', async () => {
    const analyzeImage = vi.fn()
    const app = createApp({ analyzeImage })

    const response = await request(app).post('/api/analyze').send({ image: 'https://example.com/a.png' })

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('INVALID_IMAGE')
    expect(analyzeImage).not.toHaveBeenCalled()
  })

  it('rejects an image above the size cap', async () => {
    const app = createApp({ analyzeImage: vi.fn() })

    const response = await request(app)
      .post('/api/analyze')
      .send({ image: 'a'.repeat(8_000_001) })

    expect(response.status).toBe(400)
  })

  it('rejects a body above the parser limit', async () => {
    const app = createApp({ analyzeImage: vi.fn() })

    const response = await request(app)
      .post('/api/analyze')
      .send({ image: 'a'.repeat(13_500_000) })

    expect(response.status).toBe(413)
  })

  it('reports an image with no Chinese text', async () => {
    const analyzeImage = vi.fn(async () => {
      throw new AppError(422, 'NO_CHINESE_TEXT', 'No Chinese text was found in this image.')
    })
    const app = createApp({ analyzeImage })

    const response = await request(app).post('/api/analyze').send({ image })

    expect(response.status).toBe(422)
    expect(response.body.error.code).toBe('NO_CHINESE_TEXT')
  })

  it('reports provider failure', async () => {
    const analyzeImage = vi.fn(async () => {
      throw new AppError(502, 'ANALYSIS_FAILED', 'provider down')
    })
    const app = createApp({ analyzeImage })

    const response = await request(app).post('/api/analyze').send({ image })

    expect(response.status).toBe(502)
    expect(response.body.error.code).toBe('ANALYSIS_FAILED')
  })
})

describe('POST /api/tts', () => {
  const body = { chinese: '行', reading: 'xing2' }

  it('returns audio for a valid request', async () => {
    const synthesizeSpeech = vi.fn(async () => Buffer.from([1, 2, 3]))
    const app = createApp({ synthesizeSpeech })

    const response = await request(app).post('/api/tts').send(body).buffer(true)

    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toContain('audio/wav')
    expect(Buffer.isBuffer(response.body)).toBe(true)
    expect(response.body).toEqual(Buffer.from([1, 2, 3]))
    expect(synthesizeSpeech).toHaveBeenCalledWith(body)
  })

  it('rejects a missing reading', async () => {
    const synthesizeSpeech = vi.fn()
    const app = createApp({ synthesizeSpeech })

    const response = await request(app).post('/api/tts').send({ chinese: '行' })

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('INVALID_REQUEST')
    expect(synthesizeSpeech).not.toHaveBeenCalled()
  })

  it('rejects a non-JSON content type', async () => {
    const app = createApp({ synthesizeSpeech: vi.fn() })

    const response = await request(app)
      .post('/api/tts')
      .set('Content-Type', 'text/plain')
      .send('nope')

    expect(response.status).toBe(415)
  })

  it('reports an unavailable sidecar', async () => {
    const synthesizeSpeech = vi.fn(async () => {
      throw new AppError(503, 'TTS_UNAVAILABLE', 'sidecar down')
    })
    const app = createApp({ synthesizeSpeech })

    const response = await request(app).post('/api/tts').send(body)

    expect(response.status).toBe(503)
    expect(response.body.error.code).toBe('TTS_UNAVAILABLE')
  })

  it('reports provider failure', async () => {
    const synthesizeSpeech = vi.fn(async () => {
      throw new AppError(502, 'TTS_FAILED', 'provider down')
    })
    const app = createApp({ synthesizeSpeech })

    const response = await request(app).post('/api/tts').send(body)

    expect(response.status).toBe(502)
    expect(response.body.error.code).toBe('TTS_FAILED')
  })
})
