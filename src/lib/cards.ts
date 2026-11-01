import type { Draft } from '@shared/card'
import { newSrs } from './fsrs'
import type { Card } from './types'

export function createCardFromDraft(
  draft: Draft,
  now = new Date(),
  id: string = crypto.randomUUID()
): Card {
  return {
    ...draft,
    id,
    audioStatus: 'missing',
    createdAt: now,
    srs: newSrs(now)
  }
}
