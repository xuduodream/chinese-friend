import { z } from 'zod'

/** Everything the learner sees for one captured image. */
export const draftSchema = z.object({
  chinese: z.string().max(500),
  pinyin: z.string().max(1000),
  english: z.string().max(2000),
  explanation: z.string().max(2000),
  exampleChinese: z.string().max(500),
  examplePinyin: z.string().max(1000),
  exampleEnglish: z.string().max(2000),
  reading: z.string().max(1000)
})

export type Draft = z.infer<typeof draftSchema>

/** The fields the text model returns; OCR and pinyin supply the rest. */
export const aiAnnotationSchema = z.object({
  english: z.string().trim().min(1).max(2000),
  explanation: z.string().trim().min(1).max(2000),
  exampleChinese: z.string().trim().min(1).max(500),
  exampleEnglish: z.string().trim().min(1).max(2000)
})

export type AiAnnotation = z.infer<typeof aiAnnotationSchema>

export const gradeSchema = z.enum(['again', 'hard', 'good', 'easy'])
export type Grade = z.infer<typeof gradeSchema>

/** An image sent as a data URL; size is capped by the server's body limit too. */
export const MAX_IMAGE_DATA_URL_LENGTH = 8_000_000

export const analyzeRequestSchema = z.object({
  image: z.string().min(1).max(MAX_IMAGE_DATA_URL_LENGTH)
})

export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>

export const ttsRequestSchema = z.object({
  chinese: z.string().min(1).max(500),
  reading: z.string().min(1).max(1000)
})

export type TtsRequest = z.infer<typeof ttsRequestSchema>
