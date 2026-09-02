// src/shared/theme/applyToElement.ts
import { themeItems } from './useTheme';
import { DEFAULT_PREFERENCE, resolveTheme } from './resolve';
import { getTheme, type ThemeId } from './registry';

/**
 * 主题应用的元素侧实现(useTheme 的 DOM 应用与 content UI 的 shadow 容器应用共用):
 * 解析值(data-theme + .dark 类)落到目标元素。content UI 侧主题实时跟随的
 * storage watch 与系统明暗监听也内建在此,feature 代码不经手 lif3ng/* 键(docs/ui.md §2)。
 */

function apply(el: HTMLElement, resolved: ThemeId): void {
  el.dataset.theme = resolved;
  el.classList.toggle('dark', getTheme(resolved)?.appearance === 'dark');
}

async function resolveFromStorage(): Promise<ThemeId> {
  const choice = await themeItems.theme.getValue();
  const followSystem = await themeItems.followSystem.getValue();
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return resolveTheme(
    { choice: choice ?? DEFAULT_PREFERENCE.choice, followSystem: followSystem ?? DEFAULT_PREFERENCE.followSystem },
    systemDark,
  );
}

/**
 * 把解析主题应用到元素并保持跟随(storage 变化与系统明暗变化都重应用)。
 * 返回停止跟随的函数。
 */
export function applyThemeToElementTracked(el: HTMLElement): () => void {
  void resolveFromStorage().then((resolved) => apply(el, resolved));

  const reapply = () => void resolveFromStorage().then((resolved) => apply(el, resolved));
  const unwatchTheme = themeItems.theme.watch(reapply);
  const unwatchFollow = themeItems.followSystem.watch(reapply);
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', reapply);

  return () => {
    unwatchTheme();
    unwatchFollow();
    media.removeEventListener('change', reapply);
  };
}