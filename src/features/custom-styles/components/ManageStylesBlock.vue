<!-- src/features/custom-styles/components/ManageStylesBlock.vue -->
<script lang="ts" setup>
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import StyleList from './StyleList.vue';
import { useCustomStyles } from '../store';
import { openManagerPanel } from '../openManagerPanel';

const store = useCustomStyles();

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
      <Button
        variant="outline"
        class="w-full"
        @click="createAndEdit"
      >
        新建样式(在侧边栏编辑)
      </Button>
    </CardContent>
  </Card>
</template>