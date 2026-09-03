<!-- 聚合页薄壳:按 CONTEXT.md「设置区块」词条,跨 Feature 组合只发生在这里 -->
<script lang="ts" setup>
import ThemeSettingsBlock from '@/features/settings/components/ThemeSettingsBlock.vue';
import EditorSettingsBlock from '@/features/settings/components/EditorSettingsBlock.vue';
import ManageStylesBlock from '@/features/custom-styles/components/ManageStylesBlock.vue';
import NotesSettingsBlock from '@/features/notes/components/NotesSettingsBlock.vue';
</script>

<template>
  <main class="bg-background text-foreground min-h-screen p-6 font-sans">
    <div class="mx-auto flex max-w-md flex-col gap-4">
      <h1 class="text-lg font-medium">
        设置
      </h1>
      <ThemeSettingsBlock />
      <EditorSettingsBlock />
      <ManageStylesBlock />
      <NotesSettingsBlock />
    </div>
  </main>
</template>