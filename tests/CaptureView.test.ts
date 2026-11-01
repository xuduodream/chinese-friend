// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Draft } from '@shared/card'
import DraftEditor from '@/components/DraftEditor.vue'
import ScreenshotPicker from '@/components/ScreenshotPicker.vue'
import CaptureView from '@/views/CaptureView.vue'

const { analyzeImage, synthesizeAudio, downscaleImage, isSupportedImage, putCard, cardStore } =
  vi.hoisted(() => ({
    analyzeImage: vi.fn<(image: string) => Promise<Draft>>(),
    synthesizeAudio: vi.fn<(input: { chinese: string; reading: string }) => Promise<Blob>>(),
    downscaleImage: vi.fn<(file: File) => Promise<string>>(),
    isSupportedImage: vi.fn<(file: File) => boolean>(),
    putCard: vi.fn<(card: { id: string }) => Promise<string>>(),
    cardStore: new Map<string, unknown>()
  }))

// IndexedDB itself is covered in db.test.ts; keep this test on the UI flow.
vi.mock('@/lib/db', () => ({
  db: {
    cards: {
      put: putCard,
      toArray: async () => [...cardStore.values()],
      clear: async () => {
        cardStore.clear()
      }
    }
  }
}))

vi.mock('@/lib/api', () => {
  class ApiError extends Error {
    constructor(
      readonly code: string,
      message: string
    ) {
      super(message)
    }
  }
  return { ApiError, analyzeImage, synthesizeAudio }
})

vi.mock('@/lib/image', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/image')>()
  return { ...actual, downscaleImage, isSupportedImage }
})

import { ApiError } from '@/lib/api'
import { db } from '@/lib/db'

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

beforeEach(async () => {
  cardStore.clear()

  putCard.mockReset().mockImplementation(async (card) => {
    cardStore.set(card.id, card)
    return card.id
  })
  analyzeImage.mockReset().mockResolvedValue({ ...draft })
  synthesizeAudio.mockReset().mockResolvedValue(new Blob(['audio'], { type: 'audio/mpeg' }))
  downscaleImage.mockReset().mockResolvedValue('data:image/jpeg;base64,abc')
  isSupportedImage.mockReset().mockReturnValue(true)

  URL.createObjectURL = vi.fn(() => 'blob:mock')
  URL.revokeObjectURL = vi.fn()
})

async function selectScreenshot(wrapper: ReturnType<typeof mount>): Promise<void> {
  wrapper.findComponent(ScreenshotPicker).vm.$emit(
    'select',
    new File(['pixels'], 'shot.png', { type: 'image/png' })
  )
  await flushPromises()
}

/** IndexedDB writes finish on later ticks than flushPromises covers. */
async function waitForText(wrapper: ReturnType<typeof mount>, text: string): Promise<void> {
  await vi.waitFor(() => expect(wrapper.text()).toContain(text), { timeout: 2000 })
}

describe('CaptureView', () => {
  it('turns a screenshot into an editable draft', async () => {
    const wrapper = mount(CaptureView)

    await selectScreenshot(wrapper)

    expect(downscaleImage).toHaveBeenCalledOnce()
    expect(analyzeImage).toHaveBeenCalledWith('data:image/jpeg;base64,abc')
    expect(wrapper.findComponent(DraftEditor).exists()).toBe(true)
  })

  it('saves the edited draft with audio', async () => {
    const wrapper = mount(CaptureView)
    await selectScreenshot(wrapper)

    const editor = wrapper.findComponent(DraftEditor)
    await editor.get('#draft-english').setValue('Where is the bank?')
    await editor.get('form').trigger('submit')
    await waitForText(wrapper, 'Card saved')

    expect(synthesizeAudio).toHaveBeenCalledWith({ chinese: '银行', reading: 'yin2 hang2' })

    const cards = await db.cards.toArray()
    expect(cards).toHaveLength(1)
    expect(cards[0]).toMatchObject({
      chinese: '银行',
      english: 'Where is the bank?',
      audioStatus: 'ready'
    })
    expect(cards[0]?.audioBlob).toBeInstanceOf(Blob)
    expect(wrapper.text()).toContain('Card saved')
  })

  it('keeps the card when audio generation fails and offers a retry', async () => {
    synthesizeAudio.mockRejectedValueOnce(new Error('tts down'))
    const wrapper = mount(CaptureView)
    await selectScreenshot(wrapper)

    await wrapper.findComponent(DraftEditor).get('form').trigger('submit')
    await waitForText(wrapper, 'Audio is not available yet.')

    expect((await db.cards.toArray())[0]?.audioStatus).toBe('missing')

    let finish: (blob: Blob) => void = () => {}
    synthesizeAudio.mockImplementationOnce(
      () => new Promise<Blob>((resolve) => {
        finish = resolve
      })
    )

    const retry = wrapper.findAll('button').find((button) => button.text() === 'Generate audio')
    await retry?.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Generating audio…')

    finish(new Blob(['audio'], { type: 'audio/mpeg' }))
    await vi.waitFor(async () => {
      expect((await db.cards.toArray())[0]?.audioStatus).toBe('ready')
    })

    expect(synthesizeAudio).toHaveBeenCalledTimes(2)
  })

  it('surfaces a message when the card cannot be stored', async () => {
    putCard.mockRejectedValueOnce(new Error('quota exceeded'))
    const wrapper = mount(CaptureView)
    await selectScreenshot(wrapper)

    await wrapper.findComponent(DraftEditor).get('form').trigger('submit')
    await waitForText(wrapper, 'could not be saved on this device')

    expect(cardStore.size).toBe(0)
    expect(wrapper.get('[role="alert"]').text()).toContain('Storage may be full')
  })

  it('shows the server message when the image has no Chinese text', async () => {
    analyzeImage.mockRejectedValueOnce(
      new ApiError('NO_CHINESE_TEXT', 'No Chinese text was found in that image.')
    )
    const wrapper = mount(CaptureView)

    await selectScreenshot(wrapper)

    expect(wrapper.get('[role="alert"]').text()).toContain('No Chinese text was found in that image.')
  })

  it('shows a message when the local OCR sidecar is not running', async () => {
    analyzeImage.mockRejectedValueOnce(
      new ApiError('OCR_UNAVAILABLE', 'Local OCR is not running. Start it with `npm run ocr:dev`.')
    )
    const wrapper = mount(CaptureView)

    await selectScreenshot(wrapper)

    expect(wrapper.get('[role="alert"]').text()).toContain('Local OCR is not running')
  })

  it('shows a network message when the server cannot be reached', async () => {
    analyzeImage.mockRejectedValueOnce(
      new ApiError('NETWORK', 'Could not reach the server. Check your connection and try again.')
    )
    const wrapper = mount(CaptureView)

    await selectScreenshot(wrapper)

    expect(wrapper.get('[role="alert"]').text()).toContain('Could not reach the server')
  })

  it('discards a draft without saving it', async () => {
    const wrapper = mount(CaptureView)
    await selectScreenshot(wrapper)

    const discard = wrapper.findAll('button').find((button) => button.text() === 'Discard')
    await discard?.trigger('click')

    expect(wrapper.findComponent(ScreenshotPicker).exists()).toBe(true)
    expect(cardStore.size).toBe(0)
    expect(synthesizeAudio).not.toHaveBeenCalled()
  })

  it('shows an error when the screenshot cannot be read', async () => {
    analyzeImage.mockRejectedValueOnce(new Error('model down'))
    const wrapper = mount(CaptureView)

    await selectScreenshot(wrapper)

    expect(wrapper.get('[role="alert"]').text()).toContain('Could not read that screenshot')
    expect(wrapper.findComponent(ScreenshotPicker).exists()).toBe(true)
  })

  it('rejects an unsupported file without calling the server', async () => {
    isSupportedImage.mockReturnValueOnce(false)
    const wrapper = mount(CaptureView)

    await selectScreenshot(wrapper)

    expect(analyzeImage).not.toHaveBeenCalled()
    expect(wrapper.get('[role="alert"]').text()).toContain('not a supported image')
  })

  it('starts over after adding a card', async () => {
    const wrapper = mount(CaptureView)
    await selectScreenshot(wrapper)
    await wrapper.findComponent(DraftEditor).get('form').trigger('submit')
    await waitForText(wrapper, 'Card saved')

    const addAnother = wrapper.findAll('button').find((button) => button.text() === 'Add another card')
    await addAnother?.trigger('click')

    expect(wrapper.findComponent(ScreenshotPicker).exists()).toBe(true)
    expect(wrapper.findComponent(DraftEditor).exists()).toBe(false)
  })
})
