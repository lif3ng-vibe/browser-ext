<!-- src/shared/editor/CodeEditor.vue -->
<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { EditorView, basicSetup } from 'codemirror';
import { css } from '@codemirror/lang-css';

const props = defineProps<{ modelValue: string; wrap?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const container = ref<HTMLDivElement>();
let view: EditorView | undefined;

// 主题:全部走 semantic token,随 data-theme 联动
// 选区色从 primary 派生(basicSetup 默认选区色在语义背景上几乎不可见)
const editorTheme = EditorView.theme({
  '&': { backgroundColor: 'var(--lif3ng-background)', color: 'var(--lif3ng-foreground)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-content': { caretColor: 'var(--lif3ng-primary)', fontFamily: 'var(--lif3ng-font-mono)' },
  '.cm-gutters': {
    backgroundColor: 'var(--lif3ng-muted)',
    color: 'var(--lif3ng-muted-foreground)',
    border: 'none',
  },
  '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'var(--lif3ng-muted)' },
  '.cm-selectionBackground': {
    backgroundColor: 'color-mix(in srgb, var(--lif3ng-primary) 50%, transparent) !important',
  },
  '&.cm-focused .cm-selectionBackground': {
    backgroundColor: 'color-mix(in srgb, var(--lif3ng-primary) 75%, transparent) !important',
  },
});

function buildExtensions() {
  return [
    basicSetup,
    css(),
    // 默认折行;wrap === false 时关闭
    ...(props.wrap === false ? [] : [EditorView.lineWrapping]),
    editorTheme,
    EditorView.updateListener.of((u) => {
      if (u.docChanged) emit('update:modelValue', u.state.doc.toString());
    }),
  ];
}

onMounted(() => {
  view = new EditorView({
    doc: props.modelValue,
    parent: container.value!,
    extensions: buildExtensions(),
  });
});

// 折行开关:重建视图等效 reconfigure(@codemirror/state 非直接依赖,Compartment 不可 import)
watch(
  () => props.wrap,
  () => {
    if (!view) return;
    const doc = view.state.doc.toString();
    const { anchor, head } = view.state.selection.main;
    view.destroy();
    view = new EditorView({
      doc,
      selection: { anchor, head },
      parent: container.value!,
      extensions: buildExtensions(),
    });
  },
);

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
