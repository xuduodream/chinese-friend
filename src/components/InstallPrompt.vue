<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const promptEvent = ref<InstallPromptEvent>()
const dismissed = ref(false)

function onBeforeInstall(event: Event): void {
  event.preventDefault()
  promptEvent.value = event as InstallPromptEvent
}

function onInstalled(): void {
  promptEvent.value = undefined
  dismissed.value = true
}

async function install(): Promise<void> {
  const event = promptEvent.value
  if (!event) return
  await event.prompt()
  const choice = await event.userChoice
  if (choice.outcome === 'dismissed') dismissed.value = true
  promptEvent.value = undefined
}

onMounted(() => {
  window.addEventListener('beforeinstallprompt', onBeforeInstall)
  window.addEventListener('appinstalled', onInstalled)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  window.removeEventListener('appinstalled', onInstalled)
})
</script>

<template>
  <div
    v-if="promptEvent && !dismissed"
    class="mx-4 mt-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3"
    role="region"
    aria-label="Install Chinese Friend"
  >
    <p class="text-sm text-slate-800">
      Install Chinese Friend for one-tap access and more reliable storage.
    </p>
    <div class="mt-2 flex gap-2">
      <button
        type="button"
        class="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white active:bg-blue-800"
        @click="install"
      >
        Install
      </button>
      <button
        type="button"
        class="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 active:bg-blue-100"
        @click="dismissed = true"
      >
        Not now
      </button>
    </div>
  </div>
</template>
