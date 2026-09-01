<!-- src/features/settings/components/EditorSettingsBlock.vue -->
<script lang="ts" setup>
import { useEditorWrap } from '@/shared/editor/useEditorWrap';
import { Checkbox } from '@/shared/ui/checkbox';
import { Label } from '@/shared/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';

/** 编辑器全局设置:自动折行(对全插件所有代码输入区生效,含未来 Feature 复用) */
const { wrap, setWrap } = useEditorWrap();
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-base">
        编辑器
      </CardTitle>
      <CardDescription>代码输入区的全局偏好(对所有使用编辑器的功能生效)</CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-3">
      <div class="flex items-center gap-2">
        <Checkbox
          id="editor-wrap"
          :model-value="wrap"
          @update:model-value="(v) => setWrap(v === true)"
        />
        <Label
          for="editor-wrap"
          class="text-sm"
        >自动折行(关闭后长行横向滚动)</Label>
      </div>
    </CardContent>
  </Card>
</template>
