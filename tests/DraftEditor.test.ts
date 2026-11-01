// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DraftEditor from '@/components/DraftEditor.vue'
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

describe('DraftEditor', () => {
  it('shows the extracted fields for checking', () => {
    const wrapper = mount(DraftEditor, { props: { draft } })

    expect((wrapper.get('#draft-chinese').element as HTMLTextAreaElement).value).toBe('银行')
    expect((wrapper.get('#draft-pinyin').element as HTMLInputElement).value).toBe('yínháng')
    expect((wrapper.get('#draft-english').element as HTMLTextAreaElement).value).toBe('bank')
    expect((wrapper.get('#draft-explanation').element as HTMLTextAreaElement).value).toBe(
      'A bank; used here for the financial institution.'
    )
    expect((wrapper.get('#draft-example-chinese').element as HTMLTextAreaElement).value).toBe(
      '我去银行取钱。'
    )
    expect((wrapper.get('#draft-example-pinyin').element as HTMLInputElement).value).toBe(
      'wǒ qù yín háng qǔ qián.'
    )
    expect((wrapper.get('#draft-example-english').element as HTMLTextAreaElement).value).toBe(
      'I am going to the bank to withdraw money.'
    )
    expect((wrapper.get('#draft-reading').element as HTMLInputElement).value).toBe('yin2 hang2')
  })

  it('emits the edited draft on save', async () => {
    const wrapper = mount(DraftEditor, { props: { draft } })

    await wrapper.get('#draft-chinese').setValue('银行在哪里？')
    await wrapper.get('#draft-pinyin').setValue('yínháng zài nǎlǐ?')
    await wrapper.get('#draft-english').setValue('Where is the bank?')
    await wrapper.get('#draft-explanation').setValue('Asking for the bank.')
    await wrapper.get('#draft-example-chinese').setValue('银行在前面。')
    await wrapper.get('#draft-example-pinyin').setValue('yín háng zài qián miàn.')
    await wrapper.get('#draft-example-english').setValue('The bank is ahead.')
    await wrapper.get('#draft-reading').setValue('yin2 hang2 zai4 na3 li3')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('confirm')?.[0]?.[0]).toEqual({
      chinese: '银行在哪里？',
      pinyin: 'yínháng zài nǎlǐ?',
      english: 'Where is the bank?',
      explanation: 'Asking for the bank.',
      exampleChinese: '银行在前面。',
      examplePinyin: 'yín háng zài qián miàn.',
      exampleEnglish: 'The bank is ahead.',
      reading: 'yin2 hang2 zai4 na3 li3'
    })
  })

  it('does not save when the Chinese text is empty', async () => {
    const wrapper = mount(DraftEditor, { props: { draft } })

    await wrapper.get('#draft-chinese').setValue('   ')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('confirm')).toBeUndefined()
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
  })

  it('does not save while a save is already running', async () => {
    const wrapper = mount(DraftEditor, { props: { draft, busy: true } })

    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('confirm')).toBeUndefined()
  })

  it('emits discard', async () => {
    const wrapper = mount(DraftEditor, { props: { draft } })

    const discard = wrapper.findAll('button').find((button) => button.text() === 'Discard')
    await discard?.trigger('click')

    expect(wrapper.emitted('discard')).toHaveLength(1)
  })

  it('picks up a new draft passed to an existing instance', async () => {
    const wrapper = mount(DraftEditor, { props: { draft } })

    await wrapper.setProps({
      draft: {
        ...draft,
        chinese: '车站',
        english: 'station',
        explanation: 'A station.',
        exampleChinese: '车站在哪？'
      }
    })

    expect((wrapper.get('#draft-chinese').element as HTMLTextAreaElement).value).toBe('车站')
    expect((wrapper.get('#draft-english').element as HTMLTextAreaElement).value).toBe('station')
    expect((wrapper.get('#draft-explanation').element as HTMLTextAreaElement).value).toBe(
      'A station.'
    )
    expect((wrapper.get('#draft-example-chinese').element as HTMLTextAreaElement).value).toBe(
      '车站在哪？'
    )
  })
})
