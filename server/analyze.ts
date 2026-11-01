import { aiAnnotationSchema, type AiAnnotation, type Draft } from '@shared/card'
import { AppError } from './errors'
import type { ImagePayload } from './http'
import { ocrService as defaultOcrService, type OcrService } from './ocr'

const DEFAULT_MODEL = 'deepseek-chat'
const DEFAULT_BASE_URL = 'https://api.deepseek.com'
const PROVIDER_TIMEOUT_MS = 30_000
const CJK = /[㐀-䶿一-鿿豈-﫿]/

const ANNOTATION_PROMPT = `You help a Chinese learner understand one piece of Chinese text.

Return a JSON object with exactly these fields:
- english: a natural English translation of the Chinese text
- explanation: one or two short sentences explaining the meaning or usage for a learner
- exampleChinese: one new, simple Chinese sentence that uses the text naturally and is different from the input
- exampleEnglish: the English translation of exampleChinese

Rules:
- Base everything on the provided Chinese text and do not rewrite it.
- Do not include pinyin or pronunciation; it is computed separately.
- Return only the JSON object, with no markdown or commentary.`

export interface TextCompletionParams {
  model: string
  system: string
  user: string
}

/** Returns the model's raw message content, or throws on a provider failure. */
export type TextCompletion = (params: TextCompletionParams) => Promise<string>

function userMessage(chinese: string): string {
  return `Chinese text:\n"""\n${chinese}\n"""`
}

/** Models occasionally wrap JSON in a fenced block despite json_object mode. */
function parseJsonContent(content: string): unknown {
  const trimmed = content.trim()
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed)
  return JSON.parse(fenced ? fenced[1] : trimmed)
}

/**
 * Runs local OCR, then one text-only model call. The image itself is never
 * included in the model request; only the recognized Chinese text is.
 */
export async function analyzeImageWith(
  ocr: OcrService,
  complete: TextCompletion,
  image: ImagePayload,
  model = DEFAULT_MODEL
): Promise<Draft> {
  const recognized = await ocr.recognize(image)
  if (!CJK.test(recognized.chinese)) {
    throw new AppError(422, 'NO_CHINESE_TEXT', 'No Chinese text was found in this image.')
  }

  let malformed: unknown

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let content: string
    try {
      content = await complete({
        model,
        system: ANNOTATION_PROMPT,
        user: userMessage(recognized.chinese)
      })
    } catch (error) {
      if (error instanceof AppError) throw error
      throw new AppError(
        502,
        'ANALYSIS_FAILED',
        'The AI provider could not annotate this text.',
        error
      )
    }

    let annotation: AiAnnotation
    try {
      const parsed = aiAnnotationSchema.safeParse(parseJsonContent(content))
      if (!parsed.success) {
        malformed = parsed.error
        continue
      }
      annotation = parsed.data
    } catch (error) {
      malformed = error
      continue
    }

    const example = await ocr.pinyin(annotation.exampleChinese)

    return {
      chinese: recognized.chinese,
      pinyin: recognized.pinyin,
      english: annotation.english,
      explanation: annotation.explanation,
      exampleChinese: annotation.exampleChinese,
      examplePinyin: example.pinyin,
      exampleEnglish: annotation.exampleEnglish,
      reading: recognized.reading
    }
  }

  throw new AppError(
    502,
    'ANALYSIS_FAILED',
    'The AI provider returned an unreadable response. Try the screenshot again.',
    malformed
  )
}

function completionUrl(): string {
  return `${(process.env.DEEPSEEK_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '')}/chat/completions`
}

async function completeWithDeepSeek(params: TextCompletionParams): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    throw new AppError(
      503,
      'ANALYSIS_NOT_CONFIGURED',
      'DEEPSEEK_API_KEY is not set on the server.'
    )
  }

  let response: Response
  try {
    response = await fetch(completionUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: params.model,
        messages: [
          { role: 'system', content: params.system },
          { role: 'user', content: params.user }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 900
      }),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS)
    })
  } catch (error) {
    throw new AppError(502, 'ANALYSIS_FAILED', 'The AI provider could not be reached.', error)
  }

  if (!response.ok) {
    throw new AppError(
      502,
      'ANALYSIS_FAILED',
      `The AI provider returned ${response.status}. Try the screenshot again.`
    )
  }

  const body = (await response.json().catch(() => null)) as {
    choices?: Array<{ message?: { content?: unknown } }>
  } | null
  const content = body?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || content.trim() === '') {
    throw new AppError(502, 'ANALYSIS_FAILED', 'The AI provider returned no text.')
  }
  return content
}

/** Real pipeline used by the server unless a test injects one. */
export async function analyzeImage(image: ImagePayload): Promise<Draft> {
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new AppError(
      503,
      'ANALYSIS_NOT_CONFIGURED',
      'DEEPSEEK_API_KEY is not set on the server.'
    )
  }

  return analyzeImageWith(
    defaultOcrService,
    completeWithDeepSeek,
    image,
    process.env.DEEPSEEK_MODEL ?? DEFAULT_MODEL
  )
}
