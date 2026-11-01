// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Draft } from '@shared/card'
import { createCardFromDraft } from '@/lib/cards'
import { buildExport, downloadExport, exportFilename } from '@/lib/export'
import { gradeSrs } from '@/lib/fsrs'

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

function sampleCard() {
  const card = createCardFromDraft(draft, new Date('2026-01-01T09:00:00Z'), 'card-1')
  card.audioBlob = new Blob(['fake audio'], { type: 'audio/mpeg' })
  card.audioStatus = 'ready'
  card.srs = gradeSrs(card.srs, 'good', new Date('2026-01-02T09:00:00Z'))
  card.srs.lastGrade = 'good'
  return card
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('buildExport', () => {
  it('exports the text fields and review state as JSON-safe values', () => {
    const card = sampleCard()

    const payload = buildExport([card], new Date('2026-01-03T10:00:00Z'))

    expect(payload.version).toBe(1)
    expect(payload.exportedAt).toBe('2026-01-03T10:00:00.000Z')
    expect(payload.cards).toHaveLength(1)
    expect(payload.cards[0]).toMatchObject({
      id: 'card-1',
      chinese: '银行',
      pinyin: 'yínháng',
      english: 'bank',
      explanation: 'A bank; used here for the financial institution.',
      exampleChinese: '我去银行取钱。',
      examplePinyin: 'wǒ qù yín háng qǔ qián.',
      exampleEnglish: 'I am going to the bank to withdraw money.',
      reading: 'yin2 hang2',
      createdAt: '2026-01-01T09:00:00.000Z',
      review: {
        due: card.srs.due.toISOString(),
        reps: 1,
        last_review: '2026-01-02T09:00:00.000Z',
        lastGrade: 'good'
      }
    })
  })

  it('leaves audio out of the backup', () => {
    const payload = buildExport([sampleCard()])

    expect(JSON.stringify(payload)).not.toContain('audioBlob')
    expect(JSON.stringify(payload)).not.toContain('audioStatus')
    expect(payload.cards[0]).not.toHaveProperty('audioBlob')
  })

  it('handles an empty card list', () => {
    expect(buildExport([], new Date('2026-01-03T10:00:00Z')).cards).toEqual([])
  })
})

describe('exportFilename', () => {
  it('uses the export date', () => {
    expect(exportFilename(new Date('2026-01-03T10:00:00Z'))).toBe('chinese-friend-2026-01-03.json')
  })
})

describe('downloadExport', () => {
  it('downloads the JSON payload under the given filename', async () => {
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:backup')
    URL.createObjectURL = createObjectURL
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const payload = buildExport([sampleCard()], new Date('2026-01-03T10:00:00Z'))
    const filename = downloadExport(payload)

    expect(filename).toBe('chinese-friend-2026-01-03.json')
    expect(click).toHaveBeenCalledOnce()

    const blob = createObjectURL.mock.calls[0]?.[0] as Blob
    expect(blob.type).toBe('application/json')
    expect(JSON.parse(await blob.text())).toEqual(payload)
  })
})
