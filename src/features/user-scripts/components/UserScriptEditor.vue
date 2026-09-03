<!-- src/features/user-scripts/components/UserScriptEditor.vue -->
<script lang="ts" setup>
/**
 * 行内编辑器(#13 规格:options 管理区块内列表 + 编辑,无 sidepanel)。
 * 保存/启停改动下次页面加载生效(词汇表「单次执行」)—— 编辑器常驻提示。
 */
import { computed, ref, watch } from 'vue';
import JsEditor from './JsEditor.vue';
import { useUserScripts } from '../store';
import { firstInvalidPattern, parsePatternsText } from '@/shared/patterns';
import { RUN_AT_LABEL } from '../types';
import type { UserScript, RunAt } from '../types';
import { Button } from '@/shared/ui/button';
import { Label } from '@/shared/ui/label';

const props = defineProps<{ record: UserScript }>();
const store = useUserScripts();

const name = ref(props.record.name);
const patternsText = ref(props.record.patterns.join('\n'));
const code = ref(props.record.code);
const runAt = ref<RunAt>(props.record.runAt);

/** 保存前校验:register 全有或全无,一条坏 pattern 废掉整批 —— 表单拦下并提示 */
const invalidPattern = computed(() => firstInvalidPattern(parsePatternsText(patternsText.value)));

const dirty = computed(
  () =>
    name.value !== props.record.name ||
    code.value !== props.record.code ||
    runAt.value !== props.record.runAt ||
    JSON.stringify(parsePatternsText(patternsText.value)) !== JSON.stringify(props.record.patterns),
);

// 编辑对象切换(外层 record 变了)→ 表单重置
watch(
  () => props.record.id,
  () => {
    name.value = props.record.name;
    patternsText.value = props.record.patterns.join('\n');
    code.value = props.record.code;
    runAt.value = props.record.runAt;
  },
);

async function save() {
  if (invalidPattern.value) return; // 坏 pattern 不落库(见模板提示条)
  name.value = name.value.trim();
  await store.update(props.record.id, {
    name: name.value || '未命名脚本',
    code: code.value,
    patterns: parsePatternsText(patternsText.value),
    runAt: runAt.value,
  });
}

async function back() {
  if (dirty.value && !window.confirm('有未保存修改,放弃并返回清单?')) return;
  await store.setEditing(null);
}
</script>

<template>
  <div
    class="border-border flex flex-col gap-3 rounded-md border p-3"
    data-testid="user-script-editor"
  >
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
        aria-label="脚本名称"
      >
      <span
        v-if="dirty"
        class="bg-secondary text-secondary-foreground shrink-0 rounded px-1.5 py-0.5 text-xs"
      >未保存</span>
      <Button
        variant="outline"
        size="sm"
        :disabled="!dirty || !!invalidPattern"
        @click="save"
      >
        保存
      </Button>
    </div>

    <div class="flex flex-col gap-1">
      <Label
        for="user-script-patterns"
        class="text-muted-foreground text-xs"
      >作用域:每行一条;裸域名自动展开「精确 + 子域」</Label>
      <textarea
        id="user-script-patterns"
        v-model="patternsText"
        rows="2"
        class="border-input bg-background text-foreground rounded-md border px-2 py-1 font-mono text-xs"
        placeholder="github.com 或 *://github.com/*"
      />
      <p
        v-if="invalidPattern"
        data-testid="pattern-error"
        class="text-destructive text-xs"
      >
        「{{ invalidPattern }}」不是合法作用域。裸域名不带端口;带端口的请写完整形式,如 *://127.0.0.1:8080/*
      </p>
    </div>

    <div class="flex flex-col gap-1">
      <Label
        for="user-script-runat"
        class="text-muted-foreground text-xs"
      >执行时机</Label>
      <select
        id="user-script-runat"
        v-model="runAt"
        class="border-input bg-background text-foreground h-8 rounded-md border px-2 text-sm"
      >
        <option
          v-for="(label, value) in RUN_AT_LABEL"
          :key="value"
          :value="value"
        >
          {{ label }}
        </option>
      </select>
    </div>

    <JsEditor
      v-model="code"
      class="min-h-40 flex-1"
    />
    <p class="text-muted-foreground text-xs">
      保存后改动在页面下次加载时生效(JS 已执行无法撤销);SPA 换页需脚本自行监听。
    </p>
  </div>
</template>
