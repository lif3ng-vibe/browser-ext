<!-- src/features/notes/components/NoteEditor.vue -->
<script lang="ts" setup>
import { onBeforeUnmount, ref, watch } from 'vue';
import { Button } from '@/shared/ui/button';
import { Trash2 } from '@lucide/vue';
import { useNotes } from '../store';
import type { Note } from '../types';

/**
 * 便签共享编辑组件(输入即存,规格 #21):
 * 卡片/侧栏/便签板/popup 四处复用;编辑行为(输入→防抖→落盘、删除 confirm)只在此测。
 */
const props = defineProps<{ note: Note }>();
const emit = defineEmits<{ removed: [id: string] }>();
const store = useNotes();

const text = ref(props.note.text);

// 父组件换编辑对象(含幽灵晋升后同 id 换持久对象)时重置本地文本
watch(
  () => [props.note.id, props.note.text] as const,
  () => {
    text.value = props.note.text;
  },
);

/** 输入即存防抖(规格 #21 ~500ms;确切时长不测) */
const DEBOUNCE_MS = 500;

/** 防抖计时器;undefined = 无待存输入 */
let timer: number | undefined;

/** 防抖到期/失焦/卸载共用的冲刷:仅在文本真变化时写 storage(空转守卫在 store 内) */
function flush() {
  if (timer === undefined) return;
  window.clearTimeout(timer);
  timer = undefined;
  if (text.value !== props.note.text) void store.update(props.note.id, text.value);
}

function onInput() {
  if (timer !== undefined) window.clearTimeout(timer);
  timer = window.setTimeout(flush, DEBOUNCE_MS);
}

onBeforeUnmount(flush);

async function confirmRemove() {
  if (!window.confirm('删除这条便签?不可恢复。')) return;
  await store.remove(props.note.id);
  emit('removed', props.note.id);
}
</script>

<template>
  <div class="border-border rounded-md border p-2">
    <textarea
      v-model="text"
      rows="3"
      class="bg-transparent text-sm outline-none resize-none w-full"
      placeholder="随手记一句…"
      @input="onInput"
      @blur="flush"
    />
    <div class="flex justify-end">
      <Button
        variant="ghost"
        size="icon"
        aria-label="删除"
        @click="confirmRemove"
      >
        <Trash2 class="size-4" />
      </Button>
    </div>
  </div>
</template>