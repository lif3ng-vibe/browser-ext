# 自定义样式导入导出/备份(issue #14)实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** custom-styles 全量样式的 JSON 导出(备份文件下载)与导入(按 id 合并),入口在 options 管理块底部。

**Architecture:** 新增 `src/features/custom-styles/backup.ts` 承载全部纯逻辑(信封构建、严格解析、按 id 合并、下载触发);`store.ts` 加 `importStyles` 写路径(队列串行,推广 remove 的「编辑对象被换→清 editing」不变式);`ManageStylesBlock.vue` 底部加「导出 / 导入」按钮做接线(解析→摘要 confirm→导入)。纯逻辑与写路径与 UI 三层各自可测。

**Tech Stack:** WXT 0.21 + Vue 3 + TS + vitest(WxtVitest + fakeBrowser + jsdom)。

## Global Constraints

- 规格权威 = GitHub issue #14(2026-09-01 拷问会定案),词条见 CONTEXT.md「样式备份文件」。
- 信封:`{ format: "browser-ext/custom-styles", version: 1, exportedAt, styles: [...] }`,pretty print(indent 2);`editing` 会话状态不入文件。
- 字段全保真:`CustomStyle` 全字段(id/name/enabled/patterns/code/createdAt/updatedAt)。
- 导出只做全量,无勾选;交付用 `<a download>` + blob URL,**不加 downloads 权限**;文件名 `custom-styles-YYYY-MM-DD.json`(本地日期)。
- 导入冲突:**按 id 合并**——同 id 以文件为准覆盖(本地顺序保留、位置不动),文件新增项按文件相对顺序追加尾部;幂等。
- 校验:**严格全有或全无**——信封 format 精确匹配、version 为整数且 ≤ 1;单条字段逐项校验(pattern 非法用 `matchPatternToRegExp(p) === null` 判);文件内重复 id 拒绝;空 styles 合法;**报第一条错**。
- 确认:先摘要后 `window.confirm`(覆盖 N 条/新增 M 条;若含编辑中样式,提示导入后编辑会话结束)。
- 导入替换了正在编辑的样式 → 清 editing 回清单(推广 `remove` 的既定不变式)。
- UI 入口只在 options 的 `ManageStylesBlock` 底部;侧边栏不放。
- 浏览器矩阵:Chrome / Firefox / Edge 三端均须可用。
- 文档语言:commit message / issue 正文用中文,保留 conventional 前缀;代码、标识符英文。
- commit message **禁止**任何 `Co-Authored-By:` 尾注。
- UI 只消费 semantic token 类,禁止原子色硬编码(eslint `lif3ng/atomic-class` 会拦)。
- 不新增任何 manifest 权限(`storage` + `host_permissions: <all_urls>` 已够)。
- 每任务结束跑 `pnpm compile && pnpm test && pnpm lint` 全绿再提交;包管理器 pnpm,不动全局。

---

### Task 1: backup.ts 导出侧——信封构建、文件名、下载触发

**Files:**
- Create: `src/features/custom-styles/backup.ts`
- Test: `src/features/custom-styles/__tests__/backup.test.ts`

**Interfaces:**
- Consumes: `CustomStyle`(types.ts);`matchPatternToRegExp`(matcher.ts,本任务未用,Task 2 用)
- Produces: `BACKUP_FORMAT = 'browser-ext/custom-styles'`(常量);`BACKUP_VERSION = 1`(常量);`exportStyles(styles: CustomStyle[], exportedAt: string): string`(返回 pretty JSON 文本);`backupFileName(at: Date): string`(本地日期 `custom-styles-YYYY-MM-DD.json`);`downloadStylesFile(filename: string, text: string): void`(blob URL + `<a download>`)

- [ ] **Step 1: 写失败测试**

```ts
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
    const created = vi.fn(() => 'blob:mock-url');
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/features/custom-styles/__tests__/backup.test.ts`
Expected: FAIL——`Cannot find module '../backup'`(模块尚不存在)

- [ ] **Step 3: 写实现**

```ts
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
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/features/custom-styles/__tests__/backup.test.ts`
Expected: PASS(5 用例全绿)

- [ ] **Step 5: 全门禁 + 提交**

Run: `pnpm compile && pnpm test && pnpm lint`
Expected: 全绿

```bash
git add src/features/custom-styles/backup.ts src/features/custom-styles/__tests__/backup.test.ts
git commit -m "feat(custom-styles): 备份纯函数——信封导出 + 文件名 + 下载触发"
```

---

### Task 2: backup.ts 导入侧——parseBackup 严格校验

**Files:**
- Modify: `src/features/custom-styles/backup.ts`
- Test: `src/features/custom-styles/__tests__/backup.test.ts`(追加 describe)

**Interfaces:**
- Consumes: `matchPatternToRegExp(pattern: string): RegExp | null`(matcher.ts)
- Produces: `type ParseResult = { ok: true; styles: CustomStyle[] } | { ok: false; error: string }`;`parseBackup(raw: string): ParseResult`——严格全有或全无,报第一条错;错误文案为中文(直接面向用户 alert)

- [ ] **Step 1: 追加失败测试**

在 `backup.test.ts` 末尾(`downloadStylesFile` describe 之后)追加:

```ts
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
```

同时把 import 行补上新符号:

```ts
import { BACKUP_FORMAT, BACKUP_VERSION, backupFileName, downloadStylesFile, exportStyles, parseBackup } from '../backup';
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/features/custom-styles/__tests__/backup.test.ts`
Expected: FAIL——`parseBackup` 未导出(`[SyntaxError]` 或 `parseBackup is not a function`)

- [ ] **Step 3: 写实现**

在 `backup.ts` 末尾追加:

```ts
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
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/features/custom-styles/__tests__/backup.test.ts`
Expected: PASS(全部用例绿)

- [ ] **Step 5: 全门禁 + 提交**

Run: `pnpm compile && pnpm test && pnpm lint`
Expected: 全绿

```bash
git add src/features/custom-styles/backup.ts src/features/custom-styles/__tests__/backup.test.ts
git commit -m "feat(custom-styles): 备份严格解析——全有或全无校验,报第一条错"
```

---

### Task 3: mergeById 按 id 合并(纯函数)

**Files:**
- Modify: `src/features/custom-styles/backup.ts`
- Test: `src/features/custom-styles/__tests__/backup.test.ts`(追加 describe)

**Interfaces:**
- Consumes: `CustomStyle[]`(本地与文件两份清单;文件清单须已过 `parseBackup` 校验,即无重复 id)
- Produces: `interface MergeResult { merged: CustomStyle[]; overridden: number; added: number }`;`mergeById(local: CustomStyle[], incoming: CustomStyle[]): MergeResult`——同 id 文件为准且本地位置不动,新增按文件相对顺序追加尾部,幂等

- [ ] **Step 1: 追加失败测试**

在 `backup.test.ts` 末尾追加:

```ts
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
```

import 行补上 `mergeById`。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/features/custom-styles/__tests__/backup.test.ts`
Expected: FAIL——`mergeById` 未导出

- [ ] **Step 3: 写实现**

在 `backup.ts` 末尾追加:

```ts
export interface MergeResult {
  merged: CustomStyle[];
  overridden: number;
  added: number;
}

/**
 * 按 id 合并(issue #14 冲突策略):同 id 以文件为准覆盖(本地顺序保留、位置不动),
 * 文件新增项按文件相对顺序追加尾部;幂等。
 * 前置:incoming 已过 parseBackup 校验(无重复 id)。
 */
export function mergeById(local: CustomStyle[], incoming: CustomStyle[]): MergeResult {
  const incomingById = new Map(incoming.map((s) => [s.id, s]));
  let overridden = 0;
  const merged = local.map((s) => {
    const repl = incomingById.get(s.id);
    if (repl === undefined) return s;
    overridden++;
    return repl;
  });
  const localIds = new Set(local.map((s) => s.id));
  const fresh = incoming.filter((s) => !localIds.has(s.id));
  return { merged: [...merged, ...fresh], overridden, added: fresh.length };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/features/custom-styles/__tests__/backup.test.ts`
Expected: PASS(全部用例绿)

- [ ] **Step 5: 全门禁 + 提交**

Run: `pnpm compile && pnpm test && pnpm lint`
Expected: 全绿

```bash
git add src/features/custom-styles/backup.ts src/features/custom-styles/__tests__/backup.test.ts
git commit -m "feat(custom-styles): mergeById 按 id 合并——本地序保留、新增尾部追加、幂等"
```

---

### Task 4: store.importStyles 写路径 + 编辑不变式

**Files:**
- Modify: `src/features/custom-styles/store.ts`
- Test: `src/features/custom-styles/__tests__/store.test.ts`(追加 describe)

**Interfaces:**
- Consumes: `mergeById(local, incoming): MergeResult`(backup.ts,Task 3)
- Produces: `importStyles(incoming: CustomStyle[]): Promise<{ overridden: number; added: number }>`——经写队列串行合并入 storage,ref 即时回填;若文件替换了正在编辑的样式 → 清 editing(队列 op 内直写,同 remove)。`useCustomStyles()` 返回值新增 `importStyles`

- [ ] **Step 1: 追加失败测试**

在 `store.test.ts` 末尾(`describe` 块之后)追加:

```ts
describe('importStyles(#14 导入)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('按 id 合并:同 id 覆盖位置不动,新增追加尾部,计数正确,ref 即时回填', async () => {
    const api = await freshStore();
    await vi.waitFor(() => expect(api.styles.value).toEqual([]));
    const a = await api.create();
    const b = await api.create();

    const incoming = [
      { ...a, name: '文件版' },
      { id: 'new-1', name: '新', enabled: false, patterns: [], code: '', createdAt: 1, updatedAt: 1 },
    ];
    const summary = await api.importStyles(incoming);
    expect(summary).toEqual({ overridden: 1, added: 1 });
    expect(api.styles.value.map((s) => s.id)).toEqual([a.id, b.id, 'new-1']);
    expect(api.styles.value[0]!.name).toBe('文件版');

    const stored = await fakeBrowser.storage.local.get('customStyles');
    expect((stored.customStyles as unknown[]).length).toBe(3);
  });

  it('幂等:同一清单导两次,第二次全为覆盖,清单不变', async () => {
    const api = await freshStore();
    await vi.waitFor(() => expect(api.styles.value).toEqual([]));
    const a = await api.create();
    const incoming = [{ ...a, name: '文件版' }];
    await api.importStyles(incoming);
    const second = await api.importStyles(incoming);
    expect(second).toEqual({ overridden: 1, added: 0 });
    expect(api.styles.value.map((s) => s.name)).toEqual(['文件版']);
  });

  it('不变式:文件替换了正在编辑的样式 → editingId 清空;未涉及 → 保留', async () => {
    const api = await freshStore();
    await vi.waitFor(() => expect(api.styles.value).toEqual([]));
    const a = await api.create();
    const b = await api.create();

    // 导入只含 a' → 正在编辑的 b 不受影响
    await api.setEditing(b.id);
    await api.importStyles([{ ...a, name: '文件版' }]);
    expect(api.editingId.value).toBe(b.id);

    // 导入含 b' → 编辑会话结束(推广 remove 的不变式)
    await api.importStyles([{ ...b, name: '文件乙' }]);
    expect(api.editingId.value).toBeNull();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/features/custom-styles/__tests__/store.test.ts`
Expected: FAIL——`api.importStyles is not a function`

- [ ] **Step 3: 写实现**

`store.ts` 顶部 import 区加一行:

```ts
import { mergeById } from './backup';
```

在 `setEditing` 之后、`// ---- 对外 interface ----` 之前插入:

```ts
export interface ImportSummary {
  overridden: number;
  added: number;
}

/**
 * 导入(issue #14):按 id 合并入 storage(mergeById 语义);经写队列串行。
 * 不变式推广:文件替换了正在编辑的样式 → 清 editing 回清单(同 remove;队列 op 内直写)。
 */
export function importStyles(incoming: CustomStyle[]): Promise<ImportSummary> {
  return enqueue(async () => {
    const local = await customStylesItem.getValue();
    const { merged, overridden, added } = mergeById(local, incoming);
    await writeList(merged);
    if (editingId.value !== null && incoming.some((s) => s.id === editingId.value)) {
      await editingItem.setValue(null);
      editingId.value = null;
    }
    return { overridden, added };
  });
}
```

`useCustomStyles` 返回值与注释同步更新:

```ts
/**
 * 消费方获取 store(单例:多次调用同一份状态)。
 * styles 为只读语义(请勿直接改写;变更一律走 create/update/remove/move/importStyles)。
 */
export function useCustomStyles() {
  return { styles, editingId, create, update, remove, move, setEditing, importStyles };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/features/custom-styles/__tests__/store.test.ts`
Expected: PASS(原有 + 新增 3 例全绿)

- [ ] **Step 5: 全门禁 + 提交**

Run: `pnpm compile && pnpm test && pnpm lint`
Expected: 全绿

```bash
git add src/features/custom-styles/store.ts src/features/custom-styles/__tests__/store.test.ts
git commit -m "feat(custom-styles): store.importStyles 写路径——队列串行 + 编辑不变式推广"
```

---

### Task 5: ManageStylesBlock 接线——导出/导入按钮 + 摘要确认流

**Files:**
- Modify: `src/features/custom-styles/components/ManageStylesBlock.vue`
- Test: `src/features/custom-styles/__tests__/ManageStylesBlock.test.ts`(新建)

**Interfaces:**
- Consumes: `exportStyles` / `backupFileName` / `downloadStylesFile` / `parseBackup` / `mergeById`(backup.ts);`store.styles` / `store.editingId` / `store.importStyles`(store.ts)
- Produces: 无对外接口——UI 接线;交互流:导出点击即下载;导入选文件 → 严格解析(错则 alert 且不动 storage)→ 摘要 confirm(含编辑中样式提示)→ `store.importStyles`

- [ ] **Step 1: 写失败测试**

```ts
// src/features/custom-styles/__tests__/ManageStylesBlock.test.ts
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import type { CustomStyle } from '../types';

// 组件与 store 共用同一份 fresh 模块注册表(vi.resetModules 后先后 import 即同一实例)
async function freshFixture(seeded: CustomStyle[]) {
  vi.resetModules();
  await fakeBrowser.storage.local.set({ customStyles: seeded });
  const storeMod = await import('../store');
  const compMod = await import('../components/ManageStylesBlock.vue');
  await vi.waitFor(() => expect(storeMod.useCustomStyles().styles.value).toEqual(seeded));
  return { store: storeMod.useCustomStyles(), ManageStylesBlock: compMod.default };
}

function style(over: Partial<CustomStyle>): CustomStyle {
  return { id: 'x', name: 'n', enabled: true, patterns: ['<all_urls>'], code: '', createdAt: 0, updatedAt: 0, ...over };
}

function backupOf(styles: CustomStyle[]): string {
  return JSON.stringify({ format: 'browser-ext/custom-styles', version: 1, exportedAt: '2026-09-02T00:00:00.000Z', styles }, null, 2);
}

function pickButton(wrapper: VueWrapper, text: string) {
  const btn = wrapper.findAll('button').find((b) => b.text() === text);
  expect(btn, `按钮「${text}」应存在`).toBeDefined();
  return btn!;
}

async function chooseFile(wrapper: VueWrapper, text: string) {
  const input = wrapper.find('input[type="file"]');
  const file = new File([text], 'backup.json', { type: 'application/json' });
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true });
  await input.trigger('change');
  await flushPromises();
}

describe('ManageStylesBlock 导出/导入(issue #14)', () => {
  let alert: ReturnType<typeof vi.spyOn>;
  let confirm: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fakeBrowser.reset();
    alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (URL as unknown as Record<string, unknown>).createObjectURL;
    delete (URL as unknown as Record<string, unknown>).revokeObjectURL;
  });

  it('导出:点击触发下载,文件名带日期,内容为含全字段的信封', async () => {
    const a = style({ id: 'a', name: '红字', code: 'body{}', createdAt: 1, updatedAt: 2 });
    const { ManageStylesBlock } = await freshFixture([a]);
    const created = vi.fn(() => 'blob:mock');
    const revoked = vi.fn();
    Object.assign(URL, { createObjectURL: created, revokeObjectURL: revoked });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const wrapper = mount(ManageStylesBlock);
    await flushPromises();

    await pickButton(wrapper, '导出').trigger('click');

    expect(created).toHaveBeenCalledTimes(1);
    const blob = created.mock.calls[0]![0] as Blob;
    const env = JSON.parse(await blob.text());
    expect(env.format).toBe('browser-ext/custom-styles');
    expect(env.version).toBe(1);
    expect(env.styles).toEqual([a]);
    const anchor = clickSpy.mock.instances[0] as unknown as HTMLAnchorElement;
    expect(anchor.download).toMatch(/^custom-styles-\d{4}-\d{2}-\d{2}\.json$/);
    expect(revoked).toHaveBeenCalledWith('blob:mock');
  });

  it('导入:解析→摘要 confirm(覆盖 1/新增 1)→合并入 storage', async () => {
    const a = style({ id: 'a', name: '甲' });
    const b = style({ id: 'b', name: '乙' });
    const { ManageStylesBlock } = await freshFixture([a]);

    const wrapper = mount(ManageStylesBlock);
    await flushPromises();
    await chooseFile(wrapper, backupOf([style({ id: 'a', name: '文件甲' }), b]));

    expect(alert).not.toHaveBeenCalled();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0]![0]).toContain('覆盖 1 条');
    expect(confirm.mock.calls[0]![0]).toContain('新增 1 条');

    const stored = (await fakeBrowser.storage.local.get('customStyles')).customStyles as CustomStyle[];
    expect(stored.map((s) => s.id)).toEqual(['a', 'b']);
    expect(stored[0]!.name).toBe('文件甲');
  });

  it('confirm 取消 / 空文件不入 storage', async () => {
    confirm.mockReturnValue(false);
    const a = style({ id: 'a' });
    const { ManageStylesBlock } = await freshFixture([a]);
    const wrapper = mount(ManageStylesBlock);
    await flushPromises();

    await chooseFile(wrapper, backupOf([style({ id: 'n1' })]));
    let stored = (await fakeBrowser.storage.local.get('customStyles')).customStyles as CustomStyle[];
    expect(stored.map((s) => s.id)).toEqual(['a']);

    // 空文件:解析合法但覆盖 0 新增 0 → alert 提示,confirm 不弹,storage 不动
    await chooseFile(wrapper, backupOf([]));
    expect(confirm).toHaveBeenCalledTimes(1); // 仍是上面取消那一次
    expect(alert).toHaveBeenCalledWith('备份文件没有样式,没有可导入的内容。');
    stored = (await fakeBrowser.storage.local.get('customStyles')).customStyles as CustomStyle[];
    expect(stored.map((s) => s.id)).toEqual(['a']);
  });

  it('导入:非法文件 → alert 报第一条错,storage 不动,不弹 confirm', async () => {
    const a = style({ id: 'a' });
    const { ManageStylesBlock } = await freshFixture([a]);
    const wrapper = mount(ManageStylesBlock);
    await flushPromises();

    await chooseFile(wrapper, backupOf([style({ id: 'a' }), style({ id: 'a', name: '重复' })]));

    expect(confirm).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert.mock.calls[0]![0]).toContain('导入失败');
    expect(alert.mock.calls[0]![0]).toContain('id 重复');
    const stored = (await fakeBrowser.storage.local.get('customStyles')).customStyles as CustomStyle[];
    expect(stored.map((s) => s.id)).toEqual(['a']);
  });

  it('导入含编辑中样式:confirm 文案提示编辑会话结束,导入后 editingId 清空', async () => {
    const a = style({ id: 'a' });
    const b = style({ id: 'b' });
    const { store, ManageStylesBlock } = await freshFixture([a, b]);
    const wrapper = mount(ManageStylesBlock);
    await flushPromises();
    await store.setEditing(b.id);

    await chooseFile(wrapper, backupOf([style({ id: 'b', name: '文件乙' })]));

    expect(confirm.mock.calls[0]![0]).toContain('编辑会话将结束');
    await flushPromises();
    expect(store.editingId.value).toBeNull();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run src/features/custom-styles/__tests__/ManageStylesBlock.test.ts`
Expected: FAIL——`按钮「导出」应存在`(按钮尚未接线)

- [ ] **Step 3: 写实现**

`ManageStylesBlock.vue` 完整替换为:

```vue
<!-- src/features/custom-styles/components/ManageStylesBlock.vue -->
<script lang="ts" setup>
import { ref } from 'vue';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import StyleList from './StyleList.vue';
import { useCustomStyles } from '../store';
import { openManagerPanel } from '../openManagerPanel';
import { backupFileName, downloadStylesFile, exportStyles, mergeById, parseBackup } from '../backup';

const store = useCustomStyles();
const fileInput = ref<HTMLInputElement | null>(null);

/** 编辑动作 = 设定编辑对象 + 尝试唤起侧边栏;唤不起就提示手动开 */
async function edit(id: string) {
  await store.setEditing(id);
  if (!(await openManagerPanel())) {
    window.alert('未能自动打开侧边栏,请手动打开浏览器的扩展侧边栏查看编辑器。');
  }
}

async function createAndEdit() {
  const s = await store.create();
  await edit(s.id);
}

async function confirmRemove(id: string) {
  const target = store.styles.value.find((s) => s.id === id);
  if (!target) return;
  if (!window.confirm(`删除「${target.name}」?不可恢复。`)) return;
  await store.remove(id);
}

/** 导出:全量样式 → 备份文件下载(不加 downloads 权限) */
function exportBackup() {
  downloadStylesFile(
    backupFileName(new Date()),
    exportStyles(store.styles.value, new Date().toISOString()),
  );
}

/** 导入:严格解析 → 摘要 confirm → 按 id 合并;错则 alert 且不动 storage */
async function onImportFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = ''; // 清空以允许重选同一文件
  if (!file) return;

  const parsed = parseBackup(await file.text());
  if (!parsed.ok) {
    window.alert(`导入失败:${parsed.error}`);
    return;
  }
  const { overridden, added } = mergeById(store.styles.value, parsed.styles);
  if (overridden === 0 && added === 0) {
    window.alert('备份文件没有样式,没有可导入的内容。');
    return;
  }
  let msg = `导入将覆盖 ${overridden} 条、新增 ${added} 条样式,继续?`;
  if (store.editingId.value !== null && parsed.styles.some((s) => s.id === store.editingId.value)) {
    msg += '\n文件包含正在编辑的样式,导入后编辑会话将结束。';
  }
  if (!window.confirm(msg)) return;
  await store.importStyles(parsed.styles);
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-base">
        自定义样式
      </CardTitle>
      <CardDescription>按域名/全局注入 CSS;编辑与所见即所得预览在侧边栏进行</CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-3">
      <StyleList
        :styles="store.styles.value"
        @toggle="(id, on) => store.update(id, { enabled: on })"
        @edit="edit"
        @remove="confirmRemove"
        @move="(id, d) => store.move(id, d)"
      />
      <Button
        variant="outline"
        class="w-full"
        @click="createAndEdit"
      >
        新建样式(在侧边栏编辑)
      </Button>
      <div class="flex gap-2">
        <Button
          variant="outline"
          class="flex-1"
          @click="exportBackup"
        >
          导出
        </Button>
        <Button
          variant="outline"
          class="flex-1"
          @click="fileInput?.click()"
        >
          导入
        </Button>
        <input
          ref="fileInput"
          type="file"
          accept="application/json,.json"
          class="hidden"
          @change="onImportFile"
        >
      </div>
    </CardContent>
  </Card>
</template>
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run src/features/custom-styles/__tests__/ManageStylesBlock.test.ts`
Expected: PASS(5 用例全绿)

- [ ] **Step 5: 全门禁 + 提交**

Run: `pnpm compile && pnpm test && pnpm lint`
Expected: 全绿

```bash
git add src/features/custom-styles/components/ManageStylesBlock.vue src/features/custom-styles/__tests__/ManageStylesBlock.test.ts
git commit -m "feat(custom-styles): options 管理块接导出/导入——摘要确认 + 报错提示"
```

---

### Task 6: 收尾——三端构建门禁 + issue 验收留痕

**Files:**
- 无代码改动(若门禁暴露问题,修复后按所属任务补提交)

**Interfaces:**
- Consumes: 前五个任务的全部产出
- Produces: issue #14 的验收评论 + 关闭

- [ ] **Step 1: 三端构建**

Run: `pnpm build`
Expected: chrome / firefox / edge 三端构建成功(manifest 无新增权限——确认 `permissions` 仍只有 `storage`(+Chromium `sidePanel`),`host_permissions` 仍只有 `<all_urls>`)

- [ ] **Step 2: 全门禁终检**

Run: `pnpm compile && pnpm test && pnpm lint`
Expected: 全绿

- [ ] **Step 3: issue 留痕 + 关闭**

用 `gh issue comment 14` 发验收评论(中文,对照规格逐项:信封格式/全保真/全量导出/无 downloads 权限/按 id 合并语义/严格校验/摘要确认/编辑不变式/UI 入口),附交付文件清单与测试数;然后:

```bash
gh issue close 14
```

Expected: issue #14 关闭,`ready-for-agent` 标签随关闭留存即可(仓库惯例不强制摘除)。
