/**
 * 主题注册表:id 必须与 tokens.css 里的 [data-theme="<id>"] 一一对应
 * (一致性由 theme-registry.test.ts 锁死)。加主题三步曲:
 *   1. tokens.css 贴一个 [data-theme] 块  2. 这里加一行  3. 测试自动守护
 */
export type ThemeId = 'light' | 'dark' | 'vercel-light' | 'vercel-dark';
export type ThemeAppearance = 'light' | 'dark';

export interface ThemeMeta {
  id: ThemeId;
  /** 设置 UI 展示文案(中文) */
  label: string;
  appearance: ThemeAppearance;
  /** 平铺模型下的主题对:同风格另一明暗侧 */
  pair: ThemeId;
}

export const THEMES: readonly ThemeMeta[] = [
  { id: 'light', label: '亮色', appearance: 'light', pair: 'dark' },
  { id: 'dark', label: '暗色', appearance: 'dark', pair: 'light' },
  { id: 'vercel-light', label: 'Vercel 亮色', appearance: 'light', pair: 'vercel-dark' },
  { id: 'vercel-dark', label: 'Vercel 暗色', appearance: 'dark', pair: 'vercel-light' },
] as const;

export const DEFAULT_THEME: ThemeId = 'light';

export function getTheme(id: string): ThemeMeta | undefined {
  return THEMES.find((t) => t.id === id);
}

export function isThemeId(value: unknown): value is ThemeId {
  return THEMES.some((t) => t.id === value);
}