<!-- sidepanel 聚合薄壳(issue #24):tab 切换组合各 Feature 的面板视图,组合逻辑只住这里;
     Feature 互不 import、零改动(词汇表「面板聚合」)。 -->
<script lang="ts" setup>
import { ref, watch } from 'vue';
import { storage } from 'wxt/utils/storage';
import { useTheme } from '@/shared/theme/useTheme';
import ManagerPanel from '@/features/custom-styles/ManagerPanel.vue';
import { trackPanelAlive } from '@/features/custom-styles/openManagerPanel';
import NotesTab from './NotesTab.vue';

useTheme(); // 薄壳自任页面级主题:任意 tab 都吃主题系统,跨页面即改即随
trackPanelAlive(); // 心跳登记任意 tab 均算面板存活(popup 据此判断开合,Chromium 无查询 API)

/** tab 名即持久化值;首开默认「样式」 */
type PanelTab = 'styles' | 'notes';
const TABS: { id: PanelTab; label: string }[] = [
  { id: 'styles', label: '样式' },
  { id: 'notes', label: '便签' },
];

const tabItem = storage.defineItem<PanelTab>('local:sidePanelTab', { fallback: 'styles' });
const tab = ref<PanelTab>('styles');

void tabItem.getValue().then((v) => (tab.value = v === 'notes' ? 'notes' : 'styles'));

watch(tab, (v) => void tabItem.setValue(v));

function pick(id: PanelTab) {
  tab.value = id;
}
</script>

<template>
  <main class="bg-background text-foreground flex h-screen flex-col gap-3 p-3 font-sans">
    <!-- tab 组合只住薄壳;样式 tab 常驻不卸载(切 tab 不丢编辑草稿与预览会话) -->
    <div
      role="tablist"
      aria-label="功能面板"
      class="border-border flex shrink-0 gap-1 rounded-lg border p-1"
    >
      <button
        v-for="t in TABS"
        :key="t.id"
        role="tab"
        type="button"
        :aria-selected="tab === t.id"
        class="text-muted-foreground aria-selected:text-foreground rounded-md px-3 py-1 text-sm font-medium transition-colors"
        :class="tab === t.id ? 'bg-muted' : 'hover:bg-muted/50'"
        @click="pick(t.id)"
      >
        {{ t.label }}
      </button>
    </div>

    <!-- ManagerPanel 自带页面级 h-screen:容器适配(高度压回壳内剩余空间,Feature 零改动) -->
    <div class="min-h-0 flex-1 [&>main]:h-full">
      <ManagerPanel v-show="tab === 'styles'" />
    </div>
    <div
      v-show="tab === 'notes'"
      class="min-h-0 flex-1 overflow-y-auto"
    >
      <NotesTab />
    </div>
  </main>
</template>
