import type { Grade } from '@shared/card'
import { db } from './db'
import { gradeSrs } from './fsrs'
import type { Card } from './types'

/** Returns due cards oldest-first, without changing anything in storage. */
export async function loadDueCards(now = new Date()): Promise<Card[]> {
  return await db.cards.where('srs.due').belowOrEqual(now).sortBy('srs.due')
}

/**
 * Records a grade and schedules the next review. The grade is kept alongside
 * the FSRS state so the card can show how it was last rated.
 */
export async function gradeCard(
  cardId: string,
  grade: Grade,
  now = new Date()
): Promise<Card> {
  const card = await db.cards.get(cardId)
  if (!card) throw new Error(`Card ${cardId} was not found.`)

  const updated: Card = {
    ...card,
    srs: { ...gradeSrs(card.srs, grade, now), lastGrade: grade }
  }
  await db.cards.put(updated)
  return updated
}
