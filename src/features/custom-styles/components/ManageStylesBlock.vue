<!-- src/features/custom-styles/components/ManageStylesBlock.vue -->
<script lang="ts" setup>
import { ref } from 'vue';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import StyleList from './StyleList.vue';
import { useCustomStyles } from '../store';
import { openManagerPanel } from '../openManagerPanel';
import { backupFileName, downloadStylesFile, exportStyles, mergeById, parseBackup } from '../backup';
import type { CustomStyle } from '../types';

const store = useCustomStyles();
const fileInput = ref<HTMLInputElement | null>(null);

// 导入确认/提示走页内 UI:嵌入式 options(chrome://extensions 卡片「选项」= iframe)里
// window.confirm/alert 被 Chrome 静默抑制,原生 dialog 不可依赖
const pendingImport = ref<{ msg: string; styles: CustomStyle[] } | null>(null);
const importNotice = ref<string | null>(null);

/** 编辑动作 = 设定编辑对象 + 尝试唤起侧边栏;唤不起就提示手动开 */
async function edit(id: string) {
  await store.setEditing(id);
  if (!(await openManagerPanel())) {
    window.alert('未能自动打开侧边栏,请手动打开浏览器的扩展侧边栏查看编辑器。');
  }
}

async function createAndEdit() {
  const s = await store.create();
  await edit(s.id);
}

async function confirmRemove(id: string) {
  const target = store.styles.value.find((s) => s.id === id);
  if (!target) return;
  if (!window.confirm(`删除「${target.name}」?不可恢复。`)) return;
  await store.remove(id);
}

/** 导出:全量样式 → 备份文件下载(不加 downloads 权限) */
function exportBackup() {
  downloadStylesFile(
    backupFileName(new Date()),
    exportStyles(store.styles.value, new Date().toISOString()),
  );
}

/** 导入:严格解析 → 页内摘要确认条 → 按 id 合并;错则页内提示且不动 storage */
async function onImportFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = ''; // 清空以允许重选同一文件
  if (!file) return;

  pendingImport.value = null;
  importNotice.value = null;
  const parsed = parseBackup(await file.text());
  if (!parsed.ok) {
    importNotice.value = `导入失败:${parsed.error}`;
    return;
  }
  const { overridden, added } = mergeById(store.styles.value, parsed.styles);
  if (overridden === 0 && added === 0) {
    importNotice.value = '备份文件没有样式,没有可导入的内容。';
    return;
  }
  let msg = `导入将覆盖 ${overridden} 条、新增 ${added} 条样式。`;
  if (store.editingId.value !== null && parsed.styles.some((s) => s.id === store.editingId.value)) {
    msg += '文件包含正在编辑的样式,导入后编辑会话将结束。';
  }
  pendingImport.value = { msg, styles: parsed.styles };
}

/** 确认条按钮:落盘导入并收起确认条 */
async function confirmImport() {
  const pending = pendingImport.value;
  if (!pending) return;
  pendingImport.value = null;
  await store.importStyles(pending.styles);
}

/** 确认条按钮:放弃 */
function cancelImport() {
  pendingImport.value = null;
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-base">
        自定义样式
      </CardTitle>
      <CardDescription>按域名/全局注入 CSS;编辑与所见即所得预览在侧边栏进行</CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-3">
      <StyleList
        :styles="store.styles.value"
        @toggle="(id, on) => store.update(id, { enabled: on })"
        @edit="edit"
        @remove="confirmRemove"
        @move="(id, d) => store.move(id, d)"
      />
      <p
        v-if="importNotice"
        data-testid="import-notice"
        class="text-muted-foreground text-sm"
      >
        {{ importNotice }}
      </p>
      <div
        v-if="pendingImport"
        data-testid="import-confirm"
        class="border-border rounded-md border p-2"
      >
        <p class="text-sm">
          {{ pendingImport.msg }}
        </p>
        <div class="mt-2 flex gap-2">
          <Button
            size="sm"
            @click="confirmImport"
          >
            确认导入
          </Button>
          <Button
            size="sm"
            variant="outline"
            @click="cancelImport"
          >
            取消
          </Button>
        </div>
      </div>
      <Button
        variant="outline"
        class="w-full"
        @click="createAndEdit"
      >
        新建样式(在侧边栏编辑)
      </Button>
      <div class="flex gap-2">
        <Button
          variant="outline"
          class="flex-1"
          @click="exportBackup"
        >
          导出
        </Button>
        <Button
          variant="outline"
          class="flex-1"
          @click="fileInput?.click()"
        >
          导入
        </Button>
        <input
          ref="fileInput"
          type="file"
          accept="application/json,.json"
          class="hidden"
          @change="onImportFile"
        >
      </div>
    </CardContent>
  </Card>
</template>
