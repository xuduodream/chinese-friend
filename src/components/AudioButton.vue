<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import type { AudioStatus } from '@/lib/types'

const props = defineProps<{
  blob?: Blob
  status: AudioStatus
  label?: string
}>()

const emit = defineEmits<{ regenerate: [] }>()

const audio = ref<HTMLAudioElement>()
const url = ref<string>()

watch(
  () => props.blob,
  (blob) => {
    if (url.value) URL.revokeObjectURL(url.value)
    url.value = blob ? URL.createObjectURL(blob) : undefined
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (url.value) URL.revokeObjectURL(url.value)
})

function play(): void {
  const element = audio.value
  if (!element) return
  element.currentTime = 0
  element.play().catch(() => {
    // Mobile browsers can reject playback; the button stays available to retry.
  })
}
</script>

<template>
  <div class="space-y-2">
    <audio
      ref="audio"
      :src="url"
      preload="none"
    />

    <button
      type="button"
      class="w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-base font-semibold text-blue-800 active:bg-blue-100 disabled:opacity-60"
      :disabled="status !== 'ready' || !url"
      @click="play"
    >
      {{ label ?? 'Listen' }}
    </button>

    <p
      v-if="status === 'generating'"
      class="text-sm text-slate-600"
      role="status"
    >
      Generating audio…
    </p>
    <p
      v-else-if="status === 'missing'"
      class="text-sm text-slate-600"
    >
      Audio is not available yet.
      <button
        type="button"
        class="font-semibold text-blue-700 underline"
        @click="emit('regenerate')"
      >
        Generate audio
      </button>
    </p>
  </div>
</template>
