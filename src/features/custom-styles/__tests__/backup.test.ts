// src/features/custom-styles/__tests__/backup.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BACKUP_FORMAT, backupFileName, downloadStylesFile, exportStyles, mergeById, parseBackup } from '../backup';
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

describe('parseBackup(严格校验,全有或全无)', () => {
  const good = style({ id: 'a', name: '红字', patterns: ['*://github.com/*'], code: 'body{}', createdAt: 1, updatedAt: 2 });
  const wrap = (env: unknown): string => JSON.stringify(env);

  it('合法文件:导出→解析 round-trip 还原 styles', () => {
    const raw = exportStyles([good, style({ id: 'b' })], '2026-09-02T00:00:00.000Z');
    expect(parseBackup(raw)).toEqual({ ok: true, styles: [good, style({ id: 'b' })] });
  });

  it('空 styles 合法', () => {
    expect(parseBackup(wrap({ format: BACKUP_FORMAT, version: 1, exportedAt: '2026-09-02T00:00:00.000Z', styles: [] })))
      .toEqual({ ok: true, styles: [] });
  });

  it('非 JSON 文本拒收', () => {
    expect(parseBackup('not json')).toEqual({ ok: false, error: '不是有效的 JSON 文本' });
  });

  it('顶层非对象(数组/字符串/null)拒收', () => {
    const base = { version: 1, exportedAt: 'x', styles: [] };
    expect(parseBackup(wrap([base]))).toEqual({ ok: false, error: '备份文件结构不符:顶层应为对象' });
    expect(parseBackup('null')).toEqual({ ok: false, error: '备份文件结构不符:顶层应为对象' });
  });

  it('format 精确匹配:不符拒收', () => {
    expect(parseBackup(wrap({ format: 'stylus/v1', version: 1, exportedAt: 'x', styles: [] })))
      .toEqual({ ok: false, error: '不是本插件的样式备份文件(format 不符)' });
    expect(parseBackup(wrap({ version: 1, exportedAt: 'x', styles: [] })))
      .toEqual({ ok: false, error: '不是本插件的样式备份文件(format 不符)' });
  });

  it('version 缺失/非整数/为 0/过新,均拒收', () => {
    const env = { format: BACKUP_FORMAT, exportedAt: 'x', styles: [] };
    expect(parseBackup(wrap(env))).toEqual({ ok: false, error: '备份文件版本号缺失或非法' });
    expect(parseBackup(wrap({ ...env, version: 1.5 }))).toEqual({ ok: false, error: '备份文件版本号缺失或非法' });
    expect(parseBackup(wrap({ ...env, version: 0 }))).toEqual({ ok: false, error: '备份文件版本号缺失或非法' });
    expect(parseBackup(wrap({ ...env, version: 2 }))).toEqual({ ok: false, error: '备份文件版本过新(v2 > v1),请先更新插件' });
  });

  it('exportedAt 缺失或非字符串拒收', () => {
    const env = { format: BACKUP_FORMAT, version: 1, styles: [] };
    expect(parseBackup(wrap(env))).toEqual({ ok: false, error: '备份文件缺少 exportedAt(应为字符串)' });
    expect(parseBackup(wrap({ ...env, exportedAt: 42 }))).toEqual({ ok: false, error: '备份文件缺少 exportedAt(应为字符串)' });
  });

  it('styles 非数组拒收', () => {
    expect(parseBackup(wrap({ format: BACKUP_FORMAT, version: 1, exportedAt: 'x', styles: {} })))
      .toEqual({ ok: false, error: '备份文件 styles 应为数组' });
  });

  it('单条字段逐项校验:缺失/类型不符均报「第 N 条」', () => {
    const env = (s: unknown) => ({ format: BACKUP_FORMAT, version: 1, exportedAt: 'x', styles: [s] });
    expect(parseBackup(wrap(env('str')))).toEqual({ ok: false, error: '第 1 条样式:应为对象' });
    expect(parseBackup(wrap(env({})))).toEqual({ ok: false, error: '第 1 条样式:id 缺失或非法' });
    expect(parseBackup(wrap(env({ id: '' })))).toEqual({ ok: false, error: '第 1 条样式:id 缺失或非法' });
    expect(parseBackup(wrap(env({ id: 'a' })))).toEqual({ ok: false, error: '第 1 条样式「a」:name 应为字符串' });
    expect(parseBackup(wrap(env({ id: 'a', name: 'n' })))).toEqual({ ok: false, error: '第 1 条样式「a」:enabled 应为布尔值' });
    expect(parseBackup(wrap(env({ id: 'a', name: 'n', enabled: true })))).toEqual({ ok: false, error: '第 1 条样式「a」:patterns 应为数组' });
    expect(parseBackup(wrap(env({ id: 'a', name: 'n', enabled: true, patterns: 'x' })))).toEqual({ ok: false, error: '第 1 条样式「a」:patterns 应为数组' });
    expect(parseBackup(wrap(env({ id: 'a', name: 'n', enabled: true, patterns: ['nonsense'] }))))
      .toEqual({ ok: false, error: '第 1 条样式「a」:含非法作用域 pattern(nonsense)' });
    expect(parseBackup(wrap(env({ id: 'a', name: 'n', enabled: true, patterns: [] })))).toEqual({ ok: false, error: '第 1 条样式「a」:code 应为字符串' });
    expect(parseBackup(wrap(env({ id: 'a', name: 'n', enabled: true, patterns: [], code: '' })))).toEqual({ ok: false, error: '第 1 条样式「a」:createdAt 应为有限数字' });
    expect(parseBackup(wrap(env({ id: 'a', name: 'n', enabled: true, patterns: [], code: '', createdAt: 1 })))).toEqual({ ok: false, error: '第 1 条样式「a」:updatedAt 应为有限数字' });
    expect(parseBackup(wrap(env({ id: 'a', name: 'n', enabled: true, patterns: [], code: '', createdAt: 1, updatedAt: Number.NaN })))).toEqual({ ok: false, error: '第 1 条样式「a」:updatedAt 应为有限数字' });
  });

  it('文件内重复 id 拒绝', () => {
    const raw = wrap({ format: BACKUP_FORMAT, version: 1, exportedAt: 'x', styles: [good, style({ id: 'a', name: '另一条' })] });
    expect(parseBackup(raw)).toEqual({ ok: false, error: '第 2 条样式:id 重复(「a」在文件中出现多次)' });
  });

  it('报第一条错:两条坏条目只报前面那条', () => {
    const raw = wrap({
      format: BACKUP_FORMAT, version: 1, exportedAt: 'x',
      styles: [{ id: 'a', name: 1, enabled: true, patterns: [], code: '', createdAt: 1, updatedAt: 1 }, 'bad'],
    });
    const r = parseBackup(raw);
    expect(r.ok).toBe(false);
    expect(r).toEqual({ ok: false, error: '第 1 条样式「a」:name 应为字符串' });
  });

  it('合法文件容忍信封/条目上的未知多余字段(向前兼容)', () => {
    const raw = wrap({
      format: BACKUP_FORMAT, version: 1, exportedAt: 'x', note: 'hello',
      styles: [{ ...good, extra: 1 }],
    });
    expect(parseBackup(raw)).toEqual({ ok: true, styles: [good] });
  });
});

describe('mergeById(按 id 合并)', () => {
  const a = style({ id: 'a' });
  const b = style({ id: 'b', name: '乙' });
  const c = style({ id: 'c', name: '丙' });

  it('同 id 以文件为准,本地位置不动', () => {
    const a2 = style({ id: 'a', name: '文件版', code: 'p{}' });
    const r = mergeById([a, b], [a2]);
    expect(r.merged).toEqual([a2, b]);
    expect(r.overridden).toBe(1);
    expect(r.added).toBe(0);
  });

  it('新增项按文件相对顺序追加尾部', () => {
    const r = mergeById([a], [c, b]);
    expect(r.merged.map((s) => s.id)).toEqual(['a', 'c', 'b']);
    expect(r.overridden).toBe(0);
    expect(r.added).toBe(2);
  });

  it('混合:覆盖 + 追加', () => {
    const b2 = style({ id: 'b', name: '文件乙' });
    const r = mergeById([a, b], [b2, c]);
    expect(r.merged.map((s) => s.id)).toEqual(['a', 'b', 'c']);
    expect(r.merged[1]!.name).toBe('文件乙');
    expect(r.overridden).toBe(1);
    expect(r.added).toBe(1);
  });

  it('幂等:同一文件导两次,第二次全为覆盖,清单不变', () => {
    const first = mergeById([a, b], [b, c]);
    const second = mergeById(first.merged, [b, c]);
    expect(second.merged).toEqual(first.merged);
    expect(second.overridden).toBe(2);
    expect(second.added).toBe(0);
  });

  it('空文件:不覆盖不新增', () => {
    const r = mergeById([a, b], []);
    expect(r).toEqual({ merged: [a, b], overridden: 0, added: 0 });
  });

  it('空本地:全部新增', () => {
    const r = mergeById([], [a, b]);
    expect(r).toEqual({ merged: [a, b], overridden: 0, added: 2 });
  });
});
