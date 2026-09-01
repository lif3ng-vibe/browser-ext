<!-- src/features/custom-styles/components/StyleList.vue -->
<script lang="ts" setup>
import type { CustomStyle } from '../types';
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/checkbox';
import { ArrowDown, ArrowUp, Pencil, Trash2 } from '@lucide/vue';

defineProps<{ styles: CustomStyle[] }>();
const emit = defineEmits<{
  toggle: [id: string, enabled: boolean];
  edit: [id: string];
  remove: [id: string];
  move: [id: string, delta: -1 | 1];
}>();

function summary(s: CustomStyle): string {
  if (s.patterns.length === 1 && s.patterns[0] === '<all_urls>') return '全局';
  if (s.patterns.length === 0) return '无作用域';
  return `${s.patterns.length} 个作用域`;
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <p
      v-if="!styles.length"
      class="text-muted-foreground text-sm"
    >
      暂时没有自定义样式。
    </p>
    <div
      v-for="(s, i) in styles"
      :key="s.id"
      class="border-border flex items-center gap-2 rounded-md border p-2"
    >
      <Checkbox
        :model-value="s.enabled"
        :aria-label="`启用 ${s.name}`"
        @update:model-value="(v) => emit('toggle', s.id, v === true)"
      />
      <button
        type="button"
        class="hover:underline"
        @click="emit('edit', s.id)"
      >
        <span class="text-sm">{{ s.name }}</span>
      </button>
      <span
        class="text-muted-foreground ms-auto shrink-0 text-xs"
        :title="s.patterns.length ? s.patterns.join('\n') : undefined"
      >{{ summary(s) }}</span>
      <span class="flex shrink-0 items-center">
        <Button
          variant="ghost"
          size="icon"
          aria-label="上移"
          :disabled="i === 0"
          @click="emit('move', s.id, -1)"
        >
          <ArrowUp class="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="下移"
          :disabled="i === styles.length - 1"
          @click="emit('move', s.id, 1)"
        >
          <ArrowDown class="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="编辑"
          @click="emit('edit', s.id)"
        >
          <Pencil class="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="删除"
          @click="emit('remove', s.id)"
        >
          <Trash2 class="size-4" />
        </Button>
      </span>
    </div>
  </div>
</template>