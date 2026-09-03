<!-- 便签板薄壳(issue #26,规格 #21 故事 23/25):全局便签的独立小窗主场。
     住薄壳而非 notes Feature:#21「组合逻辑只住薄壳」,入口视图组合归薄壳(NoteTab 先例)。
     内容 = 全局便签列表(NoteEditor 复用,输入即存)+ 就地新建;页面便签不在此出现。 -->
<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { useTheme } from '@/shared/theme/useTheme';
import { Button } from '@/shared/ui/button';
import NoteEditor from '@/features/notes/components/NoteEditor.vue';
import { useNotes } from '@/features/notes/store';
import type { Note } from '@/features/notes/types';

useTheme(); // 薄壳自任页面级主题:跨页面即改即随

const store = useNotes();

// 视图派生(NoteTab 同款):storage 重查 wholesale 替换;幽灵(未输入)只在创建方上下文乐观展示
const globalNotes = ref<Note[]>([]);
const globalGhosts = ref<Note[]>([]);
const displayNotes = computed(() => [...globalNotes.value, ...globalGhosts.value]);

async function requery() {
  globalNotes.value = await store.getGlobal();
  // 幽灵晋升后同 id 已在 storage:从乐观列表退役
  globalGhosts.value = globalGhosts.value.filter((g) => !globalNotes.value.some((n) => n.id === g.id));
}

watch(
  () => store.notes.value,
  () => void requery(),
);
void requery();

/** 全局便签幽灵态新建:url 为 null 的取值特例 */
async function createNote() {
  const ghost = await store.create(null);
  globalGhosts.value.push(ghost);
}

/** NoteEditor removed 事件:从乐观列表退役(持久删除走 storage watch 重查) */
function retireGhost(id: string) {
  globalGhosts.value = globalGhosts.value.filter((g) => g.id !== id);
}
</script>

<template>
  <main class="bg-background text-foreground flex h-screen flex-col gap-3 p-3 font-sans">
    <h1 class="text-base font-medium">
      便签板
    </h1>

    <div class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
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
        还没有全局便签
      </p>
    </div>

    <Button
      variant="outline"
      aria-label="新建全局便签"
      @click="createNote"
    >
      新建全局便签
    </Button>
  </main>
</template>
