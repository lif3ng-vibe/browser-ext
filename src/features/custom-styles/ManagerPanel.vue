<!-- src/features/custom-styles/ManagerPanel.vue -->
<script lang="ts" setup>
import { computed } from 'vue';
import { useTheme } from '@/shared/theme/useTheme';
import { Button } from '@/shared/ui/button';
import StyleList from './components/StyleList.vue';
import StyleEditor from './components/StyleEditor.vue';
import { trackPanelAlive } from './openManagerPanel';
import { useCustomStyles } from './useCustomStyles';

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

async function confirmRemove(id: string) {
  const target = store.styles.value.find((s) => s.id === id);
  if (!target) return;
  if (!window.confirm(`删除「${target.name}」?不可恢复。`)) return;
  await store.remove(id);
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
          @remove="confirmRemove"
          @move="(id, d) => store.move(id, d)"
        />
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