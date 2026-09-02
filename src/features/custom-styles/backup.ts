// src/features/custom-styles/backup.ts
import type { CustomStyle } from './types';

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
