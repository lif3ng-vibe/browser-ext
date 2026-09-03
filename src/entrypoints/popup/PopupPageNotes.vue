<!-- popup 本页便签过滤视图(issue #26,规格 #21 故事 26):与侧栏本页视图同源逻辑、空间紧凑。
     住薄壳而非 notes Feature:#21「组合逻辑只住薄壳」;只读展示(编辑入口指向便签板/侧栏,v1 不在 popup 里编辑)。 -->
<script lang="ts" setup>
import { ref, watch } from 'vue';
import { useActiveTab } from '@/shared/useActiveTab';
import { useNotes } from '@/features/notes/store';
import type { Note } from '@/features/notes/types';

const store = useNotes();
const activeTab = useActiveTab();

const pageNotes = ref<Note[]>([]);

async function requery() {
  const url = activeTab.value?.url;
  pageNotes.value = url ? await store.getByPage(url) : [];
}

watch(
  () => [store.notes.value, activeTab.value?.url] as const,
  () => void requery(),
);
void requery();
</script>

<template>
  <section
    data-testid="popup-page-notes"
    class="mt-3"
  >
    <h2 class="text-muted-foreground mb-1 text-xs font-medium">
      本页便签
    </h2>
    <ul
      v-if="pageNotes.length"
      class="flex flex-col gap-1"
    >
      <li
        v-for="n in pageNotes"
        :key="n.id"
        class="text-foreground line-clamp-2 text-xs whitespace-pre-wrap"
      >
        {{ n.text }}
      </li>
    </ul>
    <p
      v-else
      class="text-muted-foreground text-xs"
    >
      此页无便签
    </p>
  </section>
</template>
