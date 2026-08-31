<!-- src/features/settings/components/ThemeSettingsBlock.vue -->
<script lang="ts" setup>
import ThemeQuickSwitch from './ThemeQuickSwitch.vue';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-base">
        外观
      </CardTitle>
      <CardDescription>主题与跟随系统(改动即时生效于所有扩展页面)</CardDescription>
    </CardHeader>
    <CardContent>
      <ThemeQuickSwitch />
    </CardContent>
  </Card>
</template>