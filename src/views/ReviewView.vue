<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Grade } from '@shared/card'
import AudioButton from '@/components/AudioButton.vue'
import { synthesizeAudio } from '@/lib/api'
import { db } from '@/lib/db'
import { gradeCard, loadDueCards } from '@/lib/review'
import type { Card } from '@/lib/types'

const GRADES: { value: Grade; label: string }[] = [
  { value: 'again', label: 'Again' },
  { value: 'hard', label: 'Hard' },
  { value: 'good', label: 'Good' },
  { value: 'easy', label: 'Easy' }
]

const queue = ref<Card[]>([])
const revealed = ref(false)
const loading = ref(true)
const error = ref('')
const audioNotice = ref('')
const grading = ref(false)
const finished = ref(false)

const current = computed(() => queue.value[0])
const remaining = computed(() => queue.value.length)

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  audioNotice.value = ''
  revealed.value = false
  finished.value = false
  try {
    queue.value = await loadDueCards()
  } catch {
    error.value = 'Could not read saved cards. Try reloading the app.'
  } finally {
    loading.value = false
  }
}

async function grade(grade: Grade): Promise<void> {
  const card = current.value
  if (!card || grading.value) return

  grading.value = true
  try {
    await gradeCard(card.id, grade)
    queue.value = queue.value.slice(1)
    revealed.value = false
    audioNotice.value = ''
    finished.value = queue.value.length === 0
  } catch {
    error.value = 'Could not save that grade. Try again.'
  } finally {
    grading.value = false
  }
}

async function regenerateAudio(): Promise<void> {
  const card = current.value
  if (!card) return

  audioNotice.value = ''
  card.audioStatus = 'generating'
  try {
    card.audioBlob = await synthesizeAudio({ chinese: card.chinese, reading: card.reading })
    card.audioStatus = 'ready'
  } catch {
    card.audioStatus = 'missing'
    audioNotice.value = 'Audio could not be generated. Check your connection.'
  }

  try {
    await db.cards.put(card)
  } catch {
    audioNotice.value = 'Audio was generated but could not be saved on this device.'
  }
}

onMounted(load)
</script>

<template>
  <section class="space-y-5">
    <div class="flex items-baseline justify-between gap-3">
      <h2 class="text-base font-semibold text-slate-900">
        Review
      </h2>
      <p
        v-if="!loading && remaining > 0"
        class="text-sm text-slate-600"
      >
        {{ remaining }} due
      </p>
    </div>

    <p
      v-if="loading"
      class="text-sm text-slate-600"
      role="status"
    >
      Loading cards…
    </p>

    <template v-else>
      <p
        v-if="error"
        class="rounded-lg bg-red-50 px-3 py-3 text-sm text-red-800"
        role="alert"
      >
        {{ error }}
      </p>

      <div
        v-if="current"
        class="space-y-4"
      >
        <div class="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center">
          <p
            class="text-3xl text-slate-900"
            lang="zh-CN"
          >
            {{ current.chinese }}
          </p>
          <p
            v-if="!revealed"
            class="mt-3 text-sm text-slate-500"
          >
            Try to recall the meaning, then reveal the answer.
          </p>
          <div
            v-else
            class="mt-4 space-y-2"
          >
            <p class="text-base text-slate-700">
              {{ current.pinyin }}
            </p>
            <p class="text-base text-slate-800">
              {{ current.english }}
            </p>
            <p
              v-if="current.explanation"
              class="text-sm text-slate-600"
            >
              {{ current.explanation }}
            </p>
            <div
              v-if="current.exampleChinese"
              class="rounded-lg bg-slate-50 px-3 py-2 text-left"
            >
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Example
              </p>
              <p
                class="mt-1 text-base text-slate-900"
                lang="zh-CN"
              >
                {{ current.exampleChinese }}
              </p>
              <p class="text-sm text-slate-600">
                {{ current.examplePinyin }}
              </p>
              <p class="text-sm text-slate-700">
                {{ current.exampleEnglish }}
              </p>
            </div>
          </div>
        </div>

        <button
          v-if="!revealed"
          type="button"
          class="w-full rounded-xl bg-blue-700 px-4 py-3 text-base font-semibold text-white shadow-sm active:bg-blue-800"
          @click="revealed = true"
        >
          Reveal answer
        </button>

        <AudioButton
          :blob="current.audioBlob"
          :status="current.audioStatus"
          label="Play pronunciation"
          @regenerate="regenerateAudio"
        />

        <p
          v-if="audioNotice"
          class="text-sm text-slate-600"
          role="status"
        >
          {{ audioNotice }}
        </p>

        <div
          v-if="revealed"
          class="grid grid-cols-2 gap-2"
        >
          <button
            v-for="gradeOption in GRADES"
            :key="gradeOption.value"
            type="button"
            class="rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-800 active:bg-slate-100 disabled:opacity-50"
            :disabled="grading"
            @click="grade(gradeOption.value)"
          >
            {{ gradeOption.label }}
          </button>
        </div>
      </div>

      <div
        v-else-if="!error"
        class="space-y-3 rounded-xl border border-slate-200 bg-white px-4 py-8 text-center"
      >
        <p class="text-base font-semibold text-slate-900">
          {{ finished ? 'Review complete' : 'Nothing due right now' }}
        </p>
        <p class="text-sm text-slate-600">
          {{ finished ? 'Your next reviews are scheduled for later.' : 'Add cards from the Capture screen, or come back when the next card is due.' }}
        </p>
        <button
          type="button"
          class="rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-800 active:bg-slate-100"
          @click="load"
        >
          Check again
        </button>
      </div>
    </template>
  </section>
</template>
