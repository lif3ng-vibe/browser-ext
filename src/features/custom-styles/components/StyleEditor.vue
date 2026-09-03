<!-- src/features/custom-styles/components/StyleEditor.vue -->
<script lang="ts" setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useDebounceFn } from '@vueuse/core';
import CodeEditor from '@/shared/editor/CodeEditor.vue';
import { useCustomStyles } from '../store';
import { useActiveTab } from '@/shared/useActiveTab';
import { parsePatternsText } from '@/shared/patterns';
import { isPreviewable, usePreviewSession } from '../previewSession';
import type { CustomStyle } from '../types';
import { Button } from '@/shared/ui/button';
import { Label } from '@/shared/ui/label';

const props = defineProps<{ record: CustomStyle }>();
const store = useCustomStyles();
const activeTab = useActiveTab();

const name = ref(props.record.name);
const patternsText = ref(props.record.patterns.join('\n'));
const code = ref(props.record.code);

const dirty = computed(
  () =>
    name.value !== props.record.name ||
    code.value !== props.record.code ||
    JSON.stringify(parsePatternsText(patternsText.value)) !== JSON.stringify(props.record.patterns),
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

// 预览会话:租约式生命周期,纪律(tab 清旧、释放、门控)全在 module 内
const preview = usePreviewSession(activeTab, () =>
  dirty.value && code.value.trim() ? code.value : undefined,
);
const sendPreviewDebounced = useDebounceFn(() => void preview.renew(), 300);
watch(code, () => void sendPreviewDebounced());
const previewable = computed(() => isPreviewable(activeTab.value?.url));

async function save() {
  name.value = name.value.trim();
  await store.update(props.record.id, {
    name: name.value || '未命名样式',
    code: code.value,
    patterns: parsePatternsText(patternsText.value),
  });
  // 保存语义:先持久化,后释放预览(storage watch 落地前可能有毫秒级回闪,issue #16 Q4)
  await preview.release();
}

async function back() {
  if (dirty.value && !window.confirm('有未保存修改,放弃并返回清单?')) return;
  await preview.release(); // 泄漏路径 (a):放弃草稿也要收走预览(issue #16 Q3)
  await store.setEditing(null);
}

// 泄漏路径 (b):编辑器卸载(面板关闭等)释放预览
onBeforeUnmount(() => {
  void preview.release();
});
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
