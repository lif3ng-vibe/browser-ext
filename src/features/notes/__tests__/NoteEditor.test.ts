// src/features/notes/__tests__/NoteEditor.test.ts
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import type { Note } from '../types';

// 组件与 store 共用同一份 fresh 模块注册表(vi.resetModules 后先后 import 即同一实例)
async function freshFixture(seeded: Note[]) {
  vi.resetModules();
  // 空 seed 不落 key:幽灵「从未持久」的断言依赖 key 缺席
  if (seeded.length > 0) await fakeBrowser.storage.local.set({ notes: seeded });
  const storeMod = await import('../store');
  const compMod = await import('../components/NoteEditor.vue');
  await vi.waitFor(() => expect(storeMod.useNotes().notes.value).toEqual(seeded));
  return { store: storeMod.useNotes(), NoteEditor: compMod.default };
}

function note(over: Partial<Note>): Note {
  return { id: 'x', url: 'https://a.com/p', text: '', createdAt: 1, updatedAt: 1, ...over };
}

/** 防抖(~500ms)远超窗口的真实等待:测试不关心确切时长,只关心终态 */
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function editor(wrapper: VueWrapper) {
  return wrapper.find('textarea');
}

function deleteButton(wrapper: VueWrapper) {
  const btn = wrapper.findAll('button').find((b) => b.attributes('aria-label') === '删除');
  expect(btn, '删除按钮应存在').toBeDefined();
  return btn!;
}

describe('NoteEditor 输入即存(issue #23,组件缝一处测、四处复用)', () => {
  let confirm: MockInstance<typeof window.confirm>;

  beforeEach(() => {
    fakeBrowser.reset();
    confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('既有便签:输入 → 防抖后落 storage,text 替换、updatedAt 刷新', async () => {
    const a = note({ id: 'a', text: '旧文' });
    const { NoteEditor } = await freshFixture([a]);
    const wrapper = mount(NoteEditor, { props: { note: a } });
    await flushPromises();

    await editor(wrapper).setValue('新文');
    await wait(700); // 越过防抖窗口
    await flushPromises();

    const stored = (await fakeBrowser.storage.local.get('notes')).notes as Note[];
    expect(stored).toHaveLength(1);
    expect(stored[0]!.text).toBe('新文');
    expect(stored[0]!.updatedAt).toBeGreaterThan(1);
    expect(stored[0]!.createdAt).toBe(a.createdAt);
  });

  it('防抖窗口内多次击键合并:storage 终态为最后一次输入', async () => {
    const a = note({ id: 'a', text: '' });
    const { NoteEditor } = await freshFixture([a]);
    const wrapper = mount(NoteEditor, { props: { note: a } });
    await flushPromises();

    await editor(wrapper).setValue('第一');
    await wait(150); // 仍在防抖窗口内
    await editor(wrapper).setValue('第一二');
    await wait(150);
    await editor(wrapper).setValue('第一二三');
    await wait(700);
    await flushPromises();

    const stored = (await fakeBrowser.storage.local.get('notes')).notes as Note[];
    expect(stored).toHaveLength(1);
    expect(stored[0]!.text).toBe('第一二三');
  });

  it('未到防抖时长即失焦 → blur 冲刷立即落盘', async () => {
    const a = note({ id: 'a', text: '' });
    const { NoteEditor } = await freshFixture([a]);
    const wrapper = mount(NoteEditor, { props: { note: a } });
    await flushPromises();

    await editor(wrapper).setValue('失焦也要存');
    await editor(wrapper).trigger('blur');
    await flushPromises();

    const stored = (await fakeBrowser.storage.local.get('notes')).notes as Note[];
    expect(stored[0]!.text).toBe('失焦也要存');
  });

  it('幽灵便签:首次输入 → 晋升持久落 storage', async () => {
    const { store, NoteEditor } = await freshFixture([]);
    const ghost = await store.create('https://a.com/p'); // 幽灵:不落盘
    const wrapper = mount(NoteEditor, { props: { note: ghost } });
    await flushPromises();

    await editor(wrapper).setValue('第一句话');
    await wait(700);
    await flushPromises();

    const stored = (await fakeBrowser.storage.local.get('notes')).notes as Note[];
    expect(stored).toHaveLength(1);
    expect(stored[0]!.id).toBe(ghost.id);
    expect(stored[0]!.text).toBe('第一句话');
    expect(stored[0]!.url).toBe('https://a.com/p');
  });

  it('幽灵便签从未输入 → storage 从未出现此 key(随手点开又关掉不留空签)', async () => {
    const { store, NoteEditor } = await freshFixture([]);
    const ghost = await store.create('https://a.com/p');
    const wrapper = mount(NoteEditor, { props: { note: ghost } });
    await flushPromises();

    await editor(wrapper).trigger('blur'); // 未输入直接失焦
    await wait(700);
    await flushPromises();

    expect((await fakeBrowser.storage.local.get('notes')).notes).toBeUndefined();
  });

  it('删除:confirm 确认 → storage 移除该条', async () => {
    const a = note({ id: 'a', text: '要删的' });
    const b = note({ id: 'b', text: '留下的' });
    const { NoteEditor } = await freshFixture([a, b]);
    const wrapper = mount(NoteEditor, { props: { note: a } });
    await flushPromises();

    await deleteButton(wrapper).trigger('click');
    await flushPromises();

    expect(confirm).toHaveBeenCalledTimes(1);
    const stored = (await fakeBrowser.storage.local.get('notes')).notes as Note[];
    expect(stored.map((n) => n.id)).toEqual(['b']);
  });

  it('删除:confirm 取消 → storage 不动', async () => {
    confirm.mockReturnValue(false);
    const a = note({ id: 'a', text: '不删' });
    const { NoteEditor } = await freshFixture([a]);
    const wrapper = mount(NoteEditor, { props: { note: a } });
    await flushPromises();

    await deleteButton(wrapper).trigger('click');
    await flushPromises();

    const stored = (await fakeBrowser.storage.local.get('notes')).notes as Note[];
    expect(stored.map((n) => n.id)).toEqual(['a']);
  });
});