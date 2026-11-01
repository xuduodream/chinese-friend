<script setup lang="ts">
import { ref } from 'vue'

defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ select: [file: File] }>()

const libraryInput = ref<HTMLInputElement>()
const cameraInput = ref<HTMLInputElement>()

function onChange(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) emit('select', file)
  input.value = ''
}
</script>

<template>
  <div class="grid gap-3">
    <input
      ref="libraryInput"
      class="sr-only"
      type="file"
      accept="image/jpeg,image/png,image/webp,image/gif"
      @change="onChange"
    >
    <input
      ref="cameraInput"
      class="sr-only"
      type="file"
      accept="image/*"
      capture="environment"
      @change="onChange"
    >

    <button
      type="button"
      class="rounded-xl bg-blue-700 px-4 py-4 text-base font-semibold text-white shadow-sm active:bg-blue-800 disabled:opacity-50"
      :disabled="disabled"
      @click="libraryInput?.click()"
    >
      Choose a screenshot
    </button>
    <button
      type="button"
      class="rounded-xl border border-slate-300 bg-white px-4 py-4 text-base font-semibold text-slate-800 shadow-sm active:bg-slate-100 disabled:opacity-50"
      :disabled="disabled"
      @click="cameraInput?.click()"
    >
      Take a photo
    </button>
  </div>
</template>
