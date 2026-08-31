# 自定义样式功能(issue #3)实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按域名/全局注入自定义 CSS,Side Panel 所见即所得编辑,options 聚合管理,popup 快捷启停。

**Architecture:** 数据全部住 `src/features/custom-styles/`(Feature 目录即边界)。注入走 `document_start` content script + Constructable Stylesheet(`document.adoptedStyleSheets`);编辑器是 CodeMirror 6 封装组件,吃 semantic tokens;options 页薄壳聚合 `settings` 与 `custom-styles` 两个设置区块;跨 Feature 组合只发生在 entrypoint 薄壳。

**Tech Stack:** WXT 0.21 + Vue 3 + TS + Tailwind v4 + shadcn-vue + CodeMirror 6 + vitest(WxtVitest)。

## Global Constraints

- 浏览器矩阵:Chrome / Firefox / Edge 三端均须可用(Safari 不做)。
- 文档语言:一切给人读的文档(commit message / issue / 注释)用中文,保留 conventional 前缀;代码、标识符英文。
- commit message **禁止**任何 `Co-Authored-By:` 尾注。
- 权限:安装即申请 `host_permissions: <all_urls>`;Chrome 需 `sidePanel` 权限,Firefox 不要该权限(用 `sidebar_action`,WXT 自动转换)。
- 注入机制为 `document.adoptedStyleSheets`(Constructable Stylesheet),**不是** issue 正文原本写的 `scripting.insertCSS`——修订理由见 Task 9 Step 6 的 issue 留痕:content script 无权调 `scripting.*`(那是扩展上下文 API,须经 service worker 中转,拖慢 document_start 注入);adoptedStyleSheets 同样免疫页面 CSP,且每条样式一个 sheet、删除/重排是纯数组操作,级联顺序与 adoptedStyleSheets 数组顺序一一对应。
- 空作用域或非法 pattern 的样式**永不自动注入**(即使 enabled)。
- 预览不入 storage;`enabled` 开关落 storage(全局一份状态);列表顺序即级联优先级,无优先级数值字段。
- UI 只消费 semantic token,禁止原子色硬编码(tokens-ignore 豁免除外,见 docs/ui.md)。
- entrypoint 薄壳只做 import 挂载;跨 Feature 组合只出现在 options 薄壳(CONTEXT.md「设置区块」词条的显式豁免)。
- 测试:`pnpm test`(vitest + WxtVitest);每任务结束跑 `pnpm compile && pnpm test && pnpm lint` 全绿再提交。
- pnpm 为包管理器;只允许本地依赖安装,不动全局。

---

### Task 1: 数据层纯函数 —— 类型 + match pattern 匹配器

**Files:**
- Create: `src/features/custom-styles/types.ts`
- Create: `src/features/custom-styles/matcher.ts`
- Test: `src/features/custom-styles/__tests__/matcher.test.ts`

**Interfaces:**
- Produces: `CustomStyle` 接口;`matchPatternToRegExp(pattern: string): RegExp | null`;`expandDomain(domain: string): string[]`;`matchingStyles(styles: CustomStyle[], url: string): CustomStyle[]`;`collectStylesFor(styles: CustomStyle[], url: string): CustomStyle[]`;`buildCss(styles: CustomStyle[]): string`

- [ ] **Step 1: 写失败测试**

```ts
// src/features/custom-styles/__tests__/matcher.test.ts
import { describe, expect, it } from 'vitest';
import {
  buildCss,
  collectStylesFor,
  expandDomain,
  matchPatternToRegExp,
  matchingStyles,
  type CustomStyle,
} from '../matcher';

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
    expect(matchingStyles(list, 'https://a.com/').map((s) => s.id)).toEqual(['x', 'x']);
    expect(matchingStyles(list, 'https://b.com/').map((s) => s.id)).toEqual(['x']);
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/features/custom-styles/__tests__/matcher.test.ts`
Expected: FAIL(`Cannot find module '../matcher'`)

- [ ] **Step 3: 最小实现**

```ts
// src/features/custom-styles/types.ts
/** 一条自定义样式:命名、可启停、绑定一组标准 match pattern 作用域(级联顺序 = 列表顺序) */
export interface CustomStyle {
  id: string;
  name: string;
  enabled: boolean;
  /** 标准 match pattern;'<all_urls>' 即全局。空列表/非法项不参与自动注入 */
  patterns: string[];
  code: string;
  createdAt: number;
  updatedAt: number;
}
```

```ts
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
  const [, scheme, host, rawPath] = m;
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
```

注意:测试文件从 `../matcher` 导入 `type CustomStyle` 需在 matcher.ts 追加 `export type { CustomStyle };`,或测试直接从 `../types` 导入。**采用后者**:把测试里 `type CustomStyle` 的导入源改为 `import type { CustomStyle } from '../types';`。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/features/custom-styles/__tests__/matcher.test.ts`
Expected: PASS

- [ ] **Step 5: 全量自检 + 提交**

Run: `pnpm compile && pnpm test && pnpm lint`
Expected: 全绿

```bash
git add src/features/custom-styles
git commit -m "feat(custom-styles): 数据层 —— CustomStyle 类型 + match pattern 匹配器(纯函数)"
```

---

### Task 2: 存储层 —— repository CRUD + manifest 权限

**Files:**
- Create: `src/features/custom-styles/repository.ts`
- Test: `src/features/custom-styles/__tests__/repository.test.ts`
- Modify: `wxt.config.ts`(manifest 函数加 env 参数)

**Interfaces:**
- Consumes: Task 1 的 `CustomStyle`
- Produces: `customStylesItem` / `editingItem`(wxt storage item,含 `.watch`)`createStyle(): Promise<CustomStyle>` `updateStyle(id: string, patch: Partial<Pick<CustomStyle, 'name' | 'patterns' | 'code' | 'enabled'>>): Promise<void>` `removeStyle(id: string): Promise<void>` `moveStyle(id: string, delta: -1 | 1): Promise<void>` `listStyles(): Promise<CustomStyle[]>`

- [ ] **Step 1: 写失败测试**

```ts
// src/features/custom-styles/__tests__/repository.test.ts
import { fakeBrowser } from 'wxt/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createStyle,
  editingItem,
  listStyles,
  moveStyle,
  removeStyle,
  updateStyle,
} from '../repository';

describe('custom-styles repository', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('createStyle 默认值:未命名/禁用/全局作用域,并追加到列表尾', async () => {
    const a = await createStyle();
    const b = await createStyle();
    const all = await listStyles();
    expect(a.name).toBe('未命名样式');
    expect(a.enabled).toBe(false);
    expect(a.patterns).toEqual(['<all_urls>']);
    expect(all.map((s) => s.id)).toEqual([a.id, b.id]);
  });

  it('updateStyle 写入 patch 并刷新 updatedAt', async () => {
    const s = await createStyle();
    await new Promise((r) => setTimeout(r, 5));
    await updateStyle(s.id, { name: '红字', code: 'body{color:red}', enabled: true });
    const [saved] = await listStyles();
    expect(saved!.name).toBe('红字');
    expect(saved!.code).toBe('body{color:red}');
    expect(saved!.enabled).toBe(true);
    expect(saved!.updatedAt).toBeGreaterThanOrEqual(s.updatedAt + 5);
  });

  it('moveStyle 边界越界不动,普通交换生效', async () => {
    const a = await createStyle();
    const b = await createStyle();
    const c = await createStyle();
    await moveStyle(c.id, 1); // 越下界(delta=1 时已在末尾),顺序不变
    let ids = (await listStyles()).map((s) => s.id);
    expect(ids).toEqual([a.id, b.id, c.id]);
    await moveStyle(c.id, -1);
    ids = (await listStyles()).map((s) => s.id);
    expect(ids).toEqual([a.id, c.id, b.id]);
  });

  it('removeStyle 移除并清理 editing 指针', async () => {
    const a = await createStyle();
    await editingItem.setValue(a.id);
    await removeStyle(a.id);
    expect(await listStyles()).toEqual([]);
    expect(await editingItem.getValue()).toBeNull();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/features/custom-styles/__tests__/repository.test.ts`
Expected: FAIL(`Cannot find module '../repository'`)

- [ ] **Step 3: 实现 repository.ts**

```ts
// src/features/custom-styles/repository.ts
import { storage } from 'wxt/utils/storage';
import type { CustomStyle } from './types';

const CUSTOM_STYLES_KEY = 'local:customStyles';
const EDITING_KEY = 'local:customStyles/editing';

export const customStylesItem = storage.defineItem<CustomStyle[]>(CUSTOM_STYLES_KEY, { fallback: [] });
/** 正在编辑的样式 id:UI 全局状态,options 的「编辑」按钮经由此把侧边栏带到目标样式(存储即通道) */
export const editingItem = storage.defineItem<string | null>(EDITING_KEY, { fallback: null });

export async function listStyles(): Promise<CustomStyle[]> {
  return customStylesItem.getValue();
}

export async function createStyle(): Promise<CustomStyle> {
  const now = Date.now();
  const style: CustomStyle = {
    id: crypto.randomUUID(),
    name: '未命名样式',
    enabled: false,
    patterns: ['<all_urls>'],
    code: '',
    createdAt: now,
    updatedAt: now,
  };
  await customStylesItem.setValue([...(await listStyles()), style]);
  return style;
}

export async function updateStyle(
  id: string,
  patch: Partial<Pick<CustomStyle, 'name' | 'patterns' | 'code' | 'enabled'>>,
): Promise<void> {
  const styles = await listStyles();
  await customStylesItem.setValue(
    styles.map((s) => (s.id === id ? { ...s, ...patch, updatedAt: Date.now() } : s)),
  );
}

export async function removeStyle(id: string): Promise<void> {
  const styles = await listStyles();
  await customStylesItem.setValue(styles.filter((s) => s.id !== id));
  if ((await editingItem.getValue()) === id) await editingItem.setValue(null);
}

/** v1 的优先级仅 = 列表顺序;delta -1 上移 / +1 下移,越界不动 */
export async function moveStyle(id: string, delta: -1 | 1): Promise<void> {
  const styles = await listStyles();
  const from = styles.findIndex((s) => s.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= styles.length) return;
  const next = [...styles];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  await customStylesItem.setValue(next);
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/features/custom-styles/__tests__/repository.test.ts`
Expected: PASS

- [ ] **Step 5: wxt.config.ts 加 host 权限与 sidePanel 权限**

```ts
// wxt.config.ts —— manifest 函数整体替换
  manifest: (env) => ({
    name: 'browser-ext',
    description: '个人浏览器插件工具箱',
    version: process.env.WXT_VERSION || '0.0.0',
    // storage:主题/custom-styles 存储同步(非敏感);sidePanel:侧边栏管理面板 API(仅 Chromium)
    permissions: env.browser === 'firefox' ? ['storage'] : ['storage', 'sidePanel'],
    // custom-styles(#3):<all_urls> host 权限 —— content script 全站注入 + tabs.url 读取
    host_permissions: ['<all_urls>'],
  }),
```

- [ ] **Step 6: 全量自检 + 提交**

Run: `pnpm compile && pnpm test && pnpm lint`
Expected: 全绿

```bash
git add src/features/custom-styles wxt.config.ts
git commit -m "feat(custom-styles): storage CRUD + <all_urls>/sidePanel 权限"
```

---

### Task 3: 注入器 + content script

**Files:**
- Create: `src/features/custom-styles/injector.ts`
- Test: `src/features/custom-styles/__tests__/injector.test.ts`
- Create: `src/entrypoints/custom-styles.content.ts`

**Interfaces:**
- Consumes: Task 1 `collectStylesFor`/`buildCss`;Task 2 `customStylesItem`
- Produces: `createInjector(target?: Document): StyleInjector`(`apply(css)` / `preview(css)` / `clearPreview()`);消息协议 `{ type: 'customStyles:preview', css: string }` 与 `{ type: 'customStyles:previewClear' }`——side panel 与 popup 端都只依赖这两个常量字符串
- Produces(常量): `PREVIEW_MSG = { PREVIEW: 'customStyles:preview', CLEAR: 'customStyles:previewClear' } as const`(放 matcher.ts 同级新文件 `messages.ts`)

- [ ] **Step 1: 写失败测试**(jsdom 没有 Constructable Stylesheet,注入器以注入 `Document` 为参数,测试里用桩替身)

```ts
// src/features/custom-styles/__tests__/injector.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInjector } from '../injector';

/** CSSStyleSheet 桩:replaceSync 记录 css 供断言 */
function stubSheet() {
  return { replaceSync(css: string) { (this as any).css = css; }, replace() {} } as any as CSSStyleSheet;
}

describe('injector(adoptedStyleSheets 控制器)', () => {
  beforeEach(() => {
    vi.stubGlobal('CSSStyleSheet', function (this: any) {
      return stubSheet();
    });
  });

  function fakeDoc() {
    return { adoptedStyleSheets: [] as CSSStyleSheet[] } as any as Document & { adoptedStyleSheets: CSSStyleSheet[] };
  }

  it('apply:主 sheet 注入 css 且只 adopt 一次', () => {
    const doc = fakeDoc();
    const inject = createInjector(doc);
    inject.apply('a{}');
    inject.apply('b{}');
    expect(doc.adoptedStyleSheets).toHaveLength(1);
    expect((doc.adoptedStyleSheets[0] as any).css).toBe('b{}');
  });

  it('preview 追加在主 sheet 之后(同特异性时预览胜出)', () => {
    const doc = fakeDoc();
    const inject = createInjector(doc);
    inject.apply('a{}');
    inject.preview('p{}');
    expect(doc.adoptedStyleSheets).toHaveLength(2);
    expect((doc.adoptedStyleSheets[1] as any).css).toBe('p{}');
  });

  it('clearPreview 只移除预览 sheet', () => {
    const doc = fakeDoc();
    const inject = createInjector(doc);
    inject.apply('a{}');
    inject.preview('p{}');
    inject.clearPreview();
    expect(doc.adoptedStyleSheets).toHaveLength(1);
    inject.clearPreview(); // 幂等
    expect(doc.adoptedStyleSheets).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/features/custom-styles/__tests__/injector.test.ts`
Expected: FAIL(`Cannot find module '../injector'`)

- [ ] **Step 3: 实现 messages.ts + injector.ts**

```ts
// src/features/custom-styles/messages.ts
/** side panel/popup → content script 的消息协议 */
export const PREVIEW_MSG = {
  PREVIEW: 'customStyles:preview',
  CLEAR: 'customStyles:previewClear',
} as const;
export type PreviewMessage =
  | { type: typeof PREVIEW_MSG.PREVIEW; css: string }
  | { type: typeof PREVIEW_MSG.CLEAR };
```

```ts
// src/features/custom-styles/injector.ts
export interface StyleInjector {
  /** 保存样式(级联顺序由任务 1 在合成 CSS 时保证) */
  apply(css: string): void;
  /** 未保存预览:追加在主 sheet 之后,同特异性时覆盖已保存规则 */
  preview(css: string): void;
  clearPreview(): void;
}

/**
 * Constructable Stylesheet 注入器:免疫宿主页 CSP,
 * 主管 + 预览两张 sheet,adoptedStyleSheets 数组顺序即级联顺序。
 */
export function createInjector(target: Document = document): StyleInjector {
  const mainSheet = new CSSStyleSheet();
  const previewSheet = new CSSStyleSheet();
  const adopt = (sheet: CSSStyleSheet) => {
    if (!target.adoptedStyleSheets.includes(sheet)) {
      target.adoptedStyleSheets = [...target.adoptedStyleSheets, sheet];
    }
  };
  return {
    apply(css) {
      mainSheet.replaceSync(css);
      adopt(mainSheet);
    },
    preview(css) {
      previewSheet.replaceSync(css);
      adopt(previewSheet);
    },
    clearPreview() {
      target.adoptedStyleSheets = target.adoptedStyleSheets.filter((s) => s !== previewSheet);
      void previewSheet.replace('');
    },
  };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/features/custom-styles/__tests__/injector.test.ts`
Expected: PASS

- [ ] **Step 5: content script 薄入口**

```ts
// src/entrypoints/custom-styles.content.ts
import { buildCss, collectStylesFor } from '@/features/custom-styles/matcher';
import { createInjector } from '@/features/custom-styles/injector';
import { customStylesItem } from '@/features/custom-styles/repository';
import type { PreviewMessage } from '@/features/custom-styles/messages';
import { PREVIEW_MSG } from '@/features/custom-styles/messages';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  main() {
    const injector = createInjector();
    const refresh = async () => {
      const styles = await customStylesItem.getValue();
      injector.apply(buildCss(collectStylesFor(styles, location.href)));
    };
    void refresh();
    // storage 变化(任一端保存/启停/重排)→ 全体页面即时重生
    void customStylesItem.watch(() => void refresh());
    // 所见即所得:侧边栏未保存草稿的临时生效
    browser.runtime.onMessage.addListener((raw: unknown) => {
      const msg = raw as PreviewMessage | undefined;
      if (msg?.type === PREVIEW_MSG.PREVIEW) injector.preview(msg.css);
      else if (msg?.type === PREVIEW_MSG.CLEAR) injector.clearPreview();
    });
  },
});
```

- [ ] **Step 6: 跑一次 chrome 构建验证 manifest 出现 content script**

Run: `pnpm wxt build -b chrome && grep -A4 content_scripts .output/chrome-mv3/manifest.json`
Expected: 出现 `custom-styles.content.js`、`matches: ["<all_urls>"]`、`run_at: "document_start"`

- [ ] **Step 7: 全量自检 + 提交**

Run: `pnpm compile && pnpm test && pnpm lint`

```bash
git add src/entrypoints/custom-styles.content.ts src/features/custom-styles
git commit -m "feat(custom-styles): document_start 注入器(adoptedStyleSheets)+ content script"
```

---

### Task 4: CodeMirror 6 编辑器组件

**Files:**
- Modify: `package.json`(`pnpm add codemirror @codemirror/lang-css`)
- Create: `src/features/custom-styles/components/CodeEditor.vue`

**Interfaces:**
- Produces: `<CodeEditor v-model="text" />`(受控组件,输入即 emit)

- [ ] **Step 1: 安装本地依赖**

Run: `pnpm add codemirror @codemirror/lang-css`
Expected: 安装成功,`package.json` dependencies 增加 `codemirror`、`@codemirror/lang-css`

- [ ] **Step 2: 实现组件**(主题样式只引用 semantic token,随 `data-theme` 联动)

```vue
<!-- src/features/custom-styles/components/CodeEditor.vue -->
<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { EditorView, basicSetup } from 'codemirror';
import { css } from '@codemirror/lang-css';

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const container = ref<HTMLDivElement>();
let view: EditorView | undefined;

onMounted(() => {
  view = new EditorView({
    doc: props.modelValue,
    parent: container.value!,
    extensions: [
      basicSetup,
      css(),
      // 主题:全部走 semantic token,随 data-theme 联动
      EditorView.theme({
        '&': { backgroundColor: 'var(--lif3ng-background)', color: 'var(--lif3ng-foreground)' },
        '&.cm-focused': { outline: 'none' },
        '.cm-content': { caretColor: 'var(--lif3ng-primary)', fontFamily: 'var(--lif3ng-font-mono)' },
        '.cm-gutters': {
          backgroundColor: 'var(--lif3ng-muted)',
          color: 'var(--lif3ng-muted-foreground)',
          border: 'none',
        },
        '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'var(--lif3ng-muted)' },
      }),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) emit('update:modelValue', u.state.doc.toString());
      }),
    ],
  });
});

// 外部重置(如切换编辑对象 / 保存后回填)
watch(
  () => props.modelValue,
  (v) => {
    if (view && v !== view.state.doc.toString()) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: v } });
    }
  },
);

onBeforeUnmount(() => view?.destroy());
</script>

<template>
  <div
    ref="container"
    class="border-border overflow-hidden rounded-md border text-sm"
  />
</template>
```

- [ ] **Step 3: 自检 + 提交**(组件交互在 Task 6 的面板里人工验收)

Run: `pnpm compile && pnpm test && pnpm lint`

```bash
git add package.json pnpm-lock.yaml src/features/custom-styles/components/CodeEditor.vue
git commit -m "feat(custom-styles): CodeMirror 6 编辑器组件(semantic token 联动)"
```

---

### Task 4b: 响应式仓库 + 活动标签页跟踪

**Files:**
- Create: `src/features/custom-styles/useCustomStyles.ts`
- Create: `src/features/custom-styles/useActiveTab.ts`

**Interfaces:**
- Consumes: Task 2 repository
- Produces: `useCustomStyles(): { styles: Ref<CustomStyle[]>; editingId: Ref<string | null>; create(): Promise<CustomStyle>; update(id, patch): Promise<void>; remove(id): Promise<void>; move(id, delta): Promise<void>; setEditing(id: string | null): Promise<void> }`;`useActiveTab(): Ref<Tabs.Tab | undefined>`
- 消息协议:发送端用 `{ type: PREVIEW_MSG.PREVIEW, css }` / `{ type: PREVIEW_MSG.CLEAR }`

- [ ] **Step 1: 实现 useCustomStyles**

```ts
// src/features/custom-styles/useCustomStyles.ts
import { ref, type Ref } from 'vue';
import type { CustomStyle } from './types';
import {
  createStyle,
  customStylesItem,
  editingItem,
  moveStyle,
  removeStyle,
  updateStyle,
} from './repository';

/** storage 支撑的响应式仓库:列表与编辑指针跨上下文(popup/options/panel)自动同步 */
export function useCustomStyles() {
  const styles = ref<CustomStyle[]>([]);
  const editingId = ref<string | null>(null);

  void customStylesItem.getValue().then((v) => (styles.value = v));
  void customStylesItem.watch((v) => {
    styles.value = v ?? [];
    // 编辑对象被删 → 回到清单视图
    if (v && editingId.value && !v.some((s) => s.id === editingId.value)) {
      void editingItem.setValue(null);
    }
  });
  void editingItem.getValue().then((v) => (editingId.value = v));
  void editingItem.watch((v) => (editingId.value = v));

  return {
    styles,
    editingId,
    create: createStyle,
    update: updateStyle,
    remove: removeStyle,
    move: moveStyle,
    setEditing: (id: string | null) => editingItem.setValue(id),
  };
}
```

- [ ] **Step 2: 实现 useActiveTab**

```ts
// src/features/custom-styles/useActiveTab.ts
import { ref, type Ref } from 'vue';
import type { Tabs } from 'wxt/browser';

/** 侧边栏跟踪所在窗口的活动标签页(激活/URL 变化/关闭都重查) */
export function useActiveTab(): Ref<Tabs.Tab | undefined> {
  const tab = ref<Tabs.Tab>();
  const sync = async () => {
    const [active] = await browser.tabs.query({ active: true, currentWindow: true });
    tab.value = active;
  };
  void sync();
  browser.tabs.onActivated.addListener(() => void sync());
  browser.tabs.onUpdated.addListener(() => void sync());
  return tab;
}
```

- [ ] **Step 3: 自检 + 提交**

Run: `pnpm compile && pnpm lint`

```bash
git add src/features/custom-styles/useCustomStyles.ts src/features/custom-styles/useActiveTab.ts
git commit -m "feat(custom-styles): 响应式仓库 composable + 活动标签页跟踪"
```

---

### Task 5: 侧边栏 —— 清单视图 + 编辑视图(预览落位)

**Files:**
- Create: `src/features/custom-styles/components/StyleList.vue`
- Create: `src/features/custom-styles/components/StyleEditor.vue`
- Create: `src/features/custom-styles/ManagerPanel.vue`
- Create: `src/entrypoints/sidepanel/index.html`
- Create: `src/entrypoints/sidepanel/main.ts`

**Interfaces:**
- Consumes: Task 1/2/3 的全部产出(`StyleList` 由 Task 7 复用)
- Produces: `<StyleList :styles="..." @toggle @edit @remove @move>`;`ManagerPanel` 根组件;消息协议照 Task 3

- [ ] **Step 1: StyleList(展示 + 事件,无状态)**

```vue
<!-- src/features/custom-styles/components/StyleList.vue -->
<script lang="ts" setup>
import type { CustomStyle } from '../types';
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/checkbox';
import { ArrowDown, ArrowUp, Pencil, Trash2 } from '@lucide/vue';

defineProps<{ styles: CustomStyle[] }>();
const emit = defineEmits<{
  toggle: [id: string, enabled: boolean];
  edit: [id: string];
  remove: [id: string];
  move: [id: string, delta: -1 | 1];
}>();

function summary(s: CustomStyle): string {
  if (s.patterns.length === 1 && s.patterns[0] === '<all_urls>') return '全局';
  if (s.patterns.length === 0) return '无作用域';
  return `${s.patterns.length} 个作用域`;
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <p
      v-if="!styles.length"
      class="text-muted-foreground text-sm"
    >暂时没有自定义样式。</p>
    <div
      v-for="(s, i) in styles"
      :key="s.id"
      class="border-border flex items-center gap-2 rounded-md border p-2"
    >
      <Checkbox
        :model-value="s.enabled"
        :aria-label="`启用 ${s.name}`"
        @update:model-value="(v) => emit('toggle', s.id, v === true)"
      />
      <button
        type="button"
        class="hover:underline"
        @click="emit('edit', s.id)"
      >
        <span class="text-sm">{{ s.name }}</span>
      </button>
      <span class="text-muted-foreground ms-auto shrink-0 text-xs">{{ summary(s) }}</span>
      <span class="flex shrink-0 items-center">
        <Button
          variant="ghost"
          size="icon"
          aria-label="上移"
          :disabled="i === 0"
          @click="emit('move', s.id, -1)"
        >
          <ArrowUp class="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="下移"
          :disabled="i === styles.length - 1"
          @click="emit('move', s.id, 1)"
        >
          <ArrowDown class="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="编辑"
          @click="emit('edit', s.id)"
        >
          <Pencil class="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="删除"
          @click="emit('remove', s.id)"
        >
          <Trash2 class="size-4" />
        </Button>
      </span>
    </div>
  </div>
</template>
```

- [ ] **Step 2: StyleEditor(名称/作用域/代码 + 未保存脏标记 + 防抖预览)**

```vue
<!-- src/features/custom-styles/components/StyleEditor.vue -->
<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { useDebounceFn } from '@vueuse/core';
import CodeEditor from './CodeEditor.vue';
import { useCustomStyles } from '../useCustomStyles';
import { useActiveTab } from '../useActiveTab';
import { expandDomain } from '../matcher';
import { PREVIEW_MSG } from '../messages';
import type { CustomStyle } from '../types';
import { Button } from '@/shared/ui/button';
import { Label } from '@/shared/ui/label';

const props = defineProps<{ record: CustomStyle }>();
const store = useCustomStyles();
const activeTab = useActiveTab();

const name = ref(props.record.name);
const patternsText = ref(props.record.patterns.join('\n'));
const code = ref(props.record.code);

// 裸域名 → 精确+子域 两条 pattern;完整 pattern 原样保留
function parsePatterns(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split('\n').map((l) => l.trim()).filter(Boolean)) {
    out.push(...expandDomain(line));
  }
  return [...new Set(out)];
}

const dirty = computed(
  () =>
    name.value !== props.record.name ||
    code.value !== props.record.code ||
    JSON.stringify(parsePatterns(patternsText.value)) !== JSON.stringify(props.record.patterns),
);

// 编辑对象切换(外层 record 变了)→ 表单重置
watch(
  () => props.record.id,
  () => {
    name.value = props.record.name;
    patternsText.value = props.record.patterns.join('\n');
    code.value = props.record.code;
  },
);

const previewable = computed(() => /^https?:/.test(activeTab.value?.url ?? ''));

async function sendPreview() {
  const id = activeTab.value?.id;
  if (id == null || !dirty.value || !previewable.value) return;
  try {
    await browser.tabs.sendMessage(id, { type: PREVIEW_MSG.PREVIEW, css: code.value });
  } catch {
    /* 该页没有 content script(如受保护页面),忽略 */
  }
}
const sendPreviewDebounced = useDebounceFn(() => void sendPreview(), 300);
watch(code, () => void sendPreviewDebounced());

// 活动标签页切换:旧 tab 收走预览;若仍脏,新 tab 继续预览
watch(activeTab, async (next, prev) => {
  if (prev?.id != null) {
    try {
      await browser.tabs.sendMessage(prev.id, { type: PREVIEW_MSG.CLEAR });
    } catch { /* 无 content script */ }
  }
  if (next && dirty.value) void sendPreviewDebounced();
});

async function save() {
  await store.update(props.record.id, {
    name: name.value.trim() || '未命名样式',
    code: code.value,
    patterns: parsePatterns(patternsText.value),
  });
  const id = activeTab.value?.id;
  if (id != null) {
    try {
      await browser.tabs.sendMessage(id, { type: PREVIEW_MSG.CLEAR });
    } catch { /* 无 content script */ }
  }
}

async function back() {
  if (dirty.value && !window.confirm('有未保存修改,放弃并返回清单?')) return;
  await store.setEditing(null);
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col gap-3">
    <div class="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        aria-label="返回清单"
        @click="back"
      >
        ←
      </Button>
      <input
        v-model="name"
        class="border-input bg-background h-8 w-full rounded-md border px-2 text-sm"
        aria-label="样式名称"
      />
      <span
        v-if="dirty"
        class="bg-secondary text-secondary-foreground shrink-0 rounded px-1.5 py-0.5 text-xs"
      >未保存</span>
 <Button
        variant="outline"
        size="sm"
        :disabled="!dirty"
        @click="save"
      >保存</Button>
    </div>

    <div class="flex flex-col gap-1">
      <Label
        for="style-patterns"
        class="text-muted-foreground text-xs"
      >作用域:每行一条;裸域名自动展开「精确 + 子域」</Label>
      <textarea
        id="style-patterns"
        v-model="patternsText"
        rows="2"
        class="border-input bg-background text-foreground rounded-md border px-2 py-1 font-mono text-xs"
        placeholder="github.com 或 *://github.com/*"
      />
    </div>

    <CodeEditor
      v-model="code"
      class="min-h-40 flex-1"
    />
    <p
      v-if="!previewable"
      class="text-muted-foreground text-xs"
    >当前页面不支持预览(仅 http/https)。</p>
  </div>
</template>
```

- [ ] **Step 3: ManagerPanel(面板根:清单 ⇄ 编辑)**

```vue
<!-- src/features/custom-styles/ManagerPanel.vue -->
<script lang="ts" setup>
import { computed } from 'vue';
import { useTheme } from '@/shared/theme/useTheme';
import { Button } from '@/shared/ui/button';
import StyleList from './components/StyleList.vue';
import StyleEditor from './components/StyleEditor.vue';
import { useCustomStyles } from './useCustomStyles';

useTheme(); // 侧边栏页吃主题系统,跨页面即改即随
const store = useCustomStyles();

const editing = computed(() =>
  store.styles.value.find((s) => s.id === store.editingId.value) ?? null,
);

async function newStyle() {
  const s = await store.create();
  await store.setEditing(s.id);
}

async function confirmRemove(id: string) {
  const target = store.styles.value.find((s) => s.id === id);
  if (!target) return;
  if (!window.confirm(`删除「${target.name}」?不可恢复。`)) return;
  await store.remove(id);
}
</script>

<template>
  <main class="bg-background text-foreground flex h-screen flex-col gap-3 p-3 font-sans">
    <h1 class="text-base font-medium">
      自定义样式
    </h1>

    <StyleEditor
      v-if="editing"
      :key="editing.id"
      :record="editing"
    />
    <template v-else>
      <div class="min-h-0 flex-1 overflow-y-auto">
        <StyleList
          :styles="store.styles.value"
          @toggle="(id, on) => store.update(id, { enabled: on })"
          @edit="(id) => store.setEditing(id)"
          @remove="confirmRemove"
          @move="(id, d) => store.move(id, d)"
        />
      </div>
      <Button
        class="shrink-0"
        @click="newStyle"
      >新建样式</Button>
    </template>
  </main>
</template>
```

- [ ] **Step 4: sidepanel 薄壳**(照抄 options 的 FOUC 方案)

```html
<!-- src/entrypoints/sidepanel/index.html -->
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>自定义样式 - browser-ext</title>
    <!-- FOUC 阻塞脚本:外链(CSP 实测内联被拦),Vue mount 前同步挂 data-theme -->
    <script src="/theme-fouc.js"></script>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

```ts
// src/entrypoints/sidepanel/main.ts
import { createApp } from 'vue';
import ManagerPanel from '@/features/custom-styles/ManagerPanel.vue';
import '@/shared/theme/tailwind.css';

createApp(ManagerPanel).mount('#app');
```

- [ ] **Step 5: 验证三端 manifest 都带上面板入口**

Run: `pnpm wxt build -b chrome && pnpm wxt build -b firefox && grep -E 'side_panel|sidebar_action' .output/chrome-mv3/manifest.json .output/firefox-mv3/manifest.json`
Expected: chrome 出现 `side_panel.default_path: "sidepanel.html"`;firefox 出现 `sidebar_action`

- [ ] **Step 6: 自检 + 提交**

Run: `pnpm compile && pnpm test && pnpm lint`

```bash
git add src/entrypoints/sidepanel src/features/custom-styles
git commit -m "feat(custom-styles): 侧边栏 —— 清单/编辑双视图 + 防抖预览 + 脏标记"
```

---

### Task 6: options 聚合页改造 + 打开侧边栏

**Files:**
- Create: `src/features/settings/components/ThemeSettingsBlock.vue`
- Modify: `src/entrypoints/options/main.ts`、新增 `src/entrypoints/options/App.vue`
- Delete: `src/features/settings/SettingsApp.vue`
- Create: `src/features/custom-styles/openManagerPanel.ts`
- Create: `src/features/custom-styles/components/ManageStylesBlock.vue`
- Test: `src/entrypoints/popup/__tests__` 之外新增 `src/features/custom-styles/__tests__/openManagerPanel.test.ts`

**Interfaces:**
- Consumes: Task 4b `useCustomStyles`、Task 5 `StyleList`
- Produces: options 页 = 薄壳 App.vue 聚合 `ThemeSettingsBlock` + `ManageStylesBlock`;`openManagerPanel(): Promise<boolean>`

- [ ] **Step 1: 抽 ThemeSettingsBlock(内容原样搬自 SettingsApp 的 Card)**

```vue
<!-- src/features/settings/components/ThemeSettingsBlock.vue -->
<script lang="ts" setup>
import ThemeQuickSwitch from './ThemeQuickSwitch.vue';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-base">
        外观
      </CardTitle>
      <CardDescription>主题与跟随系统(改动即时生效于所有扩展页面)</CardDescription>
    </CardHeader>
    <CardContent>
      <ThemeQuickSwitch />
    </CardContent>
  </Card>
</template>
```

- [ ] **Step 2: 打开侧边栏(差异封装:Chromium 用 sidePanel,Firefox 用 sidebarAction)+ 测试**

```ts
// src/features/custom-styles/openManagerPanel.ts
import { browser } from 'wxt/browser';

/** 以用户手势上下文打开侧边栏(选项页「编辑」按钮);打不开返回 false,由调用方提示手动打开 */
export async function openManagerPanel(): Promise<boolean> {
  try {
    if (browser.sidePanel) {
      const win = await browser.windows.getCurrent();
      await browser.sidePanel.open({ windowId: win.id! });
      return true;
    }
    if (browser.sidebarAction) {
      await browser.sidebarAction.open();
      return true;
    }
  } catch {
    /* 打不开(权限/手势/无侧边栏)→ 调用方提示 */
  }
  return false;
}
```

```ts
// src/features/custom-styles/__tests__/openManagerPanel.test.ts
import { describe, expect, it, vi } from 'vitest';
import { openManagerPanel } from '../openManagerPanel';
import { browser } from 'wxt/browser';

describe('openManagerPanel', () => {
  it('sidePanel.open 成功 → true', async () => {
    const open = vi.fn().mockResolvedValue(undefined);
    (browser as any).sidePanel = { open };
    (browser as any).windows = { getCurrent: vi.fn().mockResolvedValue({ id: 42 }) };
    await expect(openManagerPanel()).resolves.toBe(true);
    expect(open).toHaveBeenCalledWith({ windowId: 42 });
  });

  it('sidePanel.open 抛错 → false', async () => {
    (browser as any).sidePanel = { open: vi.fn().mockRejectedValue(new Error('no gesture')) };
    (browser as any).windows = { getCurrent: vi.fn().mockResolvedValue({ id: 42 }) };
    await expect(openManagerPanel()).resolves.toBe(false);
  });

  it('无 sidePanel 且无 sidebarAction → false', async () => {
    (browser as any).sidePanel = undefined;
    (browser as any).sidebarAction = undefined;
    await expect(openManagerPanel()).resolves.toBe(false);
  });
});
```

- [ ] **Step 3: ManageStylesBlock(CRUD 在管理区;侧边栏编辑)**

```vue
<!-- src/features/custom-styles/components/ManageStylesBlock.vue -->
<script lang="ts" setup>
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import StyleList from './StyleList.vue';
import { useCustomStyles } from '../useCustomStyles';
import { openManagerPanel } from '../openManagerPanel';

const store = useCustomStyles();

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
        @remove="store.remove"
        @move="(id, d) => store.move(id, d)"
      />
      <Button
        variant="outline"
        class="w-full"
        @click="createAndEdit"
      >新建样式(在侧边栏编辑)</Button>
    </CardContent>
  </Card>
</template>
```

- [ ] **Step 4: options 薄壳聚合(唯一允许跨 Feature 组合的地方)**

```ts
// src/entrypoints/options/main.ts(替换)
import { createApp } from 'vue';
import App from './App.vue';
import '@/shared/theme/tailwind.css';

createApp(App).mount('#app');
```

```vue
<!-- src/entrypoints/options/App.vue(新增) -->
<!-- 聚合页薄壳:按 CONTEXT.md「设置区块」词条,跨 Feature 组合只发生在这里 -->
<script lang="ts" setup>
import ThemeSettingsBlock from '@/features/settings/components/ThemeSettingsBlock.vue';
import ManageStylesBlock from '@/features/custom-styles/components/ManageStylesBlock.vue';
</script>

<template>
  <main class="bg-background text-foreground min-h-screen p-6 font-sans">
    <div class="mx-auto flex max-w-md flex-col gap-4">
      <h1 class="text-lg font-medium">
        设置
      </h1>
      <ThemeSettingsBlock />
      <ManageStylesBlock />
    </div>
  </main>
</template>
```

删除 `src/features/settings/SettingsApp.vue`(单文件删除,符合全局删除限制)。

- [ ] **Step 5: 自检 + 提交**

Run: `pnpm compile && pnpm test && pnpm lint`

```bash
git add src/entrypoints/options src/features/settings src/features/custom-styles
git commit -m "feat(custom-styles): options 聚合页 —— 主题区块 + 样式管理区块 + 唤起侧边栏"
```

---

### Task 7: popup 快捷开关

**Files:**
- Create: `src/features/custom-styles/components/PopupStyleToggle.vue`
- Modify: `src/entrypoints/popup/App.vue`

**Interfaces:**
- Consumes: Task 1 `matchingStyles`;Task 4b `useCustomStyles`(只读 `styles`)
- 消息协议同 Task 3(本组件只启停,不发预览消息)

- [ ] **Step 1: PopupStyleToggle 组件**

```vue
<!-- src/features/custom-styles/components/PopupStyleToggle.vue -->
<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { Checkbox } from '@/shared/ui/checkbox';
import { matchingStyles } from '../matcher';
import { useCustomStyles } from '../useCustomStyles';
import type { CustomStyle } from '../types';

const store = useCustomStyles();
const rows = ref<CustomStyle[]>([]);
const supported = ref(true);

// popup 打开即取快照:当前页命中的样式(含禁用的,便于反向启停)
onMounted(async () => {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url;
  if (!url || !/^https?:/.test(url)) {
    supported.value = false;
    return;
  }
  rows.value = matchingStyles(store.styles.value, url);
});
</script>

<template>
  <section class="border-t pt-3">
    <h2 class="text-muted-foreground mb-2 text-xs font-medium">
      此页的自定义样式
    </h2>
    <p
      v-if="!supported"
      class="text-muted-foreground text-sm"
    >此页面不支持注入。</p>
    <template v-else>
      <p
        v-if="!rows.length"
        class="text-muted-foreground text-sm"
      >本页没有命中的样式。</p>
      <label
        v-for="s in rows"
        :key="s.id"
        class="flex items-center gap-2 py-1 text-sm"
      >
        <Checkbox
          :model-value="s.enabled"
          :aria-label="`启用 ${s.name}`"
          @update:model-value="(v) => store.update(s.id, { enabled: v === true })"
        />
        <span class="text-sm">{{ s.name }}</span>
      </label>
    </template>
  </section>
</template>
```

- [ ] **Step 2: popup App.vue 挂接**(在 `<ThemeQuickSwitch />` 之后、提示语之前插入)

```vue
    <ThemeQuickSwitch />

    <PopupStyleToggle />

    <p class="text-muted-foreground mt-3 text-xs">
      完整设置在「打开设置」里。
    </p>
```

`<script setup>` 增加 import:`import PopupStyleToggle from '@/features/custom-styles/components/PopupStyleToggle.vue';`

- [ ] **Step 3: 自检 + 提交**

Run: `pnpm compile && pnpm test && pnpm lint`
(popup 已有组件测试 `src/entrypoints/popup/__tests__/App.test.ts`,若因新分区 mock 缺失挂掉,在该测试补 `browser.tabs.query` 桩:`(browser as any).tabs = { query: vi.fn().mockResolvedValue([{ url: 'https://a.com/' }]) };`)

```bash
git add src/features/custom-styles/components/PopupStyleToggle.vue src/entrypoints/popup
git commit -m "feat(custom-styles): popup 当前页样式一键启停"
```

---

### Task 8: 全量构建三端 + 真浏览器验收 + 留痕收尾

**Files:**
- Create: `docs/acceptance/custom-styles/`(验收截图)
- Modify: GitHub issue #3(注释留痕)

- [ ] **Step 1: 三端构建全绿**

Run: `pnpm build`
Expected: chrome/firefox/edge 三目录产物无报错

- [ ] **Step 2: manifest 核验**

Run:
```bash
grep -E 'all_urls|side_panel|sidebar_action|storage' .output/chrome-mv3/manifest.json
grep -E 'all_urls|sidebar_action|storage|sidePanel' .output/firefox-mv3/manifest.json
grep -E 'all_urls|side_panel|storage|sidePanel' .output/edge-mv3/manifest.json
```
Expected: chrome/edge 含 `side_panel` 与 `sidePanel` 权限;firefox 用 `sidebar_action` 且**无** `sidePanel` 权限;三端都有 `host_permissions: ["<all_urls>"]`

- [ ] **Step 3: 真浏览器验收清单**(Chrome 先跑,然后 Firefox;截图存 `docs/acceptance/custom-styles/`)

加载 `pnpm wxt`/`wxt build` 产物后逐项验证,全部记录证据:

1. 侧边栏打开:清单视图为空 + 新建按钮可用,主题正确(四种主题逐一快切面板跟随)
2. 新建样式:编辑视图出现 CodeMirror(CSS 补全弹出),「未命名样式/未保存」脏标记正确
3. 预览:对 `https://example.org/` 输入 `body { background: #0f0 !important; }` → 页面即时变绿且**刷新后消失**(未保存不入盘)
4. 保存:点击保存 → 刷新页面样式**仍在**(content script document_start 注入成功)
5. 作用域:把 patterns 换成 `github.com` → example.org 不再注入、github.com 生效;非法行(如 `nonsense`)不报错但也不注入
6. 活动标签切换:dirty 状态下切到另一标签页,旧页预览消失、新页(可预览时)继续显示草稿
7. 级联顺序:两条样式同命中时,后建的先不验证——用上移/下移调整后,被覆盖方按列表顺序变化
8. options 管理:样式列表 CRUD、上下移与侧边栏同步;「编辑」按钮唤起侧边栏并定位到该样式
9. popup:命中样式清单正确启停并落 storage(关闭重开浏览器记住状态);`chrome://` 页显示"此页面不支持注入"
10. 删除:side panel 删除后清单与注入(刷新后)同步消失

- [ ] **Step 4: Firefox 补验**

Run: `pnpm dev:firefox`(或 web-ext 加载 .output/firefox-mv3)
Expected: 上面 1–10 在 Firefox 复验(重点:sidebar_action 打开、无 sidePanel 权限报错)

- [ ] **Step 5: 全链路最后确认**

Run: `pnpm compile && pnpm test && pnpm lint && pnpm build`
Expected: 全绿

- [ ] **Step 6: 留痕 + 提交**

1. 注入机制的修订要在 issue #3 留言(决定留痕纪律):

```bash
gh issue comment 3 --repo lif3ng-vibe/browser-ext --body "实现期修订:注入机制由 \`scripting.insertCSS\` 改为 **\`document.adoptedStyleSheets\`**(Constructable Stylesheet)。理由:
- \`scripting.*\` 是扩展上下文 API,content script 内无法直接调用,须经 service worker 中转,拖慢 document_start 注入时序;
- adoptedStyleSheets 同样免疫宿主页 CSP(不产生会被 CSP 拦截的内联 style 元素);
- 每条样式一个 sheet,删除/重排/预览叠加都是纯数组操作,adoptedStyleSheets 数组顺序即级联顺序,与「列表顺序=优先级」语义一致。"
```

2. 提交验收材料与文档:

```bash
git add docs/acceptance/custom-styles
git commit -m "feat(custom-styles): 真浏览器三端验收(10 项)+ 注入机制修订留痕"
```