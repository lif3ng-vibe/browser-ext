<!-- src/features/custom-styles/components/CodeEditor.vue -->
<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { EditorView, basicSetup } from 'codemirror';
import { css } from '@codemirror/lang-css';

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const container = ref<HTMLDivElement>();
let view: EditorView | undefined;

onMounted(() => {
  view = new EditorView({
    doc: props.modelValue,
    parent: container.value!,
    extensions: [
      basicSetup,
      css(),
      // 主题:全部走 semantic token,随 data-theme 联动
      EditorView.theme({
        '&': { backgroundColor: 'var(--lif3ng-background)', color: 'var(--lif3ng-foreground)' },
        '&.cm-focused': { outline: 'none' },
        '.cm-content': { caretColor: 'var(--lif3ng-primary)', fontFamily: 'var(--lif3ng-font-mono)' },
        '.cm-gutters': {
          backgroundColor: 'var(--lif3ng-muted)',
          color: 'var(--lif3ng-muted-foreground)',
          border: 'none',
        },
        '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'var(--lif3ng-muted)' },
      }),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) emit('update:modelValue', u.state.doc.toString());
      }),
    ],
  });
});

// 外部重置(如切换编辑对象 / 保存后回填)
watch(
  () => props.modelValue,
  (v) => {
    if (view && v !== view.state.doc.toString()) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: v } });
    }
  },
);

onBeforeUnmount(() => view?.destroy());
</script>

<template>
  <div
    ref="container"
    class="border-border overflow-hidden rounded-md border text-sm"
  />
</template>