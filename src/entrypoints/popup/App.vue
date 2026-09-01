<!-- src/entrypoints/popup/App.vue -->
<script lang="ts" setup>
import PanelOpenButton from '@/features/custom-styles/components/PanelOpenButton.vue';
import PopupStyleToggle from '@/features/custom-styles/components/PopupStyleToggle.vue';
import ThemeQuickSwitch from '@/features/settings/components/ThemeQuickSwitch.vue';
import { Button } from '@/shared/ui/button';
import { Settings } from '@lucide/vue';
import { ref } from 'vue';

async function openSettings() {
  await browser.runtime.openOptionsPage();
}

const hint = ref(false);
const hintText = ref('');
let hintTimer: ReturnType<typeof setTimeout> | undefined;
function showHint(text: string) {
  hintText.value = text;
  hint.value = true;
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => {
    hint.value = false;
  }, 2000);
}
</script>

<template>
  <main class="bg-background text-foreground w-72 p-3 font-sans">
    <header class="mb-3 flex items-center justify-between">
      <h1 class="text-base font-medium">
        browser-ext
      </h1>
      <div class="flex items-center gap-1">
        <PanelOpenButton @hint="showHint" />
        <Button
          variant="ghost"
          size="icon"
          aria-label="打开设置"
          @click="openSettings"
        >
          <Settings class="text-muted-foreground size-4" />
        </Button>
      </div>
    </header>

    <ThemeQuickSwitch />

    <PopupStyleToggle />

    <p class="text-muted-foreground mt-3 text-xs">
      {{ hint ? hintText : '完整设置在「打开设置」里。' }}
    </p>
  </main>
</template>
