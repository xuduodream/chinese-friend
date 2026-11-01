// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Draft } from '@shared/card'
import { createCardFromDraft } from '@/lib/cards'
import ExportButton from '@/components/ExportButton.vue'

const { toArray } = vi.hoisted(() => ({
  toArray: vi.fn<() => Promise<unknown[]>>()
}))

vi.mock('@/lib/db', () => ({
  db: { cards: { toArray } }
}))

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

const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:backup')

beforeEach(() => {
  toArray.mockReset()
  createObjectURL.mockClear()
  URL.createObjectURL = createObjectURL
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})

describe('ExportButton', () => {
  it('downloads every stored card', async () => {
    const card = createCardFromDraft(draft, new Date('2026-01-01T09:00:00Z'), 'card-1')
    card.audioBlob = new Blob(['audio'], { type: 'audio/mpeg' })
    card.audioStatus = 'ready'
    toArray.mockResolvedValue([card])

    const wrapper = mount(ExportButton)
    await wrapper.get('button').trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Downloaded 1 card'))

    const blob = createObjectURL.mock.calls[0]?.[0] as Blob
    const payload = JSON.parse(await blob.text()) as { cards: Array<Record<string, unknown>> }
    expect(payload.cards).toHaveLength(1)
    expect(payload.cards[0]?.chinese).toBe('银行')
    expect(payload.cards[0]).not.toHaveProperty('audioBlob')
  })

  it('reports an empty but valid backup', async () => {
    toArray.mockResolvedValue([])

    const wrapper = mount(ExportButton)
    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Downloaded an empty backup')
  })

  it('surfaces a read failure', async () => {
    toArray.mockRejectedValue(new Error('database closed'))

    const wrapper = mount(ExportButton)
    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="status"]').text()).toContain('Could not export the cards')
  })
})
