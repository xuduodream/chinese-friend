import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createCardFromDraft } from '@/lib/cards'
import { ChineseFriendDb } from '@/lib/db'
import type { Draft } from '@shared/card'

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

let database: ChineseFriendDb

beforeEach(async () => {
  database = new ChineseFriendDb(`test-${crypto.randomUUID()}`)
  await database.open()
})

afterEach(async () => {
  database.close()
  await database.delete()
})

describe('card storage', () => {
  it('stores and reads a card by id', async () => {
    const card = createCardFromDraft(draft, new Date('2026-01-01T00:00:00Z'), 'card-1')
    await database.cards.put(card)

    const stored = await database.cards.get('card-1')
    expect(stored?.chinese).toBe('银行')
    expect(stored?.reading).toBe('yin2 hang2')
    expect(stored?.audioStatus).toBe('missing')
    expect(stored?.createdAt).toBeInstanceOf(Date)
    expect(stored?.srs.due).toBeInstanceOf(Date)
  })

  it('updates a card in place', async () => {
    const card = createCardFromDraft(draft, new Date(), 'card-1')
    await database.cards.put(card)
    await database.cards.put({ ...card, english: 'bank (financial)' })

    const stored = await database.cards.get('card-1')
    expect(stored?.english).toBe('bank (financial)')
    expect(await database.cards.count()).toBe(1)
  })

  it('stores and reads the audio blob with the card', async () => {
    const card = createCardFromDraft(draft, new Date(), 'card-with-audio')
    const audio = new Blob(['fake-mp3'], { type: 'audio/mpeg' })
    await database.cards.put({ ...card, audioBlob: audio, audioStatus: 'ready' })

    const stored = await database.cards.get('card-with-audio')
    expect(stored?.audioStatus).toBe('ready')
    expect(stored?.audioBlob).toBeInstanceOf(Blob)
    expect(stored?.audioBlob?.type).toBe('audio/mpeg')
    expect(await stored?.audioBlob?.text()).toBe('fake-mp3')
  })

  it('backfills the AI fields for cards saved before version 2', async () => {
    const name = `migrate-${crypto.randomUUID()}`
    const legacy = new Dexie(name)
    legacy.version(1).stores({ cards: 'id, srs.due, createdAt' })
    await legacy.open()
    await legacy.table('cards').put({
      id: 'legacy',
      chinese: '银行',
      pinyin: 'yínháng',
      english: 'bank',
      reading: 'yin2 hang2',
      audioStatus: 'missing',
      createdAt: new Date(),
      srs: { due: new Date() }
    })
    legacy.close()

    const upgraded = new ChineseFriendDb(name)
    await upgraded.open()
    const card = await upgraded.cards.get('legacy')

    expect(card).toMatchObject({
      explanation: '',
      exampleChinese: '',
      examplePinyin: '',
      exampleEnglish: ''
    })

    upgraded.close()
    await upgraded.delete()
  })

  it('deletes a card', async () => {
    const card = createCardFromDraft(draft, new Date(), 'card-1')
    await database.cards.put(card)
    await database.cards.delete('card-1')

    expect(await database.cards.get('card-1')).toBeUndefined()
  })

  it('orders cards by due date', async () => {
    const later = createCardFromDraft(draft, new Date(), 'later')
    later.srs.due = new Date('2026-03-01T00:00:00Z')
    const sooner = createCardFromDraft(draft, new Date(), 'sooner')
    sooner.srs.due = new Date('2026-02-01T00:00:00Z')

    await database.cards.bulkPut([later, sooner])

    const ordered = await database.cards.orderBy('srs.due').toArray()
    expect(ordered.map((card) => card.id)).toEqual(['sooner', 'later'])
  })
})
