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

describe('NotesTab 完全体:本页主视图 + 全局分区 + 空态引导(issue #25)', () => {
  let confirm: MockInstance<typeof window.confirm>;

  beforeEach(() => {
    fakeBrowser.reset();
    confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('空态:此页无便签 → 空态引导 + 「新建页面便签」按钮,新建即绑定当前页 URL', async () => {
    await seedActiveTab('https://a.com/p');
    const { NotesTab } = await freshFixture([]);
    const wrapper = mount(NotesTab);
    await flushPromises();
    await wait(50);

    expect(wrapper.text()).toContain('此页无便签');
    const newBtn = wrapper.findAll('button').find((b) => b.text() === '新建页面便签');
    expect(newBtn, '新建页面便签按钮应存在').toBeDefined();
    await newBtn!.trigger('click');
    await flushPromises();

    expect(textareas(wrapper)).toHaveLength(1); // 幽灵乐观出现
    expect(await storedNotes()).toEqual([]); // 幽灵态:未落盘(text 空着关掉即从未存在)

    await textareas(wrapper)[0]!.setValue('页面便签');
    await wait(700);
    await flushPromises();

    const stored = await storedNotes();
    expect(stored).toHaveLength(1);
    expect(stored[0]!.url).toBe('https://a.com/p');
    expect(stored[0]!.text).toBe('页面便签');
  });

  it('本页有便签时:列表照常展示,不出现空态引导', async () => {
    await seedActiveTab('https://a.com/p');
    const a = note({ id: 'a', url: 'https://a.com/p', text: '已有的' });
    const { NotesTab } = await freshFixture([a]);
    const wrapper = mount(NotesTab);
    await flushPromises();
    await wait(50);

    expect(wrapper.text()).not.toContain('此页无便签');
    expect(textareas(wrapper).map((t) => (t.element as HTMLTextAreaElement).value)).toEqual(['已有的']);
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

    const newBtn = wrapper.findAll('button').find((b) => b.text() === '新建页面便签');
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

  it('切 tab:本页幽灵退役(NoteCard 先例:幽灵只属于创建它的页面),全局分区不受影响', async () => {
    const tabId = await seedActiveTab('https://a.com/p');
    const g = note({ id: 'g', url: null, text: '全局的' });
    const { NotesTab } = await freshFixture([g]);
    const wrapper = mount(NotesTab);
    await flushPromises();
    await wait(50);

    // 本页空态新建一个幽灵(不输入)
    await wrapper.findAll('button').find((b) => b.text() === '新建页面便签')!.trigger('click');
    await flushPromises();
    expect(pageTextareas(wrapper)).toHaveLength(1);

    // 切到无便签的页:幽灵退役 → 空态引导回来;全局分区内容照常
    await fakeBrowser.tabs.update(tabId, { url: 'https://b.com/q' });
    await flushPromises();
    await wait(50);
    expect(pageTextareas(wrapper)).toHaveLength(0);
    expect(wrapper.text()).toContain('此页无便签');

    await globalSectionToggle(wrapper).trigger('click');
    await flushPromises();
    await wait(50);
    expect(globalTextareas(wrapper)).toEqual(['全局的']);
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

  // ---- 全局分区(issue #25 T4):默认收起,展开同览,可增删改 ----

  /** 全局分区头:aria-expanded 标收起/展开态 */
  function globalSectionToggle(wrapper: VueWrapper) {
    const btn = wrapper.findAll('button').find((b) => b.text().includes('全局便签'));
    expect(btn, '全局便签分区头应存在').toBeDefined();
    return btn!;
  }

  /** 本页分区里的编辑框(排除全局分区;靠 data-testid 圈定) */
  function pageTextareas(wrapper: VueWrapper) {
    return wrapper
      .findAll('[data-testid="page-notes"] textarea')
      .map((t) => (t.element as HTMLTextAreaElement).value);
  }

  /** 全局分区里的编辑框 */
  function globalTextareas(wrapper: VueWrapper) {
    return wrapper
      .findAll('[data-testid="global-notes"] textarea')
      .map((t) => (t.element as HTMLTextAreaElement).value);
  }

  it('全局分区默认收起:头部可见,内容不展示;展开后同览全部全局便签', async () => {
    await seedActiveTab('https://a.com/p');
    const page = note({ id: 'p', url: 'https://a.com/p', text: '本页的' });
    const gOld = note({ id: 'g1', url: null, text: '旧全局', updatedAt: 1 });
    const gNew = note({ id: 'g2', url: null, text: '新全局', updatedAt: 2 });
    const { NotesTab } = await freshFixture([page, gOld, gNew]);
    const wrapper = mount(NotesTab);
    await flushPromises();
    await wait(50);

    // 默认收起:全局便签不在 DOM,本页列表只有本页的
    expect(globalSectionToggle(wrapper).attributes('aria-expanded')).toBe('false');
    expect(wrapper.findAll('[data-testid="global-notes"] textarea')).toHaveLength(0);
    expect(pageTextareas(wrapper)).toEqual(['本页的']);

    // 展开:全局便签 updatedAt 倒序同览
    await globalSectionToggle(wrapper).trigger('click');
    await flushPromises();
    await wait(50);
    expect(globalSectionToggle(wrapper).attributes('aria-expanded')).toBe('true');
    expect(globalTextareas(wrapper)).toEqual(['新全局', '旧全局']);
    expect(pageTextareas(wrapper)).toEqual(['本页的']); // 本页分区不受影响
  });

  it('全局分区增删改:新建幽灵 url 为 null,输入晋升落 storage;删除走 confirm', async () => {
    await seedActiveTab('https://a.com/p');
    const existing = note({ id: 'g1', url: null, text: '已有全局' });
    const { NotesTab } = await freshFixture([existing]);
    const wrapper = mount(NotesTab);
    await flushPromises();
    await wait(50);

    await globalSectionToggle(wrapper).trigger('click');
    await flushPromises();
    await wait(50);
    expect(globalTextareas(wrapper)).toEqual(['已有全局']);

    // 改:输入即存(防抖后终态)
    await wrapper.find('[data-testid="global-notes"] textarea').setValue('改过的全局');
    await wait(700);
    await flushPromises();
    let stored = await storedNotes();
    expect(stored.find((n) => n.id === 'g1')!.text).toBe('改过的全局');

    // 增:全局分区新建 → url 为 null 的幽灵
    const addGlobalBtn = wrapper
      .findAll('[data-testid="global-notes"] button')
      .find((b) => b.text() === '新建全局便签');
    expect(addGlobalBtn, '新建全局便签按钮应存在').toBeDefined();
    await addGlobalBtn!.trigger('click');
    await flushPromises();
    const boxes = wrapper.findAll('[data-testid="global-notes"] textarea');
    expect(boxes).toHaveLength(2);
    await boxes[1]!.setValue('第二条全局');
    await wait(700);
    await flushPromises();
    stored = await storedNotes();
    expect(stored.find((n) => n.text === '第二条全局')!.url).toBeNull();

    // 删:confirm 确认 → storage 移除该条(列表首个删除键删掉一条,另一条保留)
    const delBtn = wrapper
      .findAll('[data-testid="global-notes"] button')
      .find((b) => b.attributes('aria-label') === '删除');
    await delBtn!.trigger('click');
    await flushPromises();
    expect(confirm).toHaveBeenCalledTimes(1);
    stored = await storedNotes();
    expect(stored).toHaveLength(1);
  });
});
