<!-- src/features/custom-styles/components/PanelOpenButton.vue -->
<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import {
  closeManagerPanel,
  isManagerPanelOpen,
  openManagerPanel,
} from '../openManagerPanel';
import { PanelRight, PanelRightClose, PanelRightOpen } from '@lucide/vue';
import { Button } from '@/shared/ui/button';

/**
 * 面板开合按钮(custom-styles Feature 自有,评审候选 2 Q2):
 * toggle 状态机、图标三态、开合调用自包含;错误经 emit 交宿主底栏显示。
 * 本组件不碰心跳 storage —— 心跳唯一写入者是 trackPanelAlive(Q1)。
 */
const emit = defineEmits<{ hint: [text: string] }>();

// 侧边栏开合状态:Firefox 走平台查询;Chromium 读面板自报心跳(只读)
const panelOpen = ref<boolean | null>(null);
onMounted(async () => {
  panelOpen.value = await isManagerPanelOpen();
});

// 面板停靠屏幕右侧:关 → PanelRightOpen(左箭头,拉出来)/ 开 → PanelRightClose(右箭头,推回去)/ 未知 → PanelRight
const panelIcon = computed(() =>
  panelOpen.value === true ? PanelRightClose : panelOpen.value === false ? PanelRightOpen : PanelRight,
);
const panelLabel = computed(() => (panelOpen.value === true ? '收起侧边栏' : '打开侧边栏'));

const emitHint = (text: string) => emit('hint', text);

async function togglePanel() {
  if (panelOpen.value) {
    const ok = await closeManagerPanel();
    if (ok)
      panelOpen.value = false;
    else emitHint('此浏览器不支持脚本收起,请在面板右上角关闭');
  }
  else {
    const ok = await openManagerPanel();
    // open 成功只更新本地图标;心跳留给面板自报(亚秒窗口假阴性,自愈 —— Q1)
    if (ok)
      panelOpen.value = true;
    else emitHint('未能自动打开侧边栏');
  }
}
</script>

<template>
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
</template>
