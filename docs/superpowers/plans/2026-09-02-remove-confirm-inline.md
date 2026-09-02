# 删除确认页内化实现计划(issue #14 后续)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把剩余 3 处 `window.confirm`/`window.alert` 调用点(两处删除确认 + 一处侧边栏唤起失败提示)改为页内 UI,与导入确认条同构。

**Architecture:** `ManageStylesBlock` 现有 `pendingImport`/`importNotice` 泛化为 `pendingConfirm`/`notice`(确认条单状态,新请求取代旧请求,天然互斥);`ManagerPanel` 加同构确认条(不抽 shared 组件)。`StyleEditor` 的放弃确认保留不动。

**Tech Stack:** Vue 3 + TS(strict + noUncheckedIndexedAccess)+ vitest(WxtVitest + fakeBrowser + jsdom)。

**Spec:** `docs/superpowers/specs/2026-09-02-remove-confirm-inline-design.md`

## Global Constraints

- 保留不动:`StyleEditor.vue:72` 的 `window.confirm`(侧边栏顶层页,可用)。
- 不抽 shared 确认条组件:两个组件各自同构实现(`pendingConfirm` + `acceptConfirm`/`cancelConfirm`)。
- 互斥:确认条是单一状态 `pendingConfirm`,新确认请求直接取代旧确认(含导入⇄删除跨类型)。
- 文案 verbatim:确认条 `删除「XXX」?不可恢复。`;按钮 `确认删除` / `确认导入` / `取消`;提示 `未能自动打开侧边栏,请手动打开浏览器的扩展侧边栏查看编辑器。`;导入摘要/报错文案不变。
- testid:确认条 `confirm-banner`,提示条 `notice`(原 `import-confirm`/`import-notice` 改名,相关测试与 `scripts/probe-import3.mjs` 同步)。
- UI 只用语义 token 类(`border-border`、`text-muted-foreground` 等),禁原子色。
- TS strict + `noUncheckedIndexedAccess`;pnpm;commit 中文 + conventional 前缀,**禁止 Co-Authored-By 尾注**。
- 每任务门禁 `pnpm compile && pnpm test && pnpm lint` 全绿再提交。

---

### Task 1: ManageStylesBlock——确认条泛化 + 删除确认/唤起提示页内化

**Files:**
- Modify: `src/features/custom-styles/components/ManageStylesBlock.vue`
- Modify: `src/features/custom-styles/__tests__/ManageStylesBlock.test.ts`(整文件替换)
- Modify: `scripts/probe-import3.mjs`(testid 选择器同步)

**Interfaces:**
- Produces: 组件内部状态 `pendingConfirm: { msg: string; confirmLabel: string; action: () => Promise<void> } | null`、`notice: string | null`;处理函数 `requestRemove(id)`、`acceptConfirm()`、`cancelConfirm()`;StyleList 的 `@remove` 改接 `requestRemove`(子组件接口不变)

- [ ] **Step 1: 整文件替换测试(RED)**

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

describe('ManageStylesBlock 导出/导入/删除(确认页内化)', () => {
  let confirmSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fakeBrowser.reset();
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (URL as unknown as Record<string, unknown>).createObjectURL;
    delete (URL as unknown as Record<string, unknown>).revokeObjectURL;
  });

  it('导出:点击触发下载,文件名带日期,内容为含全字段的信封', async () => {
    const a = style({ id: 'a', name: '红字', code: 'body{}', createdAt: 1, updatedAt: 2 });
    const { ManageStylesBlock } = await freshFixture([a]);
    const created = vi.fn<(blob: Blob) => string>(() => 'blob:mock');
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

  it('导入:解析→页内摘要确认条(覆盖 1/新增 1)→点确认合并入 storage', async () => {
    const a = style({ id: 'a', name: '甲' });
    const b = style({ id: 'b', name: '乙' });
    const { ManageStylesBlock } = await freshFixture([a]);

    const wrapper = mount(ManageStylesBlock);
    await flushPromises();
    await chooseFile(wrapper, backupOf([style({ id: 'a', name: '文件甲' }), b]));

    const banner = wrapper.find('[data-testid="confirm-banner"]');
    expect(banner.exists()).toBe(true);
    expect(banner.text()).toContain('覆盖 1 条');
    expect(banner.text()).toContain('新增 1 条');
    let stored = (await fakeBrowser.storage.local.get('customStyles')).customStyles as CustomStyle[];
    expect(stored.map((s) => s.id)).toEqual(['a']);

    await pickButton(wrapper, '确认导入').trigger('click');
    await flushPromises();
    stored = (await fakeBrowser.storage.local.get('customStyles')).customStyles as CustomStyle[];
    expect(stored.map((s) => s.id)).toEqual(['a', 'b']);
    expect(stored[0]!.name).toBe('文件甲');
    expect(wrapper.find('[data-testid="confirm-banner"]').exists()).toBe(false);
  });

  it('导入:页内确认条点「取消」→ storage 不动,确认条消失', async () => {
    const a = style({ id: 'a' });
    const { ManageStylesBlock } = await freshFixture([a]);
    const wrapper = mount(ManageStylesBlock);
    await flushPromises();

    await chooseFile(wrapper, backupOf([style({ id: 'n1' })]));
    expect(wrapper.find('[data-testid="confirm-banner"]').exists()).toBe(true);

    await pickButton(wrapper, '取消').trigger('click');
    await flushPromises();
    const stored = (await fakeBrowser.storage.local.get('customStyles')).customStyles as CustomStyle[];
    expect(stored.map((s) => s.id)).toEqual(['a']);
    expect(wrapper.find('[data-testid="confirm-banner"]').exists()).toBe(false);
  });

  it('空文件:解析合法但覆盖 0 新增 0 → 页内提示「没有可导入的内容」,不出确认条,storage 不动', async () => {
    const a = style({ id: 'a' });
    const { ManageStylesBlock } = await freshFixture([a]);
    const wrapper = mount(ManageStylesBlock);
    await flushPromises();

    await chooseFile(wrapper, backupOf([]));

    expect(wrapper.find('[data-testid="confirm-banner"]').exists()).toBe(false);
    const notice = wrapper.find('[data-testid="notice"]');
    expect(notice.exists()).toBe(true);
    expect(notice.text()).toContain('没有可导入的内容');
    const stored = (await fakeBrowser.storage.local.get('customStyles')).customStyles as CustomStyle[];
    expect(stored.map((s) => s.id)).toEqual(['a']);
  });

  it('导入:非法文件 → 页内提示报第一条错,不出确认条,storage 不动', async () => {
    const a = style({ id: 'a' });
    const { ManageStylesBlock } = await freshFixture([a]);
    const wrapper = mount(ManageStylesBlock);
    await flushPromises();

    await chooseFile(wrapper, backupOf([style({ id: 'a' }), style({ id: 'a', name: '重复' })]));

    expect(wrapper.find('[data-testid="confirm-banner"]').exists()).toBe(false);
    const notice = wrapper.find('[data-testid="notice"]');
    expect(notice.exists()).toBe(true);
    expect(notice.text()).toContain('导入失败');
    expect(notice.text()).toContain('id 重复');
    const stored = (await fakeBrowser.storage.local.get('customStyles')).customStyles as CustomStyle[];
    expect(stored.map((s) => s.id)).toEqual(['a']);
  });

  it('导入含编辑中样式:确认条文案提示编辑会话结束,确认后 editingId 清空', async () => {
    const a = style({ id: 'a' });
    const b = style({ id: 'b' });
    const { store, ManageStylesBlock } = await freshFixture([a, b]);
    const wrapper = mount(ManageStylesBlock);
    await flushPromises();
    await store.setEditing(b.id);

    await chooseFile(wrapper, backupOf([style({ id: 'b', name: '文件乙' })]));

    expect(wrapper.find('[data-testid="confirm-banner"]').text()).toContain('编辑会话将结束');
    await pickButton(wrapper, '确认导入').trigger('click');
    await flushPromises();
    expect(store.editingId.value).toBeNull();
  });

  it('删除:页内确认条;取消不动;确认删除落 storage;全程不用原生 dialog', async () => {
    const a = style({ id: 'a', name: '甲' });
    const { ManageStylesBlock } = await freshFixture([a]);
    const wrapper = mount(ManageStylesBlock);
    await flushPromises();

    await wrapper.find('button[aria-label="删除"]').trigger('click');
    let banner = wrapper.find('[data-testid="confirm-banner"]');
    expect(banner.exists()).toBe(true);
    expect(banner.text()).toContain('删除「甲」?不可恢复。');
    let stored = (await fakeBrowser.storage.local.get('customStyles')).customStyles as CustomStyle[];
    expect(stored.map((s) => s.id)).toEqual(['a']);

    await pickButton(wrapper, '取消').trigger('click');
    expect(wrapper.find('[data-testid="confirm-banner"]').exists()).toBe(false);
    stored = (await fakeBrowser.storage.local.get('customStyles')).customStyles as CustomStyle[];
    expect(stored.map((s) => s.id)).toEqual(['a']);

    await wrapper.find('button[aria-label="删除"]').trigger('click');
    await pickButton(wrapper, '确认删除').trigger('click');
    await flushPromises();
    stored = (await fakeBrowser.storage.local.get('customStyles')).customStyles as CustomStyle[];
    expect(stored).toEqual([]);
    expect(wrapper.find('[data-testid="confirm-banner"]').exists()).toBe(false);
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('确认互斥:导入确认待决时点删除 → 确认条替换为删除确认', async () => {
    const a = style({ id: 'a', name: '甲' });
    const { ManageStylesBlock } = await freshFixture([a]);
    const wrapper = mount(ManageStylesBlock);
    await flushPromises();

    await chooseFile(wrapper, backupOf([style({ id: 'n1' })]));
    expect(wrapper.find('[data-testid="confirm-banner"]').exists()).toBe(true);

    await wrapper.find('button[aria-label="删除"]').trigger('click');
    const banner = wrapper.find('[data-testid="confirm-banner"]');
    expect(banner.exists()).toBe(true);
    expect(banner.text()).toContain('删除「甲」?不可恢复。');
    expect(banner.text()).not.toContain('覆盖');

    await pickButton(wrapper, '取消').trigger('click');
    await flushPromises();
    const stored = (await fakeBrowser.storage.local.get('customStyles')).customStyles as CustomStyle[];
    expect(stored.map((s) => s.id)).toEqual(['a']);
  });

  it('删除编辑中样式:确认后 editingId 清空', async () => {
    const a = style({ id: 'a', name: '甲' });
    const { store, ManageStylesBlock } = await freshFixture([a]);
    const wrapper = mount(ManageStylesBlock);
    await flushPromises();
    await store.setEditing(a.id);

    await wrapper.find('button[aria-label="删除"]').trigger('click');
    await pickButton(wrapper, '确认删除').trigger('click');
    await flushPromises();

    expect(store.editingId.value).toBeNull();
  });

  it('侧边栏唤起失败:页内提示条出现(替代被抑制的 alert)', async () => {
    const a = style({ id: 'a', name: '甲' });
    const { ManageStylesBlock } = await freshFixture([a]);
    // 确定性走「唤不起」路径:sidePanel/sidebarAction 均无 → openManagerPanel 返回 false
    const stub = fakeBrowser as unknown as Record<string, unknown>;
    const realSidePanel = stub.sidePanel;
    const realSidebarAction = stub.sidebarAction;
    stub.sidePanel = undefined;
    stub.sidebarAction = undefined;
    const wrapper = mount(ManageStylesBlock);
    await flushPromises();

    await wrapper.find('button[aria-label="编辑"]').trigger('click');
    await flushPromises();

    const notice = wrapper.find('[data-testid="notice"]');
    expect(notice.exists()).toBe(true);
    expect(notice.text()).toContain('未能自动打开侧边栏');

    stub.sidePanel = realSidePanel;
    stub.sidebarAction = realSidebarAction;
  });
});
```

- [ ] **Step 2: 跑测试确认 RED**

Run: `pnpm exec vitest run src/features/custom-styles/__tests__/ManageStylesBlock.test.ts`
Expected: FAIL——导入系用例找不到 `[data-testid="confirm-banner"]`;删除系用例因旧实现走 `window.confirm`(spy 返回 true 直接删)而无确认条;唤起失败用例无 `notice`。「导出」用例照旧通过。

- [ ] **Step 3: 整文件替换组件**

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

// 确认/提示走页内 UI:嵌入式 options(chrome://extensions 卡片「选项」= iframe)里
// window.confirm/alert 被 Chrome 静默抑制,原生 dialog 不可依赖
interface PendingConfirm {
  msg: string;
  confirmLabel: string;
  action: () => Promise<void>;
}
const pendingConfirm = ref<PendingConfirm | null>(null);
const notice = ref<string | null>(null);

/** 编辑动作 = 设定编辑对象 + 尝试唤起侧边栏;唤不起给页内提示 */
async function edit(id: string) {
  await store.setEditing(id);
  if (!(await openManagerPanel())) {
    notice.value = '未能自动打开侧边栏,请手动打开浏览器的扩展侧边栏查看编辑器。';
  }
}

async function createAndEdit() {
  const s = await store.create();
  await edit(s.id);
}

/** 删除请求 → 页内确认条(新请求取代任何待决确认,含导入确认) */
function requestRemove(id: string) {
  const target = store.styles.value.find((s) => s.id === id);
  if (!target) return;
  pendingConfirm.value = {
    msg: `删除「${target.name}」?不可恢复。`,
    confirmLabel: '确认删除',
    action: () => store.remove(id),
  };
}

/** 导出:全量样式 → 备份文件下载(不加 downloads 权限) */
function exportBackup() {
  downloadStylesFile(
    backupFileName(new Date()),
    exportStyles(store.styles.value, new Date().toISOString()),
  );
}

/** 导入:严格解析 → 页内摘要确认条 → 按 id 合并;错则页内提示且不动 storage */
async function onImportFile(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = ''; // 清空以允许重选同一文件
  if (!file) return;

  pendingConfirm.value = null;
  notice.value = null;
  const parsed = parseBackup(await file.text());
  if (!parsed.ok) {
    notice.value = `导入失败:${parsed.error}`;
    return;
  }
  const { overridden, added } = mergeById(store.styles.value, parsed.styles);
  if (overridden === 0 && added === 0) {
    notice.value = '备份文件没有样式,没有可导入的内容。';
    return;
  }
  let msg = `导入将覆盖 ${overridden} 条、新增 ${added} 条样式。`;
  if (store.editingId.value !== null && parsed.styles.some((s) => s.id === store.editingId.value)) {
    msg += '文件包含正在编辑的样式,导入后编辑会话将结束。';
  }
  pendingConfirm.value = { msg, confirmLabel: '确认导入', action: () => store.importStyles(parsed.styles) };
}

/** 确认条按钮:执行动作并收起 */
async function acceptConfirm() {
  const pending = pendingConfirm.value;
  if (!pending) return;
  pendingConfirm.value = null;
  await pending.action();
}

/** 确认条按钮:放弃 */
function cancelConfirm() {
  pendingConfirm.value = null;
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
        @remove="requestRemove"
        @move="(id, d) => store.move(id, d)"
      />
      <p
        v-if="notice"
        data-testid="notice"
        class="text-muted-foreground text-sm"
      >
        {{ notice }}
      </p>
      <div
        v-if="pendingConfirm"
        data-testid="confirm-banner"
        class="border-border rounded-md border p-2"
      >
        <p class="text-sm">
          {{ pendingConfirm.msg }}
        </p>
        <div class="mt-2 flex gap-2">
          <Button
            size="sm"
            @click="acceptConfirm"
          >
            {{ pendingConfirm.confirmLabel }}
          </Button>
          <Button
            size="sm"
            variant="outline"
            @click="cancelConfirm"
          >
            取消
          </Button>
        </div>
      </div>
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

- [ ] **Step 4: 同步探针选择器**

`scripts/probe-import3.mjs` 中:

```js
  const banner = page.locator('[data-testid="confirm-banner"]');
```

(原 `'[data-testid="import-confirm"]'`。)

- [ ] **Step 5: 跑测试确认 GREEN**

Run: `pnpm exec vitest run src/features/custom-styles/__tests__/ManageStylesBlock.test.ts`
Expected: PASS(10 用例全绿)

- [ ] **Step 6: 全门禁 + 提交**

Run: `pnpm compile && pnpm test && pnpm lint`
Expected: 全绿

```bash
git add src/features/custom-styles/components/ManageStylesBlock.vue src/features/custom-styles/__tests__/ManageStylesBlock.test.ts scripts/probe-import3.mjs
git commit -m "fix(custom-styles): 管理块删除确认/唤起提示页内化——确认条泛化为 pendingConfirm"
```

---

### Task 2: ManagerPanel——同构删除确认条

**Files:**
- Modify: `src/features/custom-styles/ManagerPanel.vue`
- Create: `src/features/custom-styles/__tests__/ManagerPanel.test.ts`

**Interfaces:**
- Consumes: 与 Task 1 同构的 `PendingConfirm` 形状(`{ msg; confirmLabel; action }`)与 `requestRemove`/`acceptConfirm`/`cancelConfirm` 命名
- Produces: 无对外接口(sidepanel 侧边栏页组件);testid `confirm-banner` 与 options 一致

- [ ] **Step 1: 新建测试(RED)**

```ts
// src/features/custom-styles/__tests__/ManagerPanel.test.ts
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import type { CustomStyle } from '../types';

// jsdom 没有 matchMedia;useTheme 依赖它(解析 + 系统明暗监听)
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
});

async function freshFixture(seeded: CustomStyle[]) {
  vi.resetModules();
  await fakeBrowser.storage.local.set({ customStyles: seeded });
  const storeMod = await import('../store');
  const compMod = await import('../ManagerPanel.vue');
  await vi.waitFor(() => expect(storeMod.useCustomStyles().styles.value).toEqual(seeded));
  return { store: storeMod.useCustomStyles(), ManagerPanel: compMod.default };
}

function style(over: Partial<CustomStyle>): CustomStyle {
  return { id: 'x', name: 'n', enabled: true, patterns: ['<all_urls>'], code: '', createdAt: 0, updatedAt: 0, ...over };
}

function pickButton(wrapper: VueWrapper, text: string) {
  const btn = wrapper.findAll('button').find((b) => b.text() === text);
  expect(btn, `按钮「${text}」应存在`).toBeDefined();
  return btn!;
}

describe('ManagerPanel 删除确认页内化', () => {
  let confirmSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fakeBrowser.reset();
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('删除:页内确认条出现;取消不动;确认删除落 storage;全程不用原生 dialog', async () => {
    const a = style({ id: 'a', name: '甲' });
    const { ManagerPanel } = await freshFixture([a]);
    const wrapper = mount(ManagerPanel);
    await flushPromises();

    await wrapper.find('button[aria-label="删除"]').trigger('click');
    let banner = wrapper.find('[data-testid="confirm-banner"]');
    expect(banner.exists()).toBe(true);
    expect(banner.text()).toContain('删除「甲」?不可恢复。');
    let stored = (await fakeBrowser.storage.local.get('customStyles')).customStyles as CustomStyle[];
    expect(stored.map((s) => s.id)).toEqual(['a']);

    await pickButton(wrapper, '取消').trigger('click');
    expect(wrapper.find('[data-testid="confirm-banner"]').exists()).toBe(false);
    stored = (await fakeBrowser.storage.local.get('customStyles')).customStyles as CustomStyle[];
    expect(stored.map((s) => s.id)).toEqual(['a']);

    await wrapper.find('button[aria-label="删除"]').trigger('click');
    await pickButton(wrapper, '确认删除').trigger('click');
    await flushPromises();
    stored = (await fakeBrowser.storage.local.get('customStyles')).customStyles as CustomStyle[];
    expect(stored).toEqual([]);
    expect(wrapper.find('[data-testid="confirm-banner"]').exists()).toBe(false);
    expect(confirmSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 跑测试确认 RED**

Run: `pnpm exec vitest run src/features/custom-styles/__tests__/ManagerPanel.test.ts`
Expected: FAIL——旧实现 `confirmRemove` 走 `window.confirm`(spy 返回 true 直接删),无确认条;末尾 `confirmSpy` 未调用断言也失败

- [ ] **Step 3: 修改组件**

`ManagerPanel.vue` script 区:`computed` import 行加 `ref`;`confirmRemove` 整个函数替换为:

```ts
// 删除确认页内化:与 options 管理块同构(原生 dialog 在嵌入式入口被静默抑制,统一不用)
interface PendingConfirm {
  msg: string;
  confirmLabel: string;
  action: () => Promise<void>;
}
const pendingConfirm = ref<PendingConfirm | null>(null);

/** 删除请求 → 页内确认条 */
function requestRemove(id: string) {
  const target = store.styles.value.find((s) => s.id === id);
  if (!target) return;
  pendingConfirm.value = {
    msg: `删除「${target.name}」?不可恢复。`,
    confirmLabel: '确认删除',
    action: () => store.remove(id),
  };
}

/** 确认条按钮:执行动作并收起 */
async function acceptConfirm() {
  const pending = pendingConfirm.value;
  if (!pending) return;
  pendingConfirm.value = null;
  await pending.action();
}

/** 确认条按钮:放弃 */
function cancelConfirm() {
  pendingConfirm.value = null;
}
```

(import 行改为 `import { computed, ref } from 'vue';`。)

模板:`<template v-else>` 内,StyleList 的 `@remove="confirmRemove"` 改为 `@remove="requestRemove"`;在列表 div 与「新建样式」Button 之间插入确认条:

```vue
      <div
        v-if="pendingConfirm"
        data-testid="confirm-banner"
        class="border-border shrink-0 rounded-md border p-2"
      >
        <p class="text-sm">
          {{ pendingConfirm.msg }}
        </p>
        <div class="mt-2 flex gap-2">
          <Button
            size="sm"
            @click="acceptConfirm"
          >
            {{ pendingConfirm.confirmLabel }}
          </Button>
          <Button
            size="sm"
            variant="outline"
            @click="cancelConfirm"
          >
            取消
          </Button>
        </div>
      </div>
```

- [ ] **Step 4: 跑测试确认 GREEN**

Run: `pnpm exec vitest run src/features/custom-styles/__tests__/ManagerPanel.test.ts`
Expected: PASS(1 用例)

- [ ] **Step 5: 全门禁 + 提交**

Run: `pnpm compile && pnpm test && pnpm lint`
Expected: 全绿

```bash
git add src/features/custom-styles/ManagerPanel.vue src/features/custom-styles/__tests__/ManagerPanel.test.ts
git commit -m "fix(custom-styles): 侧边栏删除确认页内化——与管理块同构"
```

---

### Task 3: 终检 + 真浏览器回归 + issue 留痕

**Files:**
- 无代码改动(若门禁暴露问题,修复后按所属任务补提交)

**Interfaces:**
- Consumes: Task 1/2 全部产出
- Produces: issue #14 跟进评论

- [ ] **Step 1: 门禁终检**

Run: `pnpm compile && pnpm test && pnpm lint`
Expected: 全绿(用例数 = 原 113 + 新增 4:ManageStylesBlock +4 用例(删 10 - 原 6)与 ManagerPanel +1,合计 118)

- [ ] **Step 2: Chrome 构建 + 真浏览器回归**

Run: `pnpm exec wxt build -b chrome && node scripts/probe-import3.mjs`
Expected: 构建成功;探针 PASS(页内确认条选择器已同步为 `confirm-banner`,dialog 全抑制环境下导入流端到端可用)

- [ ] **Step 3: issue #14 跟进评论**

用 `gh issue comment 14` 发中文评论:删除确认(options 管理块 + 侧边栏)与侧边栏唤起失败提示已页内化,与导入确认条同构互斥;`StyleEditor` 放弃确认保留(顶层页可用);附 commit 与测试数。

- [ ] **Step 4: 台账更新**

`.superpowers/sdd/progress-style-backup.md` 追加一行完成记录。
