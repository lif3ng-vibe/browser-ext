// src/features/custom-styles/matcher.ts
import type { CustomStyle } from './types';

const PATTERN_RE = /^(\*|http|https|file|ftp):\/\/([^/]*)(\/.*)$/;

/**
 * 标准 match pattern → RegExp(Chrome 官方算法改写);非法 pattern 返回 null。
 * host 大小写不敏感;'*.host' 兼容裸域;路径 '*' = 任意。
 * 参考:https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns
 */
export function matchPatternToRegExp(pattern: string): RegExp | null {
  if (pattern === '<all_urls>') return /^(?:https?|file|ftp):\/\//;
  const m = PATTERN_RE.exec(pattern);
  if (!m) return null;
  const [, scheme, host = '', rawPath = '/'] = m;
  if (host === '' && scheme !== 'file') return null;
  let regex = '^';
  regex += scheme === '*' ? 'https?' : scheme;
  regex += '://';
  if (host === '*') {
    regex += '[^/]+';
  } else if (host.startsWith('*.')) {
    regex += `(?:[^/]+\\.)?${escapeRegExp(host.slice(2))}`;
  } else {
    regex += escapeRegExp(host);
  }
  const path = rawPath || '/';
  // 路径大小写敏感
  regex += path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${regex}$`, 'i');
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 裸域名展开为「精确 + 子domain」两条 pattern;不是域名就原样保留(当完整 pattern 用) */
export function expandDomain(domain: string): string[] {
  const host = domain.trim().replace(/^\.+|\.+$/g, '').toLowerCase();
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) return [domain.trim()];
  return [`*://${host}/*`, `*://*.${host}/*`];
}

/** 命中 url 的全部样式(不论 enabled),顺序 = 入参列表顺序 */
export function matchingStyles(styles: CustomStyle[], url: string): CustomStyle[] {
  return styles.filter((s) => matchesAny(s.patterns, url));
}

/** 命中 url 且已启用的样式,顺序 = 入参列表顺序(即注入级联顺序) */
export function collectStylesFor(styles: CustomStyle[], url: string): CustomStyle[] {
  return styles.filter((s) => s.enabled && matchesAny(s.patterns, url));
}

function matchesAny(patterns: string[], url: string): boolean {
  return patterns.some((p) => {
    const re = matchPatternToRegExp(p);
    return re !== null && re.test(url);
  });
}

/** 按列表顺序拼最终 CSS */
export function buildCss(styles: CustomStyle[]): string {
  return styles.map((s) => s.code).join('\n');
}