<script lang="ts" setup>
import { useTheme } from '@/shared/theme/useTheme';
import { THEMES } from '@/shared/theme/registry';
import { Checkbox } from '@/shared/ui/checkbox';
import { Label } from '@/shared/ui/label';

/**
 * 主题快切(唯一主题选择 UI):色块组 + 跟随系统一行。
 * options 页与 popup 共用;状态全走 shared/theme 的 useTheme,无本地存储逻辑。
 */
const { choice, resolved, followSystem, setChoice, setFollowSystem } = useTheme();

// 色卡预览需要"未激活主题"的真实色值,但 token 变量只在挂了对应 data-theme 时生效。
// 约定:tokens.css 的主题块选择器同时匹配预览作用域,这里用静态 hex 近似预览
// (仅设置 UI 内部呈现,不违反"组件不写死功能色"规则 —— 见 docs/ui.md 豁免协议)。
/* tokens-ignore: 色卡预览需要在未激活主题上采样色值,CSS 变量无法跨主题块取值;理由:预览唯一性 */
const PREVIEW_COLORS: Record<string, { bg: string; fg: string }> = {
  light: { bg: '#ffffff', fg: '#0a0a0a' },
  dark: { bg: '#0a0a0a', fg: '#fafafa' },
  'vercel-light': { bg: '#fcfcfc', fg: '#000000' },
  'vercel-dark': { bg: '#000000', fg: '#ffffff' },
};

function pick(id: string) {
  void setChoice(id as never);
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="grid grid-cols-2 gap-2">
      <button
        v-for="t in THEMES"
        :key="t.id"
        type="button"
        class="ring-offset-background focus-visible:ring-ring flex items-center gap-2 rounded-md border p-2 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
        :class="choice === t.id ? 'border-primary ring-primary border-2' : ''"
        :aria-pressed="choice === t.id"
        @click="pick(t.id)"
      >
        <span
          class="border-border size-6 shrink-0 rounded-full border"
          :style="{ backgroundColor: PREVIEW_COLORS[t.id]!.bg, borderColor: PREVIEW_COLORS[t.id]!.fg }"
        />
        <span class="text-sm">{{ t.label }}</span>
        <span
          v-if="resolved === t.id"
          class="text-muted-foreground ms-auto text-xs"
        >生效中</span>
      </button>
    </div>

    <div class="flex items-center gap-2">
      <Checkbox
        id="follow-system"
        :model-value="followSystem"
        @update:model-value="(v) => setFollowSystem(v === true)"
      />
      <Label
        for="follow-system"
        class="text-sm"
      >跟随系统(按系统明暗自动切换同风格主题)</Label>
    </div>
  </div>
</template>