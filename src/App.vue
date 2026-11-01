<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import InstallPrompt from '@/components/InstallPrompt.vue'
</script>

<template>
  <div class="mx-auto flex min-h-dvh max-w-md flex-col bg-slate-50">
    <header class="border-b border-slate-200 bg-white px-4 py-3">
      <h1 class="text-lg font-semibold tracking-tight text-slate-900">
        Chinese Friend
      </h1>
      <p class="text-xs text-slate-500">
        Screenshots into audio flashcards
      </p>
    </header>

    <InstallPrompt />

    <main class="flex-1 px-4 py-5">
      <RouterView />
    </main>

    <nav
      class="sticky bottom-0 grid grid-cols-2 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]"
      aria-label="Main navigation"
    >
      <RouterLink
        to="/"
        class="flex flex-col items-center gap-0.5 px-4 py-3 text-sm font-medium text-slate-500 aria-[current=page]:text-blue-700"
        active-class="text-blue-700"
      >
        <span
          aria-hidden="true"
          class="text-xl"
        >+</span>
        Capture
      </RouterLink>
      <RouterLink
        to="/review"
        class="flex flex-col items-center gap-0.5 px-4 py-3 text-sm font-medium text-slate-500 aria-[current=page]:text-blue-700"
        active-class="text-blue-700"
      >
        <span
          aria-hidden="true"
          class="text-xl"
        >&#8635;</span>
        Review
      </RouterLink>
    </nav>
  </div>
</template>
