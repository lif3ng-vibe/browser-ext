<!-- src/shared/editor/CodeEditor.vue -->
<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { EditorView, basicSetup } from 'codemirror';
import { css } from '@codemirror/lang-css';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

const props = defineProps<{ modelValue: string; wrap?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const container = ref<HTMLDivElement>();
let view: EditorView | undefined;
let themeObserver: MutationObserver | undefined;

// 主题:全部走 semantic token,随 data-theme 联动
// 选区 = foreground 低透明叠加(亮暗自适应;primary 是前景性质的中性色,不可作高亮色源)
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
    backgroundColor: 'color-mix(in srgb, var(--lif3ng-foreground) 18%, transparent) !important',
  },
  '&.cm-focused .cm-selectionBackground': {
    backgroundColor: 'color-mix(in srgb, var(--lif3ng-foreground) 28%, transparent) !important',
  },
});

// 语法高亮:basicSetup 的 defaultHighlightStyle 是固定浅色板,暗色下不适配。
// 两套 HighlightStyle 按当前明暗二选一挂载(选择器特异性相同,只挂一份保证不叠)。
const lightHighlight = HighlightStyle.define([
  { tag: t.comment, color: 'oklch(0.55 0 0)' },
  { tag: [t.propertyName], color: 'oklch(0.45 0.12 260)' },
  { tag: [t.keyword, t.atom], color: 'oklch(0.5 0.18 300)' },
  { tag: [t.string, t.color], color: 'oklch(0.5 0.15 150)' },
  { tag: [t.number, t.unit], color: 'oklch(0.55 0.15 45)' },
  { tag: [t.variableName, t.attributeName], color: 'oklch(0.35 0.08 220)' },
  { tag: [t.operator, t.punctuation], color: 'oklch(0.4 0 0)' },
  { tag: t.invalid, color: 'oklch(0.55 0.2 25)' },
]);
const darkHighlight = HighlightStyle.define([
  { tag: t.comment, color: 'oklch(0.65 0 0)' },
  { tag: [t.propertyName], color: 'oklch(0.8 0.1 260)' },
  { tag: [t.keyword, t.atom], color: 'oklch(0.78 0.14 300)' },
  { tag: [t.string, t.color], color: 'oklch(0.78 0.12 150)' },
  { tag: [t.number, t.unit], color: 'oklch(0.8 0.12 45)' },
  { tag: [t.variableName, t.attributeName], color: 'oklch(0.88 0.05 220)' },
  { tag: [t.operator, t.punctuation], color: 'oklch(0.75 0 0)' },
  { tag: t.invalid, color: 'oklch(0.7 0.18 25)' },
]);

/**
 * 读当前生效主题的明暗(background 亮度),不依赖主题名单硬编码。
 * 注意:构建产物(lightningcss)会把 oklch 的亮度规范化为百分数(oklch(0.145…) → oklch(14.5%…)),
 * % 必须归一化回 0–1 再比较,否则一切非零亮度都会被误判成亮色。
 */
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
    // basicSetup 自带 defaultHighlightStyle;后挂的 syntaxHighlighting 覆盖前者(同 facet,后者优先)
    syntaxHighlighting(isDarkTheme() ? darkHighlight : lightHighlight),
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
  // 主题切换(明暗互换影响选区叠加与语法高亮色板)→ 重建视图换扩展
  themeObserver = new MutationObserver(() => rebuild());
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
});

// 重建视图:保留文档与光标(wrap 切换 / 主题切换共用)
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

// 折行开关:重建视图等效 reconfigure(@codemirror/state 非直接依赖,Compartment 不可 import)
watch(
  () => props.wrap,
  () => rebuild(),
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
