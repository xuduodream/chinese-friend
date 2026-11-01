<script setup lang="ts">
import { ref } from 'vue'
import { db } from '@/lib/db'
import { buildExport, downloadExport } from '@/lib/export'

const busy = ref(false)
const status = ref('')

async function exportCards(): Promise<void> {
  busy.value = true
  status.value = ''
  try {
    const cards = await db.cards.toArray()
    const filename = downloadExport(buildExport(cards))
    status.value =
      cards.length === 0
        ? `Downloaded an empty backup as ${filename}.`
        : `Downloaded ${cards.length} card${cards.length === 1 ? '' : 's'} as ${filename}.`
  } catch {
    status.value = 'Could not export the cards. Try again.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="rounded-xl border border-slate-200 bg-white px-4 py-4">
    <h2 class="text-sm font-semibold text-slate-900">
      Back up cards
    </h2>
    <p class="mt-1 text-sm text-slate-600">
      Download a JSON file with every card and its review state. Audio is not
      included and can be generated again.
    </p>
    <button
      type="button"
      class="mt-3 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-800 active:bg-slate-100 disabled:opacity-50"
      :disabled="busy"
      @click="exportCards"
    >
      {{ busy ? 'Preparing backup…' : 'Export cards' }}
    </button>
    <p
      v-if="status"
      class="mt-2 text-sm text-slate-600"
      role="status"
    >
      {{ status }}
    </p>
  </section>
</template>
