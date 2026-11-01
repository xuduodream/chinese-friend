import express, { type Express } from 'express'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { analyzeImage as analyzeImageDefault } from './analyze'
import { AppError, sendError } from './errors'
import { parseImageDataUrl, type ImagePayload } from './http'
import { synthesizeSpeech as synthesizeSpeechDefault } from './tts'
import {
  analyzeRequestSchema,
  ttsRequestSchema,
  type Draft,
  type TtsRequest
} from '@shared/card'

export interface AppDependencies {
  analyzeImage?: (image: ImagePayload) => Promise<Draft>
  synthesizeSpeech?: (input: TtsRequest) => Promise<Buffer>
}

export function createApp(deps: AppDependencies = {}): Express {
  const analyzeImage = deps.analyzeImage ?? analyzeImageDefault
  const synthesizeSpeech = deps.synthesizeSpeech ?? synthesizeSpeechDefault
  const app = express()

  app.use(express.json({ limit: '12mb' }))

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true })
  })

  app.post('/api/analyze', async (req, res) => {
    if (!req.is('application/json')) {
      res.status(415).json({
        error: { code: 'UNSUPPORTED_CONTENT_TYPE', message: 'Send application/json.' }
      })
      return
    }

    const request = analyzeRequestSchema.safeParse(req.body)
    if (!request.success) {
      res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Send { "image": "data:image/jpeg;base64,..." } under the size limit.'
        }
      })
      return
    }

    try {
      const image = parseImageDataUrl(request.data.image)
      const draft = await analyzeImage(image)
      res.json(draft)
    } catch (error) {
      sendError(res, error)
    }
  })

  app.post('/api/tts', async (req, res) => {
    if (!req.is('application/json')) {
      res.status(415).json({
        error: { code: 'UNSUPPORTED_CONTENT_TYPE', message: 'Send application/json.' }
      })
      return
    }

    const request = ttsRequestSchema.safeParse(req.body)
    if (!request.success) {
      res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Send { "chinese": "...", "reading": "..." }'
        }
      })
      return
    }

    try {
      const audio = await synthesizeSpeech(request.data)
      res.setHeader('Content-Type', 'audio/wav')
      res.setHeader('Cache-Control', 'no-store')
      res.send(audio)
    } catch (error) {
      sendError(res, error)
    }
  })

  // In production one process serves both the API and the built client.
  const distDir = path.resolve(process.cwd(), 'dist')
  if (existsSync(distDir)) {
    app.use(express.static(distDir))
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) {
        next()
        return
      }
      res.sendFile(path.join(distDir, 'index.html'))
    })
  }

  // Express body-parser errors (for example, a payload over the limit).
  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      if (error instanceof AppError) {
        sendError(res, error)
        return
      }
      if ((error as { type?: string }).type === 'entity.too.large') {
        res.status(413).json({
          error: { code: 'IMAGE_TOO_LARGE', message: 'That image is too large. Try a smaller one.' }
        })
        return
      }
      if ((error as { type?: string }).type === 'entity.parse.failed') {
        res.status(400).json({
          error: { code: 'INVALID_JSON', message: 'The request body is not valid JSON.' }
        })
        return
      }
      next(error)
    }
  )

  return app
}
