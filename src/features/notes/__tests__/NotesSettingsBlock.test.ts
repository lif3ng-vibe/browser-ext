// src/features/notes/__tests__/NotesSettingsBlock.test.ts
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

// 首个用例支付一次性模块图编译开销(vi.resetModules 后动态导入),放宽同 ManageStylesBlock 先例
vi.setConfig({ testTimeout: 15_000 });

// 组件与 store 共用同一份 fresh 模块注册表(vi.resetModules 后先后 import 即同一实例)
async function freshFixture(expectedEnabled = true) {
  vi.resetModules();
  const storeMod = await import('../store');
  const compMod = await import('../components/NotesSettingsBlock.vue');
  await vi.waitFor(() => expect(storeMod.useNotes().enabled.value).toBe(expectedEnabled));
  return { store: storeMod.useNotes(), NotesSettingsBlock: compMod.default };
}

function checkbox(wrapper: ReturnType<typeof mount>) {
  const el = wrapper.find('[role="checkbox"]');
  expect(el.exists(), '总开关 checkbox 应存在').toBe(true);
  return el;
}

describe('NotesSettingsBlock 便签总开关', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('默认开:checkbox 选中,storage 无显式值(fallback 语义)', async () => {
    const { NotesSettingsBlock } = await freshFixture();
    const wrapper = mount(NotesSettingsBlock);
    await flushPromises();

    expect(checkbox(wrapper).attributes('aria-checked')).toBe('true');
    const stored = await fakeBrowser.storage.local.get('notes:enabled');
    expect(stored['notes:enabled']).toBeUndefined();
  });

  it('关闭:点击 → storage 落 false,ref 即时回填', async () => {
    const { store, NotesSettingsBlock } = await freshFixture();
    const wrapper = mount(NotesSettingsBlock);
    await flushPromises();

    await checkbox(wrapper).trigger('click');
    await flushPromises();

    expect(store.enabled.value).toBe(false);
    expect((await fakeBrowser.storage.local.get('notes:enabled'))['notes:enabled']).toBe(false);
    expect(checkbox(wrapper).attributes('aria-checked')).toBe('false');
  });

  it('已关状态挂载:storage false → checkbox 未选中;再点击 → 恢复 true', async () => {
    await fakeBrowser.storage.local.set({ 'notes:enabled': false });
    const { store, NotesSettingsBlock } = await freshFixture(false);
    const wrapper = mount(NotesSettingsBlock);
    await flushPromises();

    expect(store.enabled.value).toBe(false);
    expect(checkbox(wrapper).attributes('aria-checked')).toBe('false');

    await checkbox(wrapper).trigger('click');
    await flushPromises();

    expect(store.enabled.value).toBe(true);
    expect((await fakeBrowser.storage.local.get('notes:enabled'))['notes:enabled']).toBe(true);
  });

  it('跨上下文:外部直接改 storage → checkbox 跟随(store watch 驱动)', async () => {
    const { NotesSettingsBlock } = await freshFixture();
    const wrapper = mount(NotesSettingsBlock);
    await flushPromises();

    await fakeBrowser.storage.local.set({ 'notes:enabled': false });
    await vi.waitFor(() => expect(checkbox(wrapper).attributes('aria-checked')).toBe('false'));
  });
});
