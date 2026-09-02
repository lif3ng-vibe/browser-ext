// src/features/custom-styles/__tests__/backup.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { backupFileName, downloadStylesFile, exportStyles } from '../backup';
import type { CustomStyle } from '../types';

function style(over: Partial<CustomStyle>): CustomStyle {
  return { id: 'x', name: 'n', enabled: true, patterns: ['<all_urls>'], code: '', createdAt: 0, updatedAt: 0, ...over };
}

describe('exportStyles(信封构建)', () => {
  it('信封四字段齐全,字段全保真,顺序保持', () => {
    const a = style({ id: 'a' });
    const b = style({ id: 'b', name: '红字', code: 'body{color:red}', enabled: false, patterns: ['*://github.com/*'], createdAt: 11, updatedAt: 22 });
    const env = JSON.parse(exportStyles([a, b], '2026-09-02T00:00:00.000Z'));
    expect(env.format).toBe('browser-ext/custom-styles');
    expect(env.version).toBe(1);
    expect(env.exportedAt).toBe('2026-09-02T00:00:00.000Z');
    expect(env.styles).toEqual([a, b]);
  });

  it('空列表合法:styles 为空数组', () => {
    const env = JSON.parse(exportStyles([], '2026-09-02T00:00:00.000Z'));
    expect(env.styles).toEqual([]);
  });

  it('pretty print:indent 2', () => {
    const text = exportStyles([style({})], '2026-09-02T00:00:00.000Z');
    expect(text).toContain('\n  "format"');
    expect(text).toContain('\n      "id"'); // styles 数组内字段缩进 6 空格
  });
});

describe('backupFileName(本地日期)', () => {
  it('custom-styles-YYYY-MM-DD.json,按本地时区取日期', () => {
    // 无时区后缀 → 按本地时间解析,任何时区下都是同一天
    expect(backupFileName(new Date('2026-09-02T15:04:05'))).toBe('custom-styles-2026-09-02.json');
    expect(backupFileName(new Date('2026-01-05T01:02:03'))).toBe('custom-styles-2026-01-05.json');
  });
});

describe('downloadStylesFile(blob + <a download>)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete (URL as unknown as Record<string, unknown>).createObjectURL;
    delete (URL as unknown as Record<string, unknown>).revokeObjectURL;
  });

  it('blob URL 挂到 a[download],内容为原文,用后 revoke', async () => {
    const created = vi.fn<(blob: Blob) => string>(() => 'blob:mock-url');
    const revoked = vi.fn();
    Object.assign(URL, { createObjectURL: created, revokeObjectURL: revoked });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadStylesFile('custom-styles-2026-09-02.json', '{"k":1}');

    expect(created).toHaveBeenCalledTimes(1);
    const blob = created.mock.calls[0]![0] as Blob;
    expect(blob.type).toBe('application/json');
    await expect(blob.text()).resolves.toBe('{"k":1}');

    expect(clickSpy).toHaveBeenCalledTimes(1);
    const a = clickSpy.mock.instances[0] as unknown as HTMLAnchorElement;
    expect(a.download).toBe('custom-styles-2026-09-02.json');
    expect(a.href).toContain('blob:mock-url');
    expect(revoked).toHaveBeenCalledWith('blob:mock-url');
  });
});
