import { describe, it, expect } from 'vitest';
import { resolveTheme, DEFAULT_PREFERENCE } from '../resolve';

describe('resolveTheme(解析规则全分支)', () => {
  it('跟随系统关 → 解析值 = 所选主题(任意主题,无视系统明暗)', () => {
    expect(resolveTheme({ choice: 'light', followSystem: false }, true)).toBe('light');
    expect(resolveTheme({ choice: 'light', followSystem: false }, false)).toBe('light');
    expect(resolveTheme({ choice: 'vercel-dark', followSystem: false }, true)).toBe('vercel-dark');
    expect(resolveTheme({ choice: 'vercel-dark', followSystem: false }, false)).toBe('vercel-dark');
  });

  it('跟随系统开 → 所选主题对中与系统明暗一致的那个', () => {
    // 选亮侧,系统亮 → 原主题;系统暗 → pair
    expect(resolveTheme({ choice: 'light', followSystem: true }, false)).toBe('light');
    expect(resolveTheme({ choice: 'light', followSystem: true }, true)).toBe('dark');
    expect(resolveTheme({ choice: 'vercel-light', followSystem: true }, false)).toBe('vercel-light');
    expect(resolveTheme({ choice: 'vercel-light', followSystem: true }, true)).toBe('vercel-dark');
    // 选暗侧
    expect(resolveTheme({ choice: 'dark', followSystem: true }, true)).toBe('dark');
    expect(resolveTheme({ choice: 'dark', followSystem: true }, false)).toBe('light');
    expect(resolveTheme({ choice: 'vercel-dark', followSystem: true }, true)).toBe('vercel-dark');
    expect(resolveTheme({ choice: 'vercel-dark', followSystem: true }, false)).toBe('vercel-light');
  });

  it('跟随系统开 + 无效选择 → 回落默认主题对的对应侧', () => {
    expect(resolveTheme({ choice: 'nord' as never, followSystem: true }, false)).toBe('light');
    expect(resolveTheme({ choice: 'nord' as never, followSystem: true }, true)).toBe('dark');
  });

  it('默认偏好 = light + 跟随系统开', () => {
    expect(DEFAULT_PREFERENCE).toEqual({ choice: 'light', followSystem: true });
  });
});