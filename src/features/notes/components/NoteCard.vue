<!-- src/features/notes/components/NoteCard.vue -->
<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { Button } from '@/shared/ui/button';
import { X } from '@lucide/vue';
import NoteEditor from './NoteEditor.vue';
import { useNotes } from '../store';
import type { Note } from '../types';

/**
 * 悬浮卡片(规格 #21/#23):折叠=右下角圆点+数量角标,展开=就地增删改。
 * 视图是 currentUrl 的纯派生;SPA 换页由注入方提供 currentUrl。
 */
const props = defineProps<{ currentUrl: string }>();
const store = useNotes();

// ---- 视图派生:storage 重查 wholesale 替换;幽灵(未输入)只在创建方上下文乐观展示 ----

const pageNotes = ref<Note[]>([]);
const localGhosts = ref<Note[]>([]);

async function requery() {
  pageNotes.value = await store.getByPage(props.currentUrl);
  // 幽灵晋升后同 id 已在 storage:从乐观列表退役
  localGhosts.value = localGhosts.value.filter((g) => !pageNotes.value.some((n) => n.id === g.id));
}

const displayNotes = computed(() => [...pageNotes.value, ...localGhosts.value]);

watch(
  () => store.notes.value,
  () => void requery(),
);
void requery();

// ---- 展开/收起:按归一化 URL 记忆(session 级)。
//      归一化键取自查询结果(note.url 已由 store 归一化,不重暴露归一化纯函数);
//      新页默认收起,hash 跳转(同一归一化键)展开状态不动 ----

const expanded = ref(false);

/** 展开状态记忆表:键 = 归一化 URL */
const expandedByUrl = new Map<string, boolean>();

async function onUrlChange() {
  // 离开旧页前落记忆(此刻 pageNotes 仍是旧页的,键即旧页归一化 URL)
  const oldKey = pageNotes.value[0]?.url;
  if (oldKey) expandedByUrl.set(oldKey, expanded.value);

  localGhosts.value = []; // 幽灵只属于创建它的页面
  await requery();
  expanded.value = expandedByUrl.get(pageNotes.value[0]?.url ?? '') ?? false; // 新页默认收起
}

watch(() => props.currentUrl, () => void onUrlChange());

// ---- 新增:幽灵态新建 + 乐观插入;首次输入才落 storage(由 NoteEditor 触发) ----

async function createGhost() {
  const ghost = await store.create(props.currentUrl);
  localGhosts.value.push(ghost);
}

/** NoteEditor removed 事件:从乐观列表退役(持久删除走 storage watch 重查) */
function retireGhost(id: string) {
  localGhosts.value = localGhosts.value.filter((g) => g.id !== id);
}
</script>

<template>
  <!-- 总开关:关闭 = 停止页面浮现(数据保留),开/关实时跟随 storage -->
  <div v-if="store.enabled.value">
    <button
      v-if="displayNotes.length > 0 && !expanded"
      data-testid="note-dot"
      type="button"
      class="bg-primary text-primary-foreground fixed bottom-5 right-5 z-50 flex size-12 items-center justify-center rounded-full shadow-lg"
      aria-label="打开本页便签"
      @click="expanded = true"
    >
      <span
        data-testid="note-badge"
        class="bg-destructive text-destructive-foreground absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full text-xs"
      >{{ displayNotes.length }}</span>
    </button>

    <div
      v-if="expanded"
      data-testid="note-card"
      class="bg-background text-foreground border-border fixed bottom-5 right-5 z-50 flex w-80 flex-col gap-2 rounded-lg border p-3 shadow-lg"
    >
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium">本页便签</span>
        <Button
          data-testid="note-collapse"
          variant="ghost"
          size="icon"
          aria-label="收起便签"
          @click="expanded = false"
        >
          <X class="size-4" />
        </Button>
      </div>
      <div class="flex max-h-72 flex-col gap-2 overflow-y-auto">
        <NoteEditor
          v-for="n in displayNotes"
          :key="n.id"
          :note="n"
          @removed="retireGhost"
        />
      </div>
      <Button
        variant="outline"
        aria-label="新增便签"
        @click="createGhost"
      >
        新增便签
      </Button>
    </div>
  </div>
</template>