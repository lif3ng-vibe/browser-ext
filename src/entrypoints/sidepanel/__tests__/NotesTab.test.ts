// src/entrypoints/sidepanel/__tests__/NotesTab.test.ts
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import type { Note } from '@/features/notes/types';

// 首个用例要支付一次性模块图编译开销(vi.resetModules 后动态导入组件树),
// 默认 5s 在高负载机器上偶发超时;仅本文件放宽到 15s
vi.setConfig({ testTimeout: 15_000 });

// 组件与 notes store 共用同一份 fresh 模块注册表(vi.resetModules 后先后 import 即同一实例)
async function freshFixture(seeded: Note[]) {
  vi.resetModules();
  if (seeded.length > 0) await fakeBrowser.storage.local.set({ notes: seeded });
  const storeMod = await import('@/features/notes/store');
  const compMod = await import('../NotesTab.vue');
  await vi.waitFor(() => expect(storeMod.useNotes().notes.value).toEqual(seeded));
  return { store: storeMod.useNotes(), NotesTab: compMod.default };
}

function note(over: Partial<Note>): Note {
  return { id: 'x', url: 'https://a.com/p', text: '', createdAt: 1, updatedAt: 1, ...over };
}

/** 防抖(~500ms)远超窗口的真实等待:测试不关心确切时长,只关心终态 */
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 造一个有活动标签页的假窗口:fakeBrowser 的 currentWindow 查询依赖 focused window */
async function seedActiveTab(url: string): Promise<number> {
  await fakeBrowser.windows.create({ focused: true });
  const tab = await fakeBrowser.tabs.create({ url, active: true });
  return tab.id!;
}

function textareas(wrapper: VueWrapper) {
  return wrapper.findAll('textarea');
}

async function storedNotes(): Promise<Note[]> {
  return ((await fakeBrowser.storage.local.get('notes')).notes ?? []) as Note[];
}

describe('NotesTab 最小本页列表(issue #24 T3;完全体 #25 T4)', () => {
  let confirm: MockInstance<typeof window.confirm>;

  beforeEach(() => {
    fakeBrowser.reset();
    confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('列出本页便签(updatedAt 倒序),别页/全局便签不出现', async () => {
    await seedActiveTab('https://a.com/p');
    const older = note({ id: 'old', url: 'https://a.com/p', text: '旧的', updatedAt: 1 });
    const newer = note({ id: 'new', url: 'https://a.com/p', text: '新的', updatedAt: 2 });
    const elsewhere = note({ id: 'else', url: 'https://b.com/q', text: '别页' });
    const global = note({ id: 'g', url: null, text: '全局' });
    const { NotesTab } = await freshFixture([elsewhere, older, global, newer]);
    const wrapper = mount(NotesTab);
    await flushPromises();
    await wait(50);

    expect(textareas(wrapper).map((t) => (t.element as HTMLTextAreaElement).value)).toEqual([
      '新的',
      '旧的',
    ]);
  });

  it('新建:幽灵绑定当前 tab URL,输入后晋升落 storage', async () => {
    await seedActiveTab('https://a.com/p');
    const { NotesTab } = await freshFixture([]);
    const wrapper = mount(NotesTab);
    await flushPromises();

    const newBtn = wrapper.findAll('button').find((b) => b.text() === '新建便签');
    expect(newBtn, '新建按钮应存在').toBeDefined();
    await newBtn!.trigger('click');
    await flushPromises();

    expect(textareas(wrapper)).toHaveLength(1); // 幽灵乐观出现
    expect(await storedNotes()).toEqual([]); // 幽灵态:未落盘

    await textareas(wrapper)[0]!.setValue('第一句');
    await wait(700);
    await flushPromises();

    const stored = await storedNotes();
    expect(stored).toHaveLength(1);
    expect(stored[0]!.url).toBe('https://a.com/p');
    expect(stored[0]!.text).toBe('第一句');
  });

  it('删除:confirm 确认 → storage 移除该条', async () => {
    await seedActiveTab('https://a.com/p');
    const a = note({ id: 'a', url: 'https://a.com/p', text: '要删的' });
    const { NotesTab } = await freshFixture([a]);
    const wrapper = mount(NotesTab);
    await flushPromises();
    await wait(50);

    const del = wrapper.findAll('button').find((b) => b.attributes('aria-label') === '删除');
    expect(del, '删除按钮应存在').toBeDefined();
    await del!.trigger('click');
    await flushPromises();

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(await storedNotes()).toEqual([]);
  });

  it('active tab URL 变化 → 本页列表跟随', async () => {
    const tabId = await seedActiveTab('https://a.com/p');
    const a = note({ id: 'a', url: 'https://a.com/p', text: '本页的' });
    const b = note({ id: 'b', url: 'https://b.com/q', text: '另一页的' });
    const { NotesTab } = await freshFixture([a, b]);
    const wrapper = mount(NotesTab);
    await flushPromises();
    await wait(50);
    expect(textareas(wrapper).map((t) => (t.element as HTMLTextAreaElement).value)).toEqual(['本页的']);

    await fakeBrowser.tabs.update(tabId, { url: 'https://b.com/q' });
    await flushPromises();
    await wait(50);

    expect(textareas(wrapper).map((t) => (t.element as HTMLTextAreaElement).value)).toEqual(['另一页的']);
  });

  it('hash 差异同页:查询命中同一条(归一化是 store 职责)', async () => {
    await seedActiveTab('https://a.com/p#x');
    const a = note({ id: 'a', url: 'https://a.com/p', text: '锚点页' });
    const { NotesTab } = await freshFixture([a]);
    const wrapper = mount(NotesTab);
    await flushPromises();
    await wait(50);

    expect(textareas(wrapper).map((t) => (t.element as HTMLTextAreaElement).value)).toEqual(['锚点页']);
  });
});
