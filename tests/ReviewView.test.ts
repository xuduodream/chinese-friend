// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Draft, Grade } from '@shared/card'
import { createCardFromDraft } from '@/lib/cards'
import type { Card } from '@/lib/types'
import ReviewView from '@/views/ReviewView.vue'

const { loadDueCards, gradeCard, putCard, synthesizeAudio } = vi.hoisted(() => ({
  loadDueCards: vi.fn<() => Promise<Card[]>>(),
  gradeCard: vi.fn<(id: string, grade: Grade) => Promise<Card>>(),
  putCard: vi.fn<(card: Card) => Promise<string>>(),
  synthesizeAudio: vi.fn<(input: { chinese: string; reading: string }) => Promise<Blob>>()
}))

vi.mock('@/lib/review', () => ({ loadDueCards, gradeCard }))
vi.mock('@/lib/db', () => ({ db: { cards: { put: putCard } } }))
vi.mock('@/lib/api', () => ({ synthesizeAudio }))

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

function reviewCard(id: string, overrides: Partial<Card> = {}): Card {
  return {
    ...createCardFromDraft(draft, new Date('2026-01-01T12:00:00Z'), id),
    ...overrides
  }
}

function buttonWithText(wrapper: ReturnType<typeof mount>, text: string) {
  return wrapper.findAll('button').find((button) => button.text() === text)
}

beforeEach(() => {
  loadDueCards.mockReset().mockResolvedValue([])
  gradeCard.mockReset().mockImplementation(async (id) => reviewCard(id))
  putCard.mockReset().mockResolvedValue('card-1')
  synthesizeAudio.mockReset().mockResolvedValue(new Blob(['audio'], { type: 'audio/wav' }))

  URL.createObjectURL = vi.fn(() => 'blob:audio')
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ReviewView', () => {
  it('shows the Chinese prompt without pinyin or English', async () => {
    loadDueCards.mockResolvedValue([reviewCard('card-1')])
    const wrapper = mount(ReviewView)
    await flushPromises()

    const text = wrapper.text()
    expect(text).toContain('银行')
    expect(text).not.toContain('yínháng')
    expect(text).not.toContain('bank')
    expect(text).not.toContain('我去银行取钱。')
    expect(buttonWithText(wrapper, 'Good')).toBeUndefined()
  })

  it('reveals pinyin and English, then offers grades', async () => {
    loadDueCards.mockResolvedValue([reviewCard('card-1')])
    const wrapper = mount(ReviewView)
    await flushPromises()

    await buttonWithText(wrapper, 'Reveal answer')?.trigger('click')

    expect(wrapper.text()).toContain('yínháng')
    expect(wrapper.text()).toContain('bank')
    expect(wrapper.text()).toContain('A bank; used here for the financial institution.')
    expect(wrapper.text()).toContain('我去银行取钱。')
    expect(wrapper.text()).toContain('wǒ qù yín háng qǔ qián.')
    expect(wrapper.text()).toContain('I am going to the bank to withdraw money.')
    for (const label of ['Again', 'Hard', 'Good', 'Easy']) {
      expect(buttonWithText(wrapper, label)).toBeDefined()
    }
  })

  it('records a grade and shows the remaining due count', async () => {
    loadDueCards.mockResolvedValue([reviewCard('card-1'), reviewCard('card-2')])
    const wrapper = mount(ReviewView)
    await flushPromises()
    expect(wrapper.text()).toContain('2 due')

    await buttonWithText(wrapper, 'Reveal answer')?.trigger('click')
    await buttonWithText(wrapper, 'Good')?.trigger('click')
    await flushPromises()

    expect(gradeCard).toHaveBeenCalledWith('card-1', 'good')
    expect(wrapper.text()).toContain('1 due')
    expect(wrapper.text()).toContain('银行')
  })

  it('reports completion after the last card is graded', async () => {
    loadDueCards.mockResolvedValue([reviewCard('card-1')])
    const wrapper = mount(ReviewView)
    await flushPromises()

    await buttonWithText(wrapper, 'Reveal answer')?.trigger('click')
    await buttonWithText(wrapper, 'Easy')?.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Review complete')
    expect(wrapper.text()).not.toContain('due')
  })

  it('shows the no-due state with no cards', async () => {
    const wrapper = mount(ReviewView)
    await flushPromises()

    expect(wrapper.text()).toContain('Nothing due right now')
    expect(buttonWithText(wrapper, 'Check again')).toBeDefined()
  })

  it('surfaces a load failure', async () => {
    loadDueCards.mockRejectedValue(new Error('database closed'))
    const wrapper = mount(ReviewView)
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('Could not read saved cards')
  })

  it('surfaces a grading failure', async () => {
    loadDueCards.mockResolvedValue([reviewCard('card-1')])
    gradeCard.mockRejectedValueOnce(new Error('quota'))
    const wrapper = mount(ReviewView)
    await flushPromises()

    await buttonWithText(wrapper, 'Reveal answer')?.trigger('click')
    await buttonWithText(wrapper, 'Again')?.trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('Could not save that grade')
    expect(wrapper.text()).toContain('银行')
  })

  it('disables audio when the card has none and can generate it', async () => {
    loadDueCards.mockResolvedValue([reviewCard('card-1', { audioStatus: 'missing' })])
    const wrapper = mount(ReviewView)
    await flushPromises()

    const listen = buttonWithText(wrapper, 'Play pronunciation')
    expect(listen?.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Audio is not available yet')

    await buttonWithText(wrapper, 'Generate audio')?.trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).not.toContain('Audio is not available yet'))

    expect(synthesizeAudio).toHaveBeenCalledWith({ chinese: '银行', reading: 'yin2 hang2' })
    expect(putCard).toHaveBeenCalledWith(expect.objectContaining({ audioStatus: 'ready' }))
  })

  it('works with no network when cards and audio are already stored', async () => {
    const fetch = vi.fn(() => Promise.reject(new Error('offline')))
    vi.stubGlobal('fetch', fetch)
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    loadDueCards.mockResolvedValue([
      reviewCard('card-1', {
        audioStatus: 'ready',
        audioBlob: new Blob(['audio'], { type: 'audio/wav' })
      })
    ])

    const wrapper = mount(ReviewView)
    await flushPromises()
    await buttonWithText(wrapper, 'Reveal answer')?.trigger('click')
    await buttonWithText(wrapper, 'Play pronunciation')?.trigger('click')
    await buttonWithText(wrapper, 'Good')?.trigger('click')
    await flushPromises()

    expect(play).toHaveBeenCalledOnce()
    expect(gradeCard).toHaveBeenCalledWith('card-1', 'good')
    expect(wrapper.text()).toContain('Review complete')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('plays cached audio for a card', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    loadDueCards.mockResolvedValue([
      reviewCard('card-1', {
        audioStatus: 'ready',
        audioBlob: new Blob(['audio'], { type: 'audio/wav' })
      })
    ])
    const wrapper = mount(ReviewView)
    await flushPromises()

    await buttonWithText(wrapper, 'Play pronunciation')?.trigger('click')

    expect(play).toHaveBeenCalledOnce()
  })
})
