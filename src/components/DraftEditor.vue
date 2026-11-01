<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { Draft } from '@shared/card'

const props = defineProps<{ draft: Draft; busy?: boolean }>()
const emit = defineEmits<{ confirm: [draft: Draft]; discard: [] }>()

const form = reactive<Draft>({ ...props.draft })
watch(
  () => props.draft,
  (draft) => Object.assign(form, draft)
)

const canSave = computed(() => form.chinese.trim().length > 0)

function confirm(): void {
  if (!canSave.value || props.busy) return
  emit('confirm', { ...form })
}
</script>

<template>
  <form
    class="space-y-4"
    @submit.prevent="confirm"
  >
    <p class="text-sm text-slate-600">
      Check what was read. Fix anything the screenshot got wrong before saving.
    </p>

    <div>
      <label
        for="draft-chinese"
        class="block text-sm font-semibold text-slate-800"
      >Chinese</label>
      <textarea
        id="draft-chinese"
        v-model="form.chinese"
        rows="2"
        lang="zh-CN"
        class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
    </div>

    <div>
      <label
        for="draft-pinyin"
        class="block text-sm font-semibold text-slate-800"
      >Pinyin</label>
      <input
        id="draft-pinyin"
        v-model="form.pinyin"
        type="text"
        class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
      >
    </div>

    <div>
      <label
        for="draft-english"
        class="block text-sm font-semibold text-slate-800"
      >English</label>
      <textarea
        id="draft-english"
        v-model="form.english"
        rows="2"
        class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
    </div>

    <div>
      <label
        for="draft-explanation"
        class="block text-sm font-semibold text-slate-800"
      >Explanation</label>
      <textarea
        id="draft-explanation"
        v-model="form.explanation"
        rows="2"
        class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
    </div>

    <fieldset class="space-y-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
      <legend class="px-1 text-sm font-semibold text-slate-800">
        Example sentence
      </legend>

      <div>
        <label
          for="draft-example-chinese"
          class="block text-sm font-semibold text-slate-800"
        >Chinese</label>
        <textarea
          id="draft-example-chinese"
          v-model="form.exampleChinese"
          rows="2"
          lang="zh-CN"
          class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>

      <div>
        <label
          for="draft-example-pinyin"
          class="block text-sm font-semibold text-slate-800"
        >Pinyin</label>
        <input
          id="draft-example-pinyin"
          v-model="form.examplePinyin"
          type="text"
          class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
      </div>

      <div>
        <label
          for="draft-example-english"
          class="block text-sm font-semibold text-slate-800"
        >English</label>
        <textarea
          id="draft-example-english"
          v-model="form.exampleEnglish"
          rows="2"
          class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>
    </fieldset>

    <div>
      <label
        for="draft-reading"
        class="block text-sm font-semibold text-slate-800"
      >
        Reading for audio
      </label>
      <p
        id="draft-reading-help"
        class="text-xs text-slate-500"
      >
        Numbered, syllable-separated pinyin, for example <span lang="zh-Latn">yin2 hang2</span>.
      </p>
      <input
        id="draft-reading"
        v-model="form.reading"
        type="text"
        aria-describedby="draft-reading-help"
        class="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
      >
    </div>

    <div class="flex gap-3 pt-1">
      <button
        type="submit"
        class="flex-1 rounded-xl bg-blue-700 px-4 py-3 text-base font-semibold text-white shadow-sm active:bg-blue-800 disabled:opacity-50"
        :disabled="!canSave || busy"
      >
        Save card
      </button>
      <button
        type="button"
        class="rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-700 active:bg-slate-100 disabled:opacity-50"
        :disabled="busy"
        @click="emit('discard')"
      >
        Discard
      </button>
    </div>
  </form>
</template>
