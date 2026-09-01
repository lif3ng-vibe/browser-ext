<!-- src/features/custom-styles/components/StyleEditor.vue -->
<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { useDebounceFn } from '@vueuse/core';
import CodeEditor from '@/shared/editor/CodeEditor.vue';
import { useEditorWrap } from '@/shared/editor/useEditorWrap';
import { useCustomStyles } from '../useCustomStyles';
import { useActiveTab } from '../useActiveTab';
import { expandDomain } from '../matcher';
import { PREVIEW_MSG } from '../messages';
import type { CustomStyle } from '../types';
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/checkbox';
import { Label } from '@/shared/ui/label';

const props = defineProps<{ record: CustomStyle }>();
const store = useCustomStyles();
const activeTab = useActiveTab();

const name = ref(props.record.name);
const patternsText = ref(props.record.patterns.join('\n'));
const code = ref(props.record.code);

// 折行开关:持久化在 storage,默认开(共享 composable,各 Feature 代码输入区共用)
const { wrap, setWrap } = useEditorWrap();

// 裸域名 → 精确+子域 两条 pattern;完整 pattern 原样保留
function parsePatterns(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split('\n').map((l) => l.trim()).filter(Boolean)) {
    out.push(...expandDomain(line));
  }
  return [...new Set(out)];
}

const dirty = computed(
  () =>
    name.value !== props.record.name ||
    code.value !== props.record.code ||
    JSON.stringify(parsePatterns(patternsText.value)) !== JSON.stringify(props.record.patterns),
);

// 编辑对象切换(外层 record 变了)→ 表单重置
watch(
  () => props.record.id,
  () => {
    name.value = props.record.name;
    patternsText.value = props.record.patterns.join('\n');
    code.value = props.record.code;
  },
);

const previewable = computed(() => /^https?:/.test(activeTab.value?.url ?? ''));

async function sendPreview() {
  const id = activeTab.value?.id;
  if (id == null || !dirty.value || !previewable.value) return;
  try {
    await browser.tabs.sendMessage(id, { type: PREVIEW_MSG.PREVIEW, css: code.value });
  } catch {
    /* 该页没有 content script(如受保护页面),忽略 */
  }
}
const sendPreviewDebounced = useDebounceFn(() => void sendPreview(), 300);
watch(code, () => void sendPreviewDebounced());

// 活动标签页切换:旧 tab 收走预览;若仍脏,新 tab 继续预览
watch(activeTab, async (next, prev) => {
  if (prev?.id != null) {
    try {
      await browser.tabs.sendMessage(prev.id, { type: PREVIEW_MSG.CLEAR });
    } catch { /* 无 content script */ }
  }
  if (next && dirty.value) void sendPreviewDebounced();
});

async function save() {
  name.value = name.value.trim();
  await store.update(props.record.id, {
    name: name.value || '未命名样式',
    code: code.value,
    patterns: parsePatterns(patternsText.value),
  });
  const id = activeTab.value?.id;
  if (id != null) {
    try {
      await browser.tabs.sendMessage(id, { type: PREVIEW_MSG.CLEAR });
    } catch { /* 无 content script */ }
  }
}

async function back() {
  if (dirty.value && !window.confirm('有未保存修改,放弃并返回清单?')) return;
  await store.setEditing(null);
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col gap-3">
    <div class="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        aria-label="返回清单"
        @click="back"
      >
        ←
      </Button>
      <input
        v-model="name"
        class="border-input bg-background h-8 w-full rounded-md border px-2 text-sm"
        aria-label="样式名称"
      >
      <span
        v-if="dirty"
        class="bg-secondary text-secondary-foreground shrink-0 rounded px-1.5 py-0.5 text-xs"
      >未保存</span>
      <label class="text-muted-foreground flex shrink-0 cursor-pointer items-center gap-1">
        <Checkbox
          :model-value="wrap"
          aria-label="自动折行"
          @update:model-value="(v) => setWrap(v === true)"
        />
        <span class="text-xs">折行</span>
      </label>
      <Button
        variant="outline"
        size="sm"
        :disabled="!dirty"
        @click="save"
      >
        保存
      </Button>
    </div>

    <div class="flex flex-col gap-1">
      <Label
        for="style-patterns"
        class="text-muted-foreground text-xs"
      >作用域:每行一条;裸域名自动展开「精确 + 子域」</Label>
      <textarea
        id="style-patterns"
        v-model="patternsText"
        rows="2"
        class="border-input bg-background text-foreground rounded-md border px-2 py-1 font-mono text-xs"
        placeholder="github.com 或 *://github.com/*"
      />
    </div>

    <CodeEditor
      v-model="code"
      :wrap="wrap"
      class="min-h-40 flex-1"
    />
    <p
      v-if="!previewable"
      class="text-muted-foreground text-xs"
    >
      当前页面不支持预览(仅 http/https)。
    </p>
  </div>
</template>