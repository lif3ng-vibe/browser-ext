<!-- src/features/user-scripts/components/UserScriptList.vue -->
<script lang="ts" setup>
import type { UserScript, RunAt } from '../types';
import { RUN_AT_LABEL } from '../types';
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/checkbox';
import { ArrowDown, ArrowUp, ChevronDown, Pencil, Trash2 } from '@lucide/vue';

defineProps<{ scripts: UserScript[] }>();
const emit = defineEmits<{
  toggle: [id: string, enabled: boolean];
  edit: [id: string];
  remove: [id: string];
  move: [id: string, delta: -1 | 1];
  runAt: [id: string, runAt: RunAt];
}>();

function summary(s: UserScript): string {
  if (s.patterns.length === 1 && s.patterns[0] === '<all_urls>') return '全局';
  if (s.patterns.length === 0) return '无作用域';
  return `${s.patterns.length} 个作用域`;
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <p
      v-if="!scripts.length"
      class="text-muted-foreground text-sm"
    >
      暂时没有用户脚本。
    </p>
    <div
      v-for="(s, i) in scripts"
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
      <label
        class="border-border text-muted-foreground flex shrink-0 items-center gap-1 rounded-md border px-1 py-0.5 text-xs"
        :aria-label="`${s.name} 的执行时机`"
      >
        <ChevronDown class="size-3" />
        <select
          class="bg-background cursor-pointer appearance-none pr-0.5 text-xs focus:outline-none"
          :value="s.runAt"
          @change="emit('runAt', s.id, ($event.target as HTMLSelectElement).value as RunAt)"
        >
          <option
            v-for="(label, value) in RUN_AT_LABEL"
            :key="value"
            :value="value"
          >
            {{ label }}
          </option>
        </select>
      </label>
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
          :disabled="i === scripts.length - 1"
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
