<script lang="ts" setup>
import PopupStyleToggle from '@/features/custom-styles/components/PopupStyleToggle.vue';
import {
  closeManagerPanel,
  isManagerPanelOpen,
  openManagerPanel,
  panelAliveItem,
} from '@/features/custom-styles/openManagerPanel';
import ThemeQuickSwitch from '@/features/settings/components/ThemeQuickSwitch.vue';
import { Button } from '@/shared/ui/button';
import { PanelRight, PanelRightClose, PanelRightOpen, Settings } from '@lucide/vue';
import { computed, onMounted, ref } from 'vue';

async function openSettings() {
  await browser.runtime.openOptionsPage();
}

// 侧边栏开合状态:Firefox 走平台查询;Chromium 走面板自报心跳(session storage)
const panelOpen = ref<boolean | null>(null);
onMounted(async () => {
  panelOpen.value = await isManagerPanelOpen();
});
// 打开动作成功后把心跳一并写上(面板 pagehide 才会清);这样「开过但面板未及登记」也能正确显示
async function markPanel(open: boolean) {
  panelOpen.value = open;
  if (open) await panelAliveItem.setValue(true);
}

// 面板停靠屏幕右侧:关 → PanelRightOpen(左箭头,拉出来)/ 开 → PanelRightClose(右箭头,推回去)/ 未知 → PanelRight
const panelIcon = computed(() =>
  panelOpen.value === true ? PanelRightClose : panelOpen.value === false ? PanelRightOpen : PanelRight,
);
const panelLabel = computed(() => (panelOpen.value === true ? '收起侧边栏' : '打开侧边栏'));

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

async function togglePanel() {
  if (panelOpen.value) {
    const ok = await closeManagerPanel();
    if (ok)
      panelOpen.value = false;
    else showHint('此浏览器不支持脚本收起,请在面板右上角关闭');
  }
  else {
    const ok = await openManagerPanel();
    if (ok) await markPanel(true);
    else showHint('未能自动打开侧边栏');
  }
}
</script>

<template>
  <main class="bg-background text-foreground w-72 p-3 font-sans">
    <header class="mb-3 flex items-center justify-between">
      <h1 class="text-base font-medium">
        browser-ext
      </h1>
      <div class="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          :aria-label="panelLabel"
          @click="togglePanel"
        >
          <component
            :is="panelIcon"
            class="text-muted-foreground size-4"
          />
        </Button>
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
