<!-- 便签 tab(issue #24 T3 最小列表;#25 T4 长成定稿双分区形态)。
     住薄壳而非 notes Feature:#21「组合逻辑只住薄壳」,侧栏聚合的视图组合归薄壳。 -->
<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { Button } from '@/shared/ui/button';
import { useActiveTab } from '@/shared/useActiveTab';
import NoteEditor from '@/features/notes/components/NoteEditor.vue';
import { useNotes } from '@/features/notes/store';
import type { Note } from '@/features/notes/types';

const store = useNotes();

const activeTab = useActiveTab();

// 视图派生(NoteCard 同款):storage 重查 wholesale 替换;幽灵(未输入)只在创建方上下文乐观展示
const pageNotes = ref<Note[]>([]);
const localGhosts = ref<Note[]>([]);
const displayNotes = computed(() => [...pageNotes.value, ...localGhosts.value]);

async function requery() {
  const url = activeTab.value?.url;
  pageNotes.value = url ? await store.getByPage(url) : [];
  // 幽灵晋升后同 id 已在 storage:从乐观列表退役
  localGhosts.value = localGhosts.value.filter((g) => !pageNotes.value.some((n) => n.id === g.id));
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
}

/** NoteEditor removed 事件:从乐观列表退役(持久删除走 storage watch 重查) */
function retireGhost(id: string) {
  localGhosts.value = localGhosts.value.filter((g) => g.id !== id);
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
