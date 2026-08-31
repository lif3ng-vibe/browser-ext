<script lang="ts" setup>
import ThemeQuickSwitch from './components/ThemeQuickSwitch.vue';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
</script>

<template>
  <main class="bg-background text-foreground min-h-screen p-6 font-sans">
    <div class="mx-auto flex max-w-md flex-col gap-4">
      <h1 class="text-lg font-medium">
        设置
      </h1>

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
    </div>
  </main>
</template>