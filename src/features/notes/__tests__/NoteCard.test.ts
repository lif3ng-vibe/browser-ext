// src/features/notes/__tests__/NoteCard.test.ts
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import type { Note } from '../types';

// 首个用例要支付一次性模块图编译开销(vi.resetModules 后动态导入组件树),
// 默认 5s 在高负载机器上偶发超时;仅本文件放宽到 15s(与 NoteEditor.test.ts 同款先例)
vi.setConfig({ testTimeout: 15_000 });

// 组件与 store 共用同一份 fresh 模块注册表(vi.resetModules 后先后 import 即同一实例)
async function freshFixture(seeded: Note[]) {
  vi.resetModules();
  // 空 seed 不落 key:圆点「无签不出现」的断言依赖 key 缺席
  if (seeded.length > 0) await fakeBrowser.storage.local.set({ notes: seeded });
  const storeMod = await import('../store');
  const compMod = await import('../components/NoteCard.vue');
  await vi.waitFor(() => expect(storeMod.useNotes().notes.value).toEqual(seeded));
  return { store: storeMod.useNotes(), NoteCard: compMod.default };
}

function note(over: Partial<Note>): Note {
  return { id: 'x', url: 'https://a.com/p', text: '', createdAt: 1, updatedAt: 1, ...over };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function dot(wrapper: VueWrapper) {
  return wrapper.find('[data-testid="note-dot"]');
}

function badge(wrapper: VueWrapper) {
  return wrapper.find('[data-testid="note-badge"]');
}

function collapseButton(wrapper: VueWrapper) {
  const btn = wrapper.find('[data-testid="note-collapse"]');
  expect(btn, '收起按钮应存在').toBeDefined();
  return btn!;
}

function card(wrapper: VueWrapper) {
  return wrapper.find('[data-testid="note-card"]');
}

function expandDot(wrapper: VueWrapper) {
  const btn = dot(wrapper);
  expect(btn, '圆点应存在').toBeDefined();
  return btn!;
}

function newButton(wrapper: VueWrapper) {
  const btn = wrapper.findAll('button').find((b) => b.attributes('aria-label') === '新增便签');
  expect(btn, '新增按钮应存在').toBeDefined();
  return btn!;
}

function deleteButton(wrapper: VueWrapper) {
  const btn = wrapper.findAll('button').find((b) => b.attributes('aria-label') === '删除');
  expect(btn, '删除按钮应存在').toBeDefined();
  return btn!;
}

function textareaValues(wrapper: VueWrapper): string[] {
  return wrapper.findAll('textarea').map((t) => (t.element as HTMLTextAreaElement).value);
}

describe('NoteCard 折叠/展开(issue #23)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('本页无便签 → 圆点不出现', async () => {
    const { NoteCard } = await freshFixture([note({ id: 'o', url: 'https://b.com/q', text: '别页的' })]);
    const wrapper = mount(NoteCard, { props: { currentUrl: 'https://a.com/p' } });
    await flushPromises();
    await wait(50);

    expect(dot(wrapper).exists()).toBe(false);
    expect(card(wrapper).exists()).toBe(false);
  });

  it('本页有便签 → 圆点出现,角标为数量;hash 差异算同一页;不混入全局便签', async () => {
    const { NoteCard } = await freshFixture([
      note({ id: 'a', text: '甲' }),
      note({ id: 'b', text: '乙', updatedAt: 2 }),
      note({ id: 'g', url: null, text: '全局', updatedAt: 3 }),
    ]);
    const wrapper = mount(NoteCard, { props: { currentUrl: 'https://a.com/p#anchor' } });
    await flushPromises();
    await wait(50);

    expect(dot(wrapper).exists()).toBe(true);
    expect(badge(wrapper).text()).toBe('2');
  });

  it('点击圆点 → 展开卡片,按 updatedAt 倒序列出便签', async () => {
    const { NoteCard } = await freshFixture([
      note({ id: 'a', text: '先写的' }),
      note({ id: 'b', text: '后改的', updatedAt: 99 }),
    ]);
    const wrapper = mount(NoteCard, { props: { currentUrl: 'https://a.com/p' } });
    await flushPromises();
    await wait(50);

    await expandDot(wrapper).trigger('click');
    await flushPromises();

    expect(card(wrapper).exists()).toBe(true);
    expect(textareaValues(wrapper)).toEqual(['后改的', '先写的']);
  });

  it('点击收起 → 卡片消失,圆点回来', async () => {
    const { NoteCard } = await freshFixture([note({ id: 'a', text: '甲' })]);
    const wrapper = mount(NoteCard, { props: { currentUrl: 'https://a.com/p' } });
    await flushPromises();
    await wait(50);

    await expandDot(wrapper).trigger('click');
    expect(card(wrapper).exists()).toBe(true);
    await collapseButton(wrapper).trigger('click');
    await flushPromises();

    expect(card(wrapper).exists()).toBe(false);
    expect(dot(wrapper).exists()).toBe(true);
  });

  it('卡片内新增:点新增 → 空编辑框就地出现,输入防抖后落 storage(绑定当前页)', async () => {
    const { NoteCard } = await freshFixture([note({ id: 'a', text: '已有' })]);
    const wrapper = mount(NoteCard, { props: { currentUrl: 'https://a.com/p' } });
    await flushPromises();
    await wait(50);

    await expandDot(wrapper).trigger('click');
    await newButton(wrapper).trigger('click');
    await flushPromises();

    expect(textareaValues(wrapper)).toHaveLength(2); // 已有 1 + 新增 1
    const boxes = wrapper.findAll('textarea');
    await boxes[1]!.setValue('新想法');
    await wait(700);
    await flushPromises();

    const stored = (await fakeBrowser.storage.local.get('notes')).notes as Note[];
    expect(stored).toHaveLength(2);
    expect(stored.map((n) => n.text).sort()).toEqual(['已有', '新想法']);
    expect(stored.find((n) => n.text === '新想法')!.url).toBe('https://a.com/p');
  });

  it('卡片内删除:confirm 确认 → storage 移除;删光后圆点消失', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { NoteCard } = await freshFixture([note({ id: 'a', text: '甲' })]);
    const wrapper = mount(NoteCard, { props: { currentUrl: 'https://a.com/p' } });
    await flushPromises();
    await wait(50);

    await expandDot(wrapper).trigger('click');
    await deleteButton(wrapper).trigger('click');
    await flushPromises();

    expect(confirm).toHaveBeenCalledTimes(1);
    const stored = (await fakeBrowser.storage.local.get('notes')).notes as Note[];
    expect(stored).toEqual([]); // 删光:空列表终态
    expect(dot(wrapper).exists()).toBe(false);
  });
});

describe('NoteCard SPA 跟随 + 展开记忆 + 总开关(issue #23)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('pushState 换页:圆点有无与卡片内容跟随新 URL;hash 变化不丢签', async () => {
    const { NoteCard } = await freshFixture([
      note({ id: 'a', url: 'https://a.com/p', text: 'A页的' }),
      note({ id: 'b', url: 'https://a.com/feed', text: 'B页的', updatedAt: 2 }),
    ]);
    const wrapper = mount(NoteCard, { props: { currentUrl: 'https://a.com/p' } });
    await flushPromises();
    await wait(50);

    // hash 变化:同一页,签不丢
    await wrapper.setProps({ currentUrl: 'https://a.com/p#sec' });
    await flushPromises();
    await wait(50);
    expect(dot(wrapper).exists()).toBe(true);
    expect(badge(wrapper).text()).toBe('1');

    // pushState 换页:内容跟随新 URL
    await wrapper.setProps({ currentUrl: 'https://a.com/feed' });
    await flushPromises();
    await wait(50);
    expect(dot(wrapper).exists()).toBe(true);
    expect(badge(wrapper).text()).toBe('1');

    await expandDot(wrapper).trigger('click');
    await flushPromises();
    expect(textareaValues(wrapper)).toEqual(['B页的']);
  });

  it('展开记忆:新页默认收起;返回旧页恢复原展开状态(session 级)', async () => {
    const { NoteCard } = await freshFixture([
      note({ id: 'a', url: 'https://a.com/p', text: 'A页的' }),
      note({ id: 'b', url: 'https://a.com/feed', text: 'B页的', updatedAt: 2 }),
    ]);
    const wrapper = mount(NoteCard, { props: { currentUrl: 'https://a.com/p' } });
    await flushPromises();
    await wait(50);

    await expandDot(wrapper).trigger('click'); // A 页展开
    await wrapper.setProps({ currentUrl: 'https://a.com/feed' }); // 换到 B
    await flushPromises();
    await wait(50);

    // 新页默认收起
    expect(card(wrapper).exists()).toBe(false);
    expect(dot(wrapper).exists()).toBe(true);

    await expandDot(wrapper).trigger('click'); // B 页展开
    await wrapper.setProps({ currentUrl: 'https://a.com/p' }); // 返回 A
    await flushPromises();
    await wait(50);

    // 返回 A 恢复展开,内容是 A 的便签
    expect(card(wrapper).exists()).toBe(true);
    expect(textareaValues(wrapper)).toEqual(['A页的']);

    // 回 B 仍是 B 自己的记忆(展开)
    await wrapper.setProps({ currentUrl: 'https://a.com/feed' });
    await flushPromises();
    await wait(50);
    expect(card(wrapper).exists()).toBe(true);
  });

  it('总开关关闭 → 圆点与卡片都消失;重开恢复', async () => {
    const { NoteCard } = await freshFixture([note({ id: 'a', text: '甲' })]);
    const wrapper = mount(NoteCard, { props: { currentUrl: 'https://a.com/p' } });
    await flushPromises();
    await wait(50);
    expect(dot(wrapper).exists()).toBe(true);

    await fakeBrowser.storage.local.set({ 'notes:enabled': false });
    await wait(50);
    await flushPromises();
    expect(dot(wrapper).exists()).toBe(false);

    await fakeBrowser.storage.local.set({ 'notes:enabled': true });
    await wait(50);
    await flushPromises();
    expect(dot(wrapper).exists()).toBe(true);
  });
});