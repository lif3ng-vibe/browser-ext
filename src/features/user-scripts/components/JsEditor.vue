<!-- src/features/user-scripts/components/JsEditor.vue -->
<script lang="ts" setup>
/**
 * JS 代码编辑器(#13 规格):CodeMirror 6 + lang-javascript,仅语法高亮。
 * Feature 自带接线,不抽共享编辑器组件(规格:「等第三个编辑器 Feature 再下沉」)。
 * 主题/明暗/选区处理平移 shared/editor/CodeEditor 先例(CSS 版),此处为 JS 语法树。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { useEditorWrap } from '@/shared/editor/useEditorWrap';

const props = defineProps<{ modelValue: string; wrap?: boolean }>();
const globalWrap = useEditorWrap();
const effectiveWrap = computed(() => props.wrap ?? globalWrap.wrap.value);
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const container = ref<HTMLDivElement>();
let view: EditorView | undefined;
let themeObserver: MutationObserver | undefined;

// 主题:全走 semantic token,随 data-theme 联动(CodeEditor 同款注释见彼处)
const editorTheme = (dark: boolean) =>
  EditorView.theme(
    {
      '&': { backgroundColor: 'var(--lif3ng-background)', color: 'var(--lif3ng-foreground)' },
      '&.cm-focused': { outline: 'none' },
      '.cm-content': { caretColor: 'var(--lif3ng-primary)', fontFamily: 'var(--lif3ng-font-mono)' },
      '.cm-gutters': {
        backgroundColor: 'var(--lif3ng-muted)',
        color: 'var(--lif3ng-muted-foreground)',
        border: 'none',
      },
      '.cm-activeLine, .cm-activeLineGutter': {
        backgroundColor: 'color-mix(in srgb, var(--lif3ng-muted) 40%, transparent)',
      },
      '.cm-selectionBackground': {
        backgroundColor: 'color-mix(in srgb, var(--lif3ng-foreground) 18%, transparent) !important',
      },
      '&.cm-focused .cm-selectionBackground': {
        backgroundColor: 'color-mix(in srgb, var(--lif3ng-foreground) 28%, transparent) !important',
      },
    },
    { dark },
  );

// JS 语法高亮色板:两套明暗(CodeEditor 同构,色值按 JS 词法类微调)
const lightHighlight = HighlightStyle.define([
  { tag: t.comment, color: 'oklch(0.55 0 0)' },
  { tag: [t.keyword, t.moduleKeyword], color: 'oklch(0.5 0.18 300)' },
  { tag: [t.string, t.special(t.string)], color: 'oklch(0.5 0.15 150)' },
  { tag: [t.number, t.bool, t.null], color: 'oklch(0.55 0.15 45)' },
  { tag: [t.variableName, t.definition(t.variableName)], color: 'oklch(0.35 0.08 220)' },
  { tag: [t.function(t.variableName), t.definition(t.propertyName)], color: 'oklch(0.45 0.12 260)' },
  { tag: [t.operator, t.punctuation, t.bracket], color: 'oklch(0.4 0 0)' },
  { tag: [t.regexp, t.escape], color: 'oklch(0.55 0.2 25)' },
  { tag: t.invalid, color: 'oklch(0.55 0.2 25)' },
]);
const darkHighlight = HighlightStyle.define([
  { tag: t.comment, color: 'oklch(0.65 0 0)' },
  { tag: [t.keyword, t.moduleKeyword], color: 'oklch(0.78 0.14 300)' },
  { tag: [t.string, t.special(t.string)], color: 'oklch(0.78 0.12 150)' },
  { tag: [t.number, t.bool, t.null], color: 'oklch(0.8 0.12 45)' },
  { tag: [t.variableName, t.definition(t.variableName)], color: 'oklch(0.88 0.05 220)' },
  { tag: [t.function(t.variableName), t.definition(t.propertyName)], color: 'oklch(0.8 0.1 260)' },
  { tag: [t.operator, t.punctuation, t.bracket], color: 'oklch(0.75 0 0)' },
  { tag: [t.regexp, t.escape], color: 'oklch(0.7 0.18 25)' },
  { tag: t.invalid, color: 'oklch(0.7 0.18 25)' },
]);

function isDarkTheme(): boolean {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--lif3ng-background').trim();
  const m = /oklch\(\s*([\d.]+)(%?)/.exec(bg);
  if (!m) return false;
  const luminance = Number(m[1]) * (m[2] === '%' ? 0.01 : 1);
  return luminance < 0.5;
}

function buildExtensions() {
  return [
    basicSetup,
    syntaxHighlighting(isDarkTheme() ? darkHighlight : lightHighlight),
    javascript(),
    ...(effectiveWrap.value ? [EditorView.lineWrapping] : []),
    editorTheme(isDarkTheme()),
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
  themeObserver = new MutationObserver(() => rebuild());
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
});

function rebuild() {
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
}

watch(effectiveWrap, () => rebuild());

watch(
  () => props.modelValue,
  (v) => {
    if (view && v !== view.state.doc.toString()) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: v } });
    }
  },
);

onBeforeUnmount(() => {
  themeObserver?.disconnect();
  view?.destroy();
});
</script>

<template>
  <div
    ref="container"
    class="border-border overflow-hidden rounded-md border text-sm"
  />
</template>
