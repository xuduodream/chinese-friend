import { createEmptyCard, fsrs, generatorParameters, Rating, type Card } from 'ts-fsrs'
import type { Grade } from '@shared/card'

const scheduler = fsrs(generatorParameters({ enable_fuzz: false }))

const RATINGS = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy
} as const satisfies Record<Grade, Rating>

export function newSrs(now = new Date()): Card {
  return createEmptyCard(now)
}

export function gradeSrs(srs: Card, grade: Grade, now = new Date()): Card {
  const record = scheduler.repeat(srs, now)
  return record[RATINGS[grade]].card
}

export function isDue(srs: Card, now = new Date()): boolean {
  return srs.due.getTime() <= now.getTime()
}
