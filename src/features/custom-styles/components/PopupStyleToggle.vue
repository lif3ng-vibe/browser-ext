<!-- src/features/custom-styles/components/PopupStyleToggle.vue -->
<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { Checkbox } from '@/shared/ui/checkbox';
import { matchingStyles } from '../matcher';
import { useCustomStyles } from '../useCustomStyles';
import type { CustomStyle } from '../types';

const store = useCustomStyles();
const rows = ref<CustomStyle[]>([]);
const supported = ref(true);

// popup 打开即取快照:当前页命中的样式(含禁用的,便于反向启停)
onMounted(async () => {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url;
  if (!url || !/^https?:/.test(url)) {
    supported.value = false;
    return;
  }
  rows.value = matchingStyles(store.styles.value, url);
});
</script>

<template>
  <section class="border-t pt-3">
    <h2 class="text-muted-foreground mb-2 text-xs font-medium">
      此页的自定义样式
    </h2>
    <p
      v-if="!supported"
      class="text-muted-foreground text-sm"
    >
      此页面不支持注入。
    </p>
    <template v-else>
      <p
        v-if="!rows.length"
        class="text-muted-foreground text-sm"
      >
        本页没有命中的样式。
      </p>
      <label
        v-for="s in rows"
        :key="s.id"
        class="flex items-center gap-2 py-1 text-sm"
      >
        <Checkbox
          :model-value="s.enabled"
          :aria-label="`启用 ${s.name}`"
          @update:model-value="(v) => store.update(s.id, { enabled: v === true })"
        />
        <span class="text-sm">{{ s.name }}</span>
      </label>
    </template>
  </section>
</template>