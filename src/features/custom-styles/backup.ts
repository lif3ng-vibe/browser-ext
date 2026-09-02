// src/features/custom-styles/backup.ts
import type { CustomStyle } from './types';
import { matchPatternToRegExp } from './matcher';

/**
 * 样式备份(issue #14;CONTEXT.md「样式备份文件」):
 * 导出即备份,手动触发;导入按 id 合并,严格校验全有或全无。
 * 不做 Stylus 互通、storage.sync 同步、自动备份。
 */

export const BACKUP_FORMAT = 'browser-ext/custom-styles';
export const BACKUP_VERSION = 1;

/** 导出:全量样式 → 备份 JSON 文本(pretty print,indent 2);字段全保真 */
export function exportStyles(styles: CustomStyle[], exportedAt: string): string {
  const envelope = { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt, styles };
  return JSON.stringify(envelope, null, 2);
}

/** 导出文件名:custom-styles-YYYY-MM-DD.json(本地日期) */
export function backupFileName(at: Date): string {
  const y = at.getFullYear();
  const m = String(at.getMonth() + 1).padStart(2, '0');
  const d = String(at.getDate()).padStart(2, '0');
  return `custom-styles-${y}-${m}-${d}.json`;
}

/** 触发浏览器下载:blob URL + <a download>(不加 downloads 权限) */
export function downloadStylesFile(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a); // Firefox 需在文档内才可靠触发
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export type ParseResult =
  | { ok: true; styles: CustomStyle[] }
  | { ok: false; error: string };

/**
 * 严格解析备份文本:全有或全无,报第一条错(按文件顺序)。
 * - 信封:format 精确匹配;version 为整数且 1 ≤ v ≤ BACKUP_VERSION;exportedAt 字符串;styles 数组
 * - 单条:六字段逐项类型校验,pattern 非法以 matchPatternToRegExp 判
 * - 文件内重复 id 拒绝;空 styles 合法;未知多余字段容忍(向前兼容)
 */
export function parseBackup(raw: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: '不是有效的 JSON 文本' };
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { ok: false, error: '备份文件结构不符:顶层应为对象' };
  }
  const env = data as Record<string, unknown>;
  if (env.format !== BACKUP_FORMAT) {
    return { ok: false, error: '不是本插件的样式备份文件(format 不符)' };
  }
  if (typeof env.version !== 'number' || !Number.isInteger(env.version) || env.version < 1) {
    return { ok: false, error: '备份文件版本号缺失或非法' };
  }
  if (env.version > BACKUP_VERSION) {
    return { ok: false, error: `备份文件版本过新(v${env.version} > v${BACKUP_VERSION}),请先更新插件` };
  }
  if (typeof env.exportedAt !== 'string') {
    return { ok: false, error: '备份文件缺少 exportedAt(应为字符串)' };
  }
  if (!Array.isArray(env.styles)) {
    return { ok: false, error: '备份文件 styles 应为数组' };
  }

  const styles: CustomStyle[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < env.styles.length; i++) {
    const entry: unknown = env.styles[i];
    const at = `第 ${i + 1} 条样式`;
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      return { ok: false, error: `${at}:应为对象` };
    }
    const s = entry as Record<string, unknown>;
    if (typeof s.id !== 'string' || s.id === '') return { ok: false, error: `${at}:id 缺失或非法` };
    if (seen.has(s.id)) return { ok: false, error: `${at}:id 重复(「${s.id}」在文件中出现多次)` };
    seen.add(s.id);
    const named = `${at}「${s.id}」`;
    if (typeof s.name !== 'string') return { ok: false, error: `${named}:name 应为字符串` };
    if (typeof s.enabled !== 'boolean') return { ok: false, error: `${named}:enabled 应为布尔值` };
    if (!Array.isArray(s.patterns)) return { ok: false, error: `${named}:patterns 应为数组` };
    for (const p of s.patterns) {
      if (typeof p !== 'string' || matchPatternToRegExp(p) === null) {
        return { ok: false, error: `${named}:含非法作用域 pattern(${String(p)})` };
      }
    }
    if (typeof s.code !== 'string') return { ok: false, error: `${named}:code 应为字符串` };
    if (typeof s.createdAt !== 'number' || !Number.isFinite(s.createdAt)) return { ok: false, error: `${named}:createdAt 应为有限数字` };
    if (typeof s.updatedAt !== 'number' || !Number.isFinite(s.updatedAt)) return { ok: false, error: `${named}:updatedAt 应为有限数字` };
    styles.push({
      id: s.id,
      name: s.name,
      enabled: s.enabled,
      patterns: [...s.patterns],
      code: s.code,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    });
  }
  return { ok: true, styles };
}
