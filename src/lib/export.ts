import type { Grade } from '@shared/card'
import type { Card } from './types'

export const EXPORT_VERSION = 1

export interface ExportedReviewState {
  due: string
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  state: number
  last_review?: string
  lastGrade?: Grade
}

export interface ExportedCard {
  id: string
  chinese: string
  pinyin: string
  english: string
  explanation: string
  exampleChinese: string
  examplePinyin: string
  exampleEnglish: string
  reading: string
  createdAt: string
  review: ExportedReviewState
}

export interface CardExport {
  version: number
  exportedAt: string
  cards: ExportedCard[]
}

function toExportedCard(card: Card): ExportedCard {
  return {
    id: card.id,
    chinese: card.chinese,
    pinyin: card.pinyin,
    english: card.english,
    explanation: card.explanation,
    exampleChinese: card.exampleChinese,
    examplePinyin: card.examplePinyin,
    exampleEnglish: card.exampleEnglish,
    reading: card.reading,
    createdAt: card.createdAt.toISOString(),
    review: {
      due: card.srs.due.toISOString(),
      stability: card.srs.stability,
      difficulty: card.srs.difficulty,
      elapsed_days: card.srs.elapsed_days,
      scheduled_days: card.srs.scheduled_days,
      learning_steps: card.srs.learning_steps,
      reps: card.srs.reps,
      lapses: card.srs.lapses,
      state: card.srs.state,
      ...(card.srs.last_review ? { last_review: card.srs.last_review.toISOString() } : {}),
      ...(card.srs.lastGrade ? { lastGrade: card.srs.lastGrade } : {})
    }
  }
}

/**
 * Builds a text-only backup: audio blobs are left out because they can be
 * generated again from each card's reading.
 */
export function buildExport(cards: Card[], exportedAt = new Date()): CardExport {
  return {
    version: EXPORT_VERSION,
    exportedAt: exportedAt.toISOString(),
    cards: cards.map(toExportedCard)
  }
}

export function exportFilename(date = new Date()): string {
  return `chinese-friend-${date.toISOString().slice(0, 10)}.json`
}

export function downloadExport(
  payload: CardExport,
  filename = exportFilename(new Date(payload.exportedAt))
): string {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
  return filename
}
