import { getTheme, isThemeId, DEFAULT_THEME, type ThemeId } from './registry';

/** 主题设置(用户所存的选择)。跟随系统是独立的布尔,不进这里。 */
export type ThemeChoice = ThemeId;

export interface ThemePreference {
  choice: ThemeId;
  followSystem: boolean;
}

export const DEFAULT_PREFERENCE: ThemePreference = {
  choice: 'light',
  followSystem: true,
};

/**
 * 解析规则(ADR-0004):
 * - 跟随系统关 → 解析值 = 所选主题
 * - 跟随系统开 → 所选主题所在主题对中,与系统明暗一致的那个
 *   (pair 永远与所选主题异侧,由 registry 一致性单测锁死)
 */
export function resolveTheme(
  pref: Pick<ThemePreference, 'choice' | 'followSystem'>,
  systemDark: boolean,
): ThemeId {
  if (!pref.followSystem) return pref.choice;
  const theme = getTheme(pref.choice);
  if (!theme) return systemDark ? 'dark' : 'light';
  // 所选主题亮侧 + 系统暗(或反之)→ 取 pair;同侧(防御,正常不可达)→ 原主题
  return (systemDark ? 'dark' : 'light') === theme.appearance ? theme.id : theme.pair;
}

/**
 * FOUC 阻塞脚本用:从 localStorage 镜像还原解析值。无效/缺失返回 null。
 * (脚本本体是独立无依赖文件 fouc.ts;此处仅供单测同步校验同一套 id 清单)
 */
export function readResolvedFromLocalStorage(): ThemeId | null {
  try {
    const raw = localStorage.getItem('lif3ng:resolvedTheme');
    return isThemeId(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** FOUC 阻塞脚本用:localStorage 镜像缺失时,跟随系统 + 默认主题的最好猜测。 */
export function guessResolvedTheme(): ThemeId {
  let systemDark = false;
  try {
    systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    /* 非浏览器环境按 light */
  }
  return resolveTheme({ choice: DEFAULT_THEME, followSystem: true }, systemDark);
}