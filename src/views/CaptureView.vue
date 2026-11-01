<script setup lang="ts">
import { ref } from 'vue'
import type { Draft } from '@shared/card'
import AudioButton from '@/components/AudioButton.vue'
import DraftEditor from '@/components/DraftEditor.vue'
import ExportButton from '@/components/ExportButton.vue'
import ScreenshotPicker from '@/components/ScreenshotPicker.vue'
import { analyzeImage, ApiError, synthesizeAudio } from '@/lib/api'
import { createCardFromDraft } from '@/lib/cards'
import { db } from '@/lib/db'
import { downscaleImage, isSupportedImage } from '@/lib/image'
import { requestPersistentStorage } from '@/lib/storage'
import type { Card } from '@/lib/types'

type Phase = 'idle' | 'analyzing' | 'draft' | 'saving' | 'saved' | 'error'

const phase = ref<Phase>('idle')
const draft = ref<Draft | null>(null)
const savedCard = ref<Card | null>(null)
const message = ref('')
const persisted = ref<boolean | null>(null)

function reset(): void {
  phase.value = 'idle'
  draft.value = null
  savedCard.value = null
  message.value = ''
  persisted.value = null
}

async function handleSelect(file: File): Promise<void> {
  message.value = ''
  savedCard.value = null

  if (!isSupportedImage(file)) {
    phase.value = 'error'
    message.value = 'That file is not a supported image. Use a JPEG, PNG, WebP, or GIF.'
    return
  }

  phase.value = 'analyzing'
  try {
    const dataUrl = await downscaleImage(file)
    draft.value = await analyzeImage(dataUrl)
    phase.value = 'draft'
  } catch (error) {
    phase.value = 'error'
    message.value =
      error instanceof ApiError
        ? error.message
        : 'Could not read that screenshot. Try again.'
  }
}

async function generateAudio(card: Card): Promise<void> {
  card.audioStatus = 'generating'
  await db.cards.put(card)

  try {
    card.audioBlob = await synthesizeAudio({ chinese: card.chinese, reading: card.reading })
    card.audioStatus = 'ready'
  } catch {
    card.audioStatus = 'missing'
  }

  await db.cards.put(card)
  savedCard.value = { ...card }
}

async function handleConfirm(edited: Draft): Promise<void> {
  phase.value = 'saving'
  try {
    const card = createCardFromDraft(edited)
    await db.cards.put(card)
    persisted.value = await requestPersistentStorage()
    await generateAudio(card)
    phase.value = 'saved'
  } catch {
    phase.value = 'error'
    message.value = 'The card could not be saved on this device. Storage may be full.'
  }
}

async function regenerate(): Promise<void> {
  if (!savedCard.value) return
  await generateAudio(savedCard.value)
}
</script>

<template>
  <section class="space-y-5">
    <div>
      <h2 class="text-base font-semibold text-slate-900">
        Capture a card
      </h2>
      <p class="text-sm text-slate-600">
        Pick a screenshot of Chinese text. You will check the draft before it is saved.
      </p>
    </div>

    <ScreenshotPicker
      v-if="phase === 'idle' || phase === 'error'"
      @select="handleSelect"
    />

    <p
      v-if="phase === 'error'"
      class="rounded-lg bg-red-50 px-3 py-3 text-sm text-red-800"
      role="alert"
    >
      {{ message }}
    </p>

    <p
      v-if="phase === 'analyzing'"
      class="text-sm text-slate-600"
      role="status"
    >
      Reading your screenshot…
    </p>

    <DraftEditor
      v-if="(phase === 'draft' || phase === 'saving') && draft"
      :draft="draft"
      :busy="phase === 'saving'"
      @confirm="handleConfirm"
      @discard="reset"
    />

    <p
      v-if="phase === 'saving'"
      class="text-sm text-slate-600"
      role="status"
    >
      Saving the card and generating audio…
    </p>

    <div
      v-if="phase === 'saved' && savedCard"
      class="space-y-4"
    >
      <div class="rounded-xl border border-green-200 bg-green-50 px-4 py-4">
        <h3 class="text-base font-semibold text-green-900">
          Card saved
        </h3>
        <p
          class="mt-2 text-2xl text-slate-900"
          lang="zh-CN"
        >
          {{ savedCard.chinese }}
        </p>
        <p class="text-sm text-slate-600">
          {{ savedCard.pinyin }}
        </p>
        <p class="text-sm text-slate-700">
          {{ savedCard.english }}
        </p>
      </div>

      <AudioButton
        :blob="savedCard.audioBlob"
        :status="savedCard.audioStatus"
        @regenerate="regenerate"
      />

      <p
        v-if="persisted === false"
        class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900"
        role="status"
      >
        This browser did not grant persistent storage. Export a backup regularly
        in case it clears site data.
      </p>

      <button
        type="button"
        class="w-full rounded-xl bg-blue-700 px-4 py-3 text-base font-semibold text-white shadow-sm active:bg-blue-800"
        @click="reset"
      >
        Add another card
      </button>
    </div>

    <ExportButton />
  </section>
</template>
