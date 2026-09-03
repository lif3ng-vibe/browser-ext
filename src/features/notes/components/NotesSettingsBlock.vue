<!-- src/features/notes/components/NotesSettingsBlock.vue -->
<script lang="ts" setup>
import { Checkbox } from '@/shared/ui/checkbox';
import { Label } from '@/shared/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { useNotes } from '../store';

/** 便签总开关:关闭只停宿主页面悬浮卡片注入,数据保留,侧栏/便签板不受影响(规格 #21/#27) */
const { enabled, setEnabled } = useNotes();
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-base">
        便签
      </CardTitle>
      <CardDescription>关闭后页面不再浮现便签卡片,数据保留;侧栏与便签板不受影响</CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-3">
      <div class="flex items-center gap-2">
        <Checkbox
          id="notes-enabled"
          :model-value="enabled"
          @update:model-value="(v) => setEnabled(v === true)"
        />
        <Label
          for="notes-enabled"
          class="text-sm"
        >在网页中显示便签卡片</Label>
      </div>
    </CardContent>
  </Card>
</template>
