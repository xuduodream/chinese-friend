import { describe, expect, it } from 'vitest'
import { createCardFromDraft } from '@/lib/cards'
import type { Draft } from '@shared/card'

const draft: Draft = {
  chinese: '请问，洗手间在哪里？',
  pinyin: 'qǐngwèn, xǐshǒujiān zài nǎlǐ?',
  english: 'Excuse me, where is the restroom?',
  explanation: 'A polite way to ask where the restroom is.',
  exampleChinese: '洗手间在那边。',
  examplePinyin: 'xǐ shǒu jiān zài nà biān.',
  exampleEnglish: 'The restroom is over there.',
  reading: 'qing3 wen4 xi3 shou3 jian1 zai4 na3 li3'
}

describe('createCardFromDraft', () => {
  it('copies the confirmed draft into a new card', () => {
    const now = new Date('2026-01-02T03:04:05Z')
    const card = createCardFromDraft(draft, now, 'card-1')

    expect(card).toMatchObject({ ...draft, id: 'card-1' })
    expect(card.createdAt).toBe(now)
  })

  it('starts without audio so it can be generated next', () => {
    const card = createCardFromDraft(draft)
    expect(card.audioStatus).toBe('missing')
    expect(card.audioBlob).toBeUndefined()
  })

  it('starts the review schedule at the creation time', () => {
    const now = new Date('2026-01-02T03:04:05Z')
    const card = createCardFromDraft(draft, now)

    expect(card.srs.due).toEqual(now)
    expect(card.srs.reps).toBe(0)
  })

  it('generates a unique id when none is given', () => {
    const first = createCardFromDraft(draft)
    const second = createCardFromDraft(draft)
    expect(first.id).not.toBe(second.id)
  })
})
