// src/features/custom-styles/__tests__/matcher.test.ts
import { describe, expect, it } from 'vitest';
import {
  buildCss,
  collectStylesFor,
  expandDomain,
  matchPatternToRegExp,
  matchingStyles,
} from '../matcher';
import type { CustomStyle } from '../types';

function style(over: Partial<CustomStyle>): CustomStyle {
  return { id: 'x', name: 'n', enabled: true, patterns: ['<all_urls>'], code: '', createdAt: 0, updatedAt: 0, ...over };
}

describe('matchPatternToRegExp', () => {
  it('<all_urls> 匹配 http/https/file/ftp,不匹配 chrome://', () => {
    const re = matchPatternToRegExp('<all_urls>');
    expect(re?.test('https://a.com/')).toBe(true);
    expect(re?.test('file:///tmp/x')).toBe(true);
    expect(re?.test('chrome://extensions/')).toBe(false);
  });

  it('域名 pattern 命中同域任意路径与任意方案', () => {
    const re = matchPatternToRegExp('*://github.com/*');
    expect(re?.test('https://github.com/foo')).toBe(true);
    expect(re?.test('http://github.com/')).toBe(true);
    expect(re?.test('https://api.github.com/foo')).toBe(false);
    expect(re?.test('https://evil-github.com/')).toBe(false);
  });

  it('*.host pattern 同时命中子域与裸域', () => {
    const re = matchPatternToRegExp('*://*.github.com/*');
    expect(re?.test('https://www.github.com/a')).toBe(true);
    expect(re?.test('https://github.com/a')).toBe(true);
    expect(re?.test('https://notgithub.com/')).toBe(false);
  });

  it('路径通配', () => {
    const re = matchPatternToRegExp('https://api.x.dev/v1/*');
    expect(re?.test('https://api.x.dev/v1/users')).toBe(true);
    expect(re?.test('https://api.x.dev/v2/users')).toBe(false);
  });

  it('host 大小写不敏感(scheme/host 折叠,不用 i 标志)', () => {
    expect(matchPatternToRegExp('*://github.com/*')?.test('https://GITHUB.com/a')).toBe(true);
    // 任意子域 + host 大小写混合(通配 host 形式同样折叠)
    expect(matchPatternToRegExp('*://*.github.com/*')?.test('https://API.GitHub.com/a')).toBe(true);
  });

  it('路径大小写敏感(即使 host 不敏感)', () => {
    expect(matchPatternToRegExp('https://api.x.dev/v1/*')?.test('https://api.x.dev/V1/users')).toBe(false);
  });

  it('非法 pattern 返回 null(不抛)', () => {
    expect(matchPatternToRegExp('nonsense')).toBeNull();
    expect(matchPatternToRegExp('https://')).toBeNull();
  });
});

describe('expandDomain', () => {
  it('裸域名展开为 精确 + 子域 两条 pattern', () => {
    expect(expandDomain('github.com')).toEqual(['*://github.com/*', '*://*.github.com/*']);
  });
  it('trim 输入', () => {
    expect(expandDomain(' example.com ')).toEqual(['*://example.com/*', '*://*.example.com/*']);
  });
  it('不像域名的输入原样保留(可能是完整 pattern)', () => {
    expect(expandDomain('https://a.com/x*')).toEqual(['https://a.com/x*']);
  });
});

describe('matchingStyles / collectStylesFor / buildCss', () => {
  it('matchingStyles 不筛 enabled,按入参顺序保留', () => {
    const list = [style({ id: 'a', enabled: false }), style({ id: 'b', patterns: ['*://a.com/*'] })];
    expect(matchingStyles(list, 'https://a.com/').map((s) => s.id)).toEqual(['a', 'b']);
    expect(matchingStyles(list, 'https://b.com/').map((s) => s.id)).toEqual(['a']);
  });

  it('collectStylesFor 只要 enabled 且匹配', () => {
    const list = [
      style({ id: 'a', enabled: false }),
      style({ id: 'b', patterns: ['*://a.com/*'] }),
      style({ id: 'c', enabled: false, patterns: ['*://a.com/*'] }),
      style({ id: 'd', enabled: true, patterns: [] }),
    ];
    expect(collectStylesFor(list, 'https://a.com/').map((s) => s.id)).toEqual(['b']);
  });

  it('buildCss 按顺序拼接', () => {
    expect(buildCss([style({ id: '1', code: 'a{}' }), style({ id: '2', code: 'b{}' })])).toBe('a{}\nb{}');
  });
});