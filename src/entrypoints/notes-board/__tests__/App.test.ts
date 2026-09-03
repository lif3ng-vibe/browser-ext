// src/entrypoints/notes-board/__tests__/App.test.ts
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import type { Note } from '@/features/notes/types';

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

// 首个用例要支付一次性模块图编译开销(vi.resetModules 后动态导入组件树),
// 默认 5s 在高负载机器上偶发超时;仅本文件放宽到 15s(挂载测试文件同款先例)
vi.setConfig({ testTimeout: 15_000 });

// 组件与 notes store 共用同一份 fresh 模块注册表(vi.resetModules 后先后 import 即同一实例)
async function freshFixture(seeded: Note[]) {
  vi.resetModules();
  if (seeded.length > 0) await fakeBrowser.storage.local.set({ notes: seeded });
  const storeMod = await import('@/features/notes/store');
  const compMod = await import('../App.vue');
  await vi.waitFor(() => expect(storeMod.useNotes().notes.value).toEqual(seeded));
  return { store: storeMod.useNotes(), Board: compMod.default };
}

function note(over: Partial<Note>): Note {
  return { id: 'x', url: null, text: '', createdAt: 1, updatedAt: 1, ...over };
}

/** 防抖(~500ms)远超窗口的真实等待:测试不关心确切时长,只关心终态 */
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function storedNotes(): Promise<Note[]> {
  return ((await fakeBrowser.storage.local.get('notes')).notes ?? []) as Note[];
}

function newButton(wrapper: VueWrapper) {
  const btn = wrapper.findAll('button').find((b) => b.text() === '新建全局便签');
  expect(btn, '新建全局便签按钮应存在').toBeDefined();
  return btn!;
}

function textareas(wrapper: VueWrapper) {
  return wrapper.findAll('textarea');
}

describe('便签板:全局便签的主场,就地增删改(issue #26,规格 #21 故事 23/25)', () => {
  let confirm: MockInstance<typeof window.confirm>;

  beforeEach(() => {
    fakeBrowser.reset();
    confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('空态:还没有全局便签引导;新建幽灵 → 输入晋升落 storage,url 为 null', async () => {
    const { Board } = await freshFixture([]);
    const wrapper = mount(Board);
    await flushPromises();
    await wait(50);

    expect(wrapper.text()).toContain('还没有全局便签');
    expect(await storedNotes()).toEqual([]);

    await newButton(wrapper).trigger('click');
    await flushPromises();
    expect(textareas(wrapper)).toHaveLength(1); // 幽灵乐观出现
    expect(await storedNotes()).toEqual([]); // 幽灵态未落盘

    await textareas(wrapper)[0]!.setValue('第一个念头');
    await wait(700);
    await flushPromises();

    const stored = await storedNotes();
    expect(stored).toHaveLength(1);
    expect(stored[0]!.text).toBe('第一个念头');
    expect(stored[0]!.url).toBeNull();
  });

  it('列表只含全局便签(updatedAt 倒序),页面便签不出现', async () => {
    const gOld = note({ id: 'g1', url: null, text: '旧全局', updatedAt: 1 });
    const gNew = note({ id: 'g2', url: null, text: '新全局', updatedAt: 2 });
    const page = note({ id: 'p', url: 'https://a.com/p', text: '本页的' });
    const { Board } = await freshFixture([page, gOld, gNew]);
    const wrapper = mount(Board);
    await flushPromises();
    await wait(50);

    expect(
      textareas(wrapper).map((t) => (t.element as HTMLTextAreaElement).value),
    ).toEqual(['新全局', '旧全局']);
    expect(wrapper.text()).not.toContain('本页的');
  });

  it('改:输入即存(防抖后终态),updatedAt 刷新', async () => {
    const g = note({ id: 'g1', url: null, text: '旧文', updatedAt: 1 });
    const { Board } = await freshFixture([g]);
    const wrapper = mount(Board);
    await flushPromises();
    await wait(50);

    await textareas(wrapper)[0]!.setValue('改过的全局');
    await wait(700);
    await flushPromises();

    const stored = await storedNotes();
    expect(stored).toHaveLength(1);
    expect(stored[0]!.text).toBe('改过的全局');
    expect(stored[0]!.updatedAt).toBeGreaterThan(1);
  });

  it('删:confirm 确认 → storage 移除该条', async () => {
    const g1 = note({ id: 'g1', url: null, text: '删我的' });
    const g2 = note({ id: 'g2', url: null, text: '留我的' });
    const { Board } = await freshFixture([g1, g2]);
    const wrapper = mount(Board);
    await flushPromises();
    await wait(50);

    const del = wrapper.findAll('button').find((b) => b.attributes('aria-label') === '删除');
    expect(del, '删除按钮应存在').toBeDefined();
    await del!.trigger('click');
    await flushPromises();

    expect(confirm).toHaveBeenCalledTimes(1);
    const stored = await storedNotes();
    expect(stored).toHaveLength(1);
    expect(stored[0]!.text).toBe('留我的');
  });

  it('幽灵从未输入 → storage 从未出现(随手点开又关掉不留空签)', async () => {
    const { Board } = await freshFixture([]);
    const wrapper = mount(Board);
    await flushPromises();

    await newButton(wrapper).trigger('click');
    await flushPromises();
    await wait(700);
    await flushPromises();

    expect(await storedNotes()).toEqual([]);
  });
});
