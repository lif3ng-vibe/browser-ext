// src/entrypoints/popup/__tests__/App.test.ts
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import type { Note } from '@/features/notes/types';

// 首个用例要支付一次性模块图编译开销(vi.resetModules 后动态导入组件树),
// 默认 5s 在高负载机器上偶发超时;仅本文件放宽到 15s(挂载测试文件同款先例)
vi.setConfig({ testTimeout: 15_000 });

// jsdom 没有 matchMedia;useTheme 依赖它。裸函数而非 vi.fn():afterEach 的
// restoreAllMocks 会清 vi.fn 实现,多用例文件第二个用例起变 undefined(sidepanel 先例)
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
});

// 聚合壳与 notes store 共用同一份 fresh 模块注册表(vi.resetModules 后先后 import 即同一实例)
async function freshFixture(seeded: Note[]) {
  vi.resetModules();
  if (seeded.length > 0) await fakeBrowser.storage.local.set({ notes: seeded });
  const storeMod = await import('@/features/notes/store');
  const compMod = await import('../App.vue');
  await vi.waitFor(() => expect(storeMod.useNotes().notes.value).toEqual(seeded));
  return { store: storeMod.useNotes(), App: compMod.default };
}

function note(over: Partial<Note>): Note {
  return { id: 'x', url: null, text: '', createdAt: 1, updatedAt: 1, ...over };
}

/** 本页便签过滤视图的文本(排除其余区域;靠 data-testid 圈定) */
function pageNoteTexts(wrapper: VueWrapper) {
  return wrapper
    .findAll('[data-testid="popup-page-notes"] li')
    .map((li) => li.text().trim());
}

/** 造一个有活动标签页的假窗口:fakeBrowser 的 currentWindow 查询依赖 focused window */
async function seedActiveTab(url: string): Promise<number> {
  await fakeBrowser.windows.create({ focused: true });
  const tab = await fakeBrowser.tabs.create({ url, active: true });
  return tab.id!;
}

describe('popup App', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('渲染标题与主题快切,齿轮可打开设置', async () => {
    // fakeBrowser 的 runtime.openOptionsPage 未实现(调用即抛),spy 整个 browser 对象
    const openOptionsPage = vi.fn().mockResolvedValue(undefined);
    (globalThis as Record<string, unknown>).browser = { runtime: { openOptionsPage } };

    const { App } = await freshFixture([]);
    const wrapper = mount(App);
    await flushPromises();

    expect(wrapper.find('h1').text()).toBe('browser-ext');
    expect(wrapper.find('[aria-label="打开设置"]').exists()).toBe(true);
    // ThemeQuickSwitch 四主题色块都渲染
    const swatches = wrapper.findAll('button[aria-pressed]');
    expect(swatches.length).toBe(4);

    delete (globalThis as Record<string, unknown>).browser;
  });

  // ---- 便签板入口(issue #26,规格 #21 故事 24):头部图标 window.open 唤起 ----

  it('头部便签图标:window.open 唤起便签板小窗(~320×480)', async () => {
    // fakeBrowser 原生实现 runtime.getURL(chrome-extension://test-extension-id/<path>),无需桩
    const open = vi.fn().mockReturnValue(null);
    vi.spyOn(window, 'open').mockImplementation(open);

    const { App } = await freshFixture([]);
    const wrapper = mount(App);
    await flushPromises();

    const btn = wrapper.find('[aria-label="打开便签板"]');
    expect(btn, '便签板按钮应存在').toBeTruthy();
    await btn.trigger('click');
    await flushPromises();

    expect(open).toHaveBeenCalledTimes(1);
    const [url, target, features] = open.mock.calls[0]!;
    expect(url).toBe('chrome-extension://test-extension-id/notes-board.html');
    expect(target).toBe('notes-board');
    expect(features).toContain('width=320');
    expect(features).toContain('height=480');
  });

  // ---- 本页便签过滤视图(issue #26,规格 #21 故事 26):按当前 tab URL 派生 ----

  it('本页过滤视图:列出当前 tab 的便签,别页/全局便签不出现(updatedAt 倒序)', async () => {
    await seedActiveTab('https://a.com/p');
    const older = note({ id: 'old', url: 'https://a.com/p', text: '旧的', updatedAt: 1 });
    const newer = note({ id: 'new', url: 'https://a.com/p', text: '新的', updatedAt: 2 });
    const elsewhere = note({ id: 'else', url: 'https://b.com/q', text: '别页' });
    const global = note({ id: 'g', url: null, text: '全局' });
    const { App } = await freshFixture([elsewhere, older, global, newer]);
    const wrapper = mount(App);
    await flushPromises();
    await new Promise((r) => setTimeout(r, 50));

    expect(pageNoteTexts(wrapper)).toEqual(['新的', '旧的']);
    expect(wrapper.text()).not.toContain('别页');
    expect(wrapper.text()).not.toContain('全局');
  });

  it('本页无便签:轻量空态;tab URL 变化 → 列表跟随', async () => {
    const tabId = await seedActiveTab('https://a.com/p');
    const b = note({ id: 'b', url: 'https://b.com/q', text: '另一页的' });
    const { App } = await freshFixture([b]);
    const wrapper = mount(App);
    await flushPromises();
    await new Promise((r) => setTimeout(r, 50));

    expect(pageNoteTexts(wrapper)).toEqual([]);
    expect(wrapper.find('[data-testid="popup-page-notes"]').text()).toContain('此页无便签');

    await fakeBrowser.tabs.update(tabId, { url: 'https://b.com/q' });
    await flushPromises();
    await new Promise((r) => setTimeout(r, 50));
    expect(pageNoteTexts(wrapper)).toEqual(['另一页的']);
  });
});
