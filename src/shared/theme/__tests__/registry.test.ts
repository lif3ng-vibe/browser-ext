import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { THEMES, getTheme, isThemeId, DEFAULT_THEME, type ThemeId } from '../registry';

const TOKENS_CSS = readFileSync(resolve(__dirname, '../tokens.css'), 'utf-8');

describe('主题注册表一致性(CSS 真源 ↔ TS 元数据)', () => {
  it('每个注册主题都有对应的 [data-theme] 块(light 允许由 :root 承担)', () => {
    for (const theme of THEMES) {
      const selector = theme.id === 'light' ? ':root' : `[data-theme='${theme.id}']`;
      expect(TOKENS_CSS, `tokens.css 缺 ${theme.id} 的块(${selector})`).toContain(selector);
    }
  });

  it('CSS 里的每个 [data-theme] 块都注册过(防漂移:只加 CSS 忘注册)', () => {
    const idsInCss = [...TOKENS_CSS.matchAll(/\[data-theme='([^']+)'\]/g)].map((m) => m[1]);
    const registered = new Set(THEMES.map((t) => t.id));
    for (const id of idsInCss) {
      expect(registered.has(id as ThemeId), `tokens.css 有 [data-theme='${id}'] 但注册表没有`).toBe(true);
    }
  });

  it('每个主题块都覆盖全部语义 token(整组换值,不允许半套)', () => {
    const requiredVars = [
      'background',
      'foreground',
      'card',
      'card-foreground',
      'popover',
      'popover-foreground',
      'primary',
      'primary-foreground',
      'secondary',
      'secondary-foreground',
      'muted',
      'muted-foreground',
      'accent',
      'accent-foreground',
      'destructive',
      'destructive-foreground',
      'border',
      'input',
      'ring',
      'chart-1',
      'chart-2',
      'chart-3',
      'chart-4',
      'chart-5',
    ];
    for (const theme of THEMES) {
      // light 由 :root 兜底;其余块独立截取
      const chunk =
        theme.id === 'light'
          ? TOKENS_CSS
          : TOKENS_CSS.slice(TOKENS_CSS.indexOf(`[data-theme='${theme.id}']`));
      for (const v of requiredVars) {
        expect(chunk, `${theme.id} 缺 --lif3ng-${v}`).toContain(`--lif3ng-${v}`);
      }
    }
  });

  it('主题对恒为异侧 appearance(pair 语义的硬不变量)', () => {
    for (const theme of THEMES) {
      const pair = getTheme(theme.pair);
      expect(pair, `${theme.id} 的 pair ${theme.pair} 不存在`).toBeDefined();
      expect(pair!.appearance, `${theme.id} 与其 pair 同侧,违反主题对语义`).not.toBe(theme.appearance);
      expect(getTheme(theme.pair)!.pair, '配对必须对称').toBe(theme.id);
    }
  });

  it('默认主题存在且是 light 侧', () => {
    expect(getTheme(DEFAULT_THEME)?.appearance).toBe('light');
  });

  it('isThemeId 只认注册过的 id', () => {
    expect(isThemeId('light')).toBe(true);
    expect(isThemeId('vercel-dark')).toBe(true);
    expect(isThemeId('nord')).toBe(false);
    expect(isThemeId(undefined)).toBe(false);
  });
});