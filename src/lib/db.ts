import Dexie, { type Table } from 'dexie'
import type { Card } from './types'

export const DB_NAME = 'chinese-friend'

export class ChineseFriendDb extends Dexie {
  cards!: Table<Card, string>

  constructor(name = DB_NAME) {
    super(name)
    // Version 1: cards with their audio blob stored inline.
    // Future changes use version(2).stores({...}).upgrade(...) so existing cards migrate.
    this.version(1).stores({
      cards: 'id, srs.due, createdAt'
    })
    // Version 2 adds the AI explanation and example fields. Older cards get
    // empty values so the review screen can render them without special cases.
    this.version(2)
      .stores({ cards: 'id, srs.due, createdAt' })
      .upgrade(async (transaction) => {
        await transaction
          .table('cards')
          .toCollection()
          .modify((card: Record<string, unknown>) => {
            card.explanation ??= ''
            card.exampleChinese ??= ''
            card.examplePinyin ??= ''
            card.exampleEnglish ??= ''
          })
      })
  }
}

export const db = new ChineseFriendDb()
