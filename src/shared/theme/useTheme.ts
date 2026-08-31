import { onMounted, ref, type Ref } from 'vue';
import { storage } from 'wxt/utils/storage';
import { DEFAULT_THEME, getTheme, THEMES, type ThemeId } from './registry';
import { DEFAULT_PREFERENCE, resolveTheme, type ThemePreference } from './resolve';

const THEME_KEY = 'local:lif3ng/theme' as const;
const FOLLOW_KEY = 'local:lif3ng/followSystem' as const;
const RESOLVED_KEY = 'local:lif3ng/resolvedTheme' as const;
const LS_MIRROR_KEY = 'lif3ng:resolvedTheme';

export const themeItems = {
  theme: storage.defineItem<ThemeId>(THEME_KEY, { fallback: DEFAULT_THEME }),
  followSystem: storage.defineItem<boolean>(FOLLOW_KEY, { fallback: DEFAULT_PREFERENCE.followSystem }),
  resolved: storage.defineItem<ThemeId>(RESOLVED_KEY, { fallback: DEFAULT_THEME }),
};

/** 页面要消费的:选择 + 跟随系统 + 解析值(暗系时 useTheme 另挂 .dark) */
export interface UseTheme {
  /** 主题选择(所存的,非解析值) */
  choice: Ref<ThemeId>;
  /** 跟随系统复选框状态 */
  followSystem: Ref<boolean>;
  /** 实际生效的解析值 */
  resolved: Ref<ThemeId>;
  setChoice(id: ThemeId): Promise<void>;
  setFollowSystem(on: boolean): Promise<void>;
}

function systemDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyToDom(resolved: ThemeId): void {
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.classList.toggle('dark', getTheme(resolved)?.appearance === 'dark');
}

async function persistResolved(preference: ThemePreference): Promise<ThemeId> {
  const resolved = resolveTheme(preference, systemDark());
  applyToDom(resolved);
  // 双写:storage 跨上下文同步;localStorage 镜像供 FOUC 阻塞脚本同步读(CSP 实测:内联被拦)
  await themeItems.resolved.setValue(resolved);
  try {
    localStorage.setItem(LS_MIRROR_KEY, resolved);
  } catch {
    /* 镜像写失败不影响主流程 */
  }
  return resolved;
}

/**
 * 主题系统的唯一入口。每个扩展页面(popup/options/未来的 devtools)
 * setup 一次;content UI 由 shadow host 侧另行应用(见 docs/ui.md)。
 */
export function useTheme(): UseTheme {
  const choice = ref<ThemeId>(DEFAULT_THEME);
  const followSystem = ref(DEFAULT_PREFERENCE.followSystem);
  const resolved = ref<ThemeId>(DEFAULT_THEME);

  async function recompute(choiceId: ThemeId, follow: boolean): Promise<void> {
    resolved.value = await persistResolved({ choice: choiceId, followSystem: follow });
  }

  onMounted(async () => {
    let storedChoice = DEFAULT_PREFERENCE.choice;
    let storedFollow = DEFAULT_PREFERENCE.followSystem;
    try {
      const c = await themeItems.theme.getValue();
      if (c && getTheme(c)) storedChoice = c;
      const f = await themeItems.followSystem.getValue();
      if (f != null) storedFollow = f;
    } catch {
      /* storage 不可用时用默认值 */
    }
    choice.value = storedChoice;
    followSystem.value = storedFollow;
    await recompute(storedChoice, storedFollow);
  });

  // 跟随系统模式:系统明暗变化即时重解析
  const onSystemChange = () => {
    if (followSystem.value) void recompute(choice.value, true);
  };
  onMounted(() => {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', onSystemChange);
  });

  async function setChoice(id: ThemeId): Promise<void> {
    if (!getTheme(id)) return;
    choice.value = id;
    await themeItems.theme.setValue(id);
    await recompute(id, followSystem.value);
  }

  async function setFollowSystem(on: boolean): Promise<void> {
    followSystem.value = on;
    await themeItems.followSystem.setValue(on);
    await recompute(choice.value, on);
  }

  // 跨 context 同步:任一页面(popup/options)改动,本页面跟随
  void themeItems.theme.watch((v) => {
    if (v && getTheme(v) && v !== choice.value) {
      choice.value = v;
      void recompute(v, followSystem.value);
    }
  });
  void themeItems.followSystem.watch((v) => {
    if (v != null && v !== followSystem.value) {
      followSystem.value = v;
      void recompute(choice.value, v);
    }
  });

  return { choice, followSystem, resolved, setChoice, setFollowSystem };
}

export { THEMES };