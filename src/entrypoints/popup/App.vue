<script lang="ts" setup>
import PopupStyleToggle from '@/features/custom-styles/components/PopupStyleToggle.vue';
import ThemeQuickSwitch from '@/features/settings/components/ThemeQuickSwitch.vue';
import { Button } from '@/shared/ui/button';
import { Settings } from '@lucide/vue';

async function openSettings() {
  await browser.runtime.openOptionsPage();
}
</script>

<template>
  <main class="bg-background text-foreground w-72 p-3 font-sans">
    <header class="mb-3 flex items-center justify-between">
      <h1 class="text-base font-medium">
        browser-ext
      </h1>
      <Button
        variant="ghost"
        size="icon"
        aria-label="打开设置"
        @click="openSettings"
      >
        <Settings class="text-muted-foreground size-4" />
      </Button>
    </header>

    <ThemeQuickSwitch />

    <PopupStyleToggle />

    <p class="text-muted-foreground mt-3 text-xs">
      完整设置在「打开设置」里。
    </p>
  </main>
</template>