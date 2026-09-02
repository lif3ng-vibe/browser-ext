<!-- src/features/custom-styles/ManagerPanel.vue -->
<script lang="ts" setup>
import { computed, ref } from 'vue';
import { useTheme } from '@/shared/theme/useTheme';
import { Button } from '@/shared/ui/button';
import StyleList from './components/StyleList.vue';
import StyleEditor from './components/StyleEditor.vue';
import { trackPanelAlive } from './openManagerPanel';
import { useCustomStyles } from './store';

useTheme(); // 侧边栏页吃主题系统,跨页面即改即随
trackPanelAlive(); // 心跳登记:popup 据此判断面板开合(Chromium 无查询 API)
const store = useCustomStyles();

const editing = computed(() =>
  store.styles.value.find((s) => s.id === store.editingId.value) ?? null,
);

async function newStyle() {
  const s = await store.create();
  await store.setEditing(s.id);
}

// 删除确认页内化:与 options 管理块同构(原生 dialog 在嵌入式入口被静默抑制,统一不用)
interface PendingConfirm {
  msg: string;
  confirmLabel: string;
  action: () => Promise<void>;
}
const pendingConfirm = ref<PendingConfirm | null>(null);

/** 删除请求 → 页内确认条 */
function requestRemove(id: string) {
  const target = store.styles.value.find((s) => s.id === id);
  if (!target) return;
  pendingConfirm.value = {
    msg: `删除「${target.name}」?不可恢复。`,
    confirmLabel: '确认删除',
    action: () => store.remove(id),
  };
}

/** 确认条按钮:执行动作并收起 */
async function acceptConfirm() {
  const pending = pendingConfirm.value;
  if (!pending) return;
  pendingConfirm.value = null;
  await pending.action();
}

/** 确认条按钮:放弃 */
function cancelConfirm() {
  pendingConfirm.value = null;
}
</script>

<template>
  <main class="bg-background text-foreground flex h-screen flex-col gap-3 p-3 font-sans">
    <h1 class="text-base font-medium">
      自定义样式
    </h1>

    <StyleEditor
      v-if="editing"
      :key="editing.id"
      :record="editing"
    />
    <template v-else>
      <div class="min-h-0 flex-1 overflow-y-auto">
        <StyleList
          :styles="store.styles.value"
          @toggle="(id, on) => store.update(id, { enabled: on })"
          @edit="(id) => store.setEditing(id)"
          @remove="requestRemove"
          @move="(id, d) => store.move(id, d)"
        />
      </div>
      <div
        v-if="pendingConfirm"
        data-testid="confirm-banner"
        class="border-border shrink-0 rounded-md border p-2"
      >
        <p class="text-sm">
          {{ pendingConfirm.msg }}
        </p>
        <div class="mt-2 flex gap-2">
          <Button
            size="sm"
            @click="acceptConfirm"
          >
            {{ pendingConfirm.confirmLabel }}
          </Button>
          <Button
            size="sm"
            variant="outline"
            @click="cancelConfirm"
          >
            取消
          </Button>
        </div>
      </div>
      <Button
        class="shrink-0"
        @click="newStyle"
      >
        新建样式
      </Button>
    </template>
  </main>
</template>