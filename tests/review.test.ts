import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Draft } from '@shared/card'
import { createCardFromDraft } from '@/lib/cards'
import { db } from '@/lib/db'
import { gradeCard, loadDueCards } from '@/lib/review'

const draft: Draft = {
  chinese: '银行',
  pinyin: 'yínháng',
  english: 'bank',
  explanation: 'A bank; used here for the financial institution.',
  exampleChinese: '我去银行取钱。',
  examplePinyin: 'wǒ qù yín háng qǔ qián.',
  exampleEnglish: 'I am going to the bank to withdraw money.',
  reading: 'yin2 hang2'
}

const NOW = new Date('2026-02-01T12:00:00Z')

function storedCard(id: string, due: Date) {
  const card = createCardFromDraft(draft, new Date('2026-01-01T12:00:00Z'), id)
  card.srs.due = due
  return card
}

beforeEach(async () => {
  await db.cards.clear()
})

describe('loadDueCards', () => {
  it('returns only cards whose due time has passed, oldest first', async () => {
    await db.cards.bulkPut([
      storedCard('future', new Date('2026-02-02T12:00:00Z')),
      storedCard('recent', new Date('2026-02-01T11:00:00Z')),
      storedCard('old', new Date('2026-01-20T12:00:00Z'))
    ])

    const due = await loadDueCards(NOW)

    expect(due.map((card) => card.id)).toEqual(['old', 'recent'])
  })

  it('treats a card due exactly now as due', async () => {
    await db.cards.put(storedCard('now', NOW))

    expect((await loadDueCards(NOW)).map((card) => card.id)).toEqual(['now'])
  })

  it('does not change stored cards', async () => {
    await db.cards.put(storedCard('old', new Date('2026-01-20T12:00:00Z')))
    const before = await db.cards.get('old')

    await loadDueCards(NOW)

    expect(await db.cards.get('old')).toEqual(before)
  })
})

describe('gradeCard', () => {
  it('records the grade and schedules the next review', async () => {
    await db.cards.put(storedCard('card-1', new Date('2026-01-20T12:00:00Z')))

    const updated = await gradeCard('card-1', 'good', NOW)

    expect(updated.srs.lastGrade).toBe('good')
    expect(updated.srs.reps).toBe(1)
    expect(updated.srs.last_review).toEqual(NOW)
    expect(updated.srs.due.getTime()).toBeGreaterThan(NOW.getTime())

    const stored = await db.cards.get('card-1')
    expect(stored?.srs).toEqual(updated.srs)
    expect(stored?.srs.due).toBeInstanceOf(Date)
  })

  it('removes a graded card from the due list without changing it again', async () => {
    await db.cards.put(storedCard('card-1', new Date('2026-01-20T12:00:00Z')))

    const graded = await gradeCard('card-1', 'good', NOW)
    const firstRead = await db.cards.get('card-1')

    expect(await loadDueCards(NOW)).toEqual([])

    // Revisiting (reading the card again) leaves the grade and due time alone.
    const secondRead = await db.cards.get('card-1')
    expect(secondRead).toEqual(firstRead)
    expect(secondRead?.srs.due).toEqual(graded.srs.due)
  })

  it('grades each rating without errors', async () => {
    for (const grade of ['again', 'hard', 'good', 'easy'] as const) {
      await db.cards.put(storedCard(`card-${grade}`, new Date('2026-01-20T12:00:00Z')))
      const updated = await gradeCard(`card-${grade}`, grade, NOW)
      expect(updated.srs.lastGrade).toBe(grade)
    }
  })

  it('rejects an unknown card', async () => {
    await expect(gradeCard('missing', 'good', NOW)).rejects.toThrow('was not found')
  })
})
