<!-- 便签 tab 最小本页列表(issue #24 T3;完全体 #25 T4)。
     住薄壳而非 notes Feature:v1 最小实现按 #21「组合逻辑只住薄壳」,
     T4 完全体(双分区+空态引导)再评估去留。useActiveTab 镜像:
     Feature 间禁止 import,薄壳不能 import custom-styles 的 composable。 -->
<script lang="ts" setup>
import { ref, watch } from 'vue';
import type { Browser } from 'wxt/browser';
import { Button } from '@/shared/ui/button';
import NoteEditor from '@/features/notes/components/NoteEditor.vue';
import { useNotes } from '@/features/notes/store';
import type { Note } from '@/features/notes/types';

const store = useNotes();

// useActiveTab 镜像(custom-styles 先例):激活/URL 变化/关闭都重查
const activeTab = ref<Browser.tabs.Tab | undefined>();
const sync = async () => {
  const [active] = await browser.tabs.query({ active: true, currentWindow: true });
  activeTab.value = active;
};
void sync();
browser.tabs.onActivated.addListener(() => void sync());
browser.tabs.onUpdated.addListener(() => void sync());

// 视图派生(NoteCard 同款):storage 重查 wholesale 替换;幽灵(未输入)只在创建方上下文乐观展示
const pageNotes = ref<Note[]>([]);
const localGhosts = ref<Note[]>([]);
const displayNotes = ref<Note[]>([]);

async function requery() {
  const url = activeTab.value?.url;
  pageNotes.value = url ? await store.getByPage(url) : [];
  // 幽灵晋升后同 id 已在 storage:从乐观列表退役
  localGhosts.value = localGhosts.value.filter((g) => !pageNotes.value.some((n) => n.id === g.id));
  displayNotes.value = [...pageNotes.value, ...localGhosts.value];
}

watch(
  () => [store.notes.value, activeTab.value?.url] as const,
  () => void requery(),
);
void requery();

/** 幽灵态新建:绑定当前 tab URL,text 非空前不落 storage */
async function createNote() {
  const url = activeTab.value?.url;
  if (!url) return;
  const ghost = await store.create(url);
  localGhosts.value.push(ghost);
  displayNotes.value = [...pageNotes.value, ...localGhosts.value];
}

/** NoteEditor removed 事件:从乐观列表退役(持久删除走 storage watch 重查) */
function retireGhost(id: string) {
  localGhosts.value = localGhosts.value.filter((g) => g.id !== id);
  displayNotes.value = [...pageNotes.value, ...localGhosts.value];
}
</script>

<template>
  <div
    data-testid="notes-tab-content"
    class="flex flex-col gap-2"
  >
    <h1 class="text-base font-medium">
      便签
    </h1>
    <p class="text-muted-foreground truncate text-xs">
      {{ activeTab?.url ?? '无活动标签页' }}
    </p>
    <div class="flex flex-col gap-2">
      <NoteEditor
        v-for="n in displayNotes"
        :key="n.id"
        :note="n"
        @removed="retireGhost"
      />
      <p
        v-if="!displayNotes.length"
        class="text-muted-foreground text-sm"
      >
        此页还没有便签。
      </p>
    </div>
    <Button
      variant="outline"
      :disabled="!activeTab?.url"
      aria-label="新建便签"
      @click="createNote"
    >
      新建便签
    </Button>
  </div>
</template>
