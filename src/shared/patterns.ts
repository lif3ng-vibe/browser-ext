// src/shared/patterns.ts
import { MatchPattern } from 'wxt/utils/match-patterns';

/**
 * 作用域 patterns 的域名展开(词汇表「作用域」):UI 只收裸域名或完整 pattern,
 * 裸域名自动展开成「精确 + 子域」两条标准 match pattern。
 * 从 custom-styles/matcher 下沉(#13 user-scripts 复用,ADR-0002:共享走 shared)。
 */

/** 裸域名展开为「精确 + 子domain」两条 pattern;不是域名就原样保留(当完整 pattern 用) */
export function expandDomain(domain: string): string[] {
  const host = domain.trim().replace(/^\.+|\.+$/g, '').toLowerCase();
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) return [domain.trim()];
  return [`*://${host}/*`, `*://*.${host}/*`];
}

/** 多行文本 → 展开去重后的 pattern 列表(编辑器表单共用) */
export function parsePatternsText(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split('\n').map((l) => l.trim()).filter(Boolean)) {
    out.push(...expandDomain(line));
  }
  return [...new Set(out)];
}

/**
 * pattern 合法性校验(WXT MatchPattern 解析器):逐条验,返回首条非法原文。
 * userScripts.register 是全有或全无,一条坏 pattern 会废掉整批注册 ——
 * 编辑器保存前用此函数拦下(user-scripts #13);custom-styles 无此脆性(v1 自己 regex)。
 */
export function firstInvalidPattern(patterns: string[]): string | null {
  for (const p of patterns) {
    if (p === '<all_urls>') continue;
    try {
      new MatchPattern(p);
    } catch {
      return p;
    }
  }
  return null;
}
