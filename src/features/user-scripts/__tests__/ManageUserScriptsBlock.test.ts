// src/features/user-scripts/__tests__/ManageUserScriptsBlock.test.ts
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import type { UserScript } from '../types';

// 首个用例支付一次性模块图编译开销(vi.resetModules 后动态导入组件树)
vi.setConfig({ testTimeout: 15_000 });

async function freshFixture(seeded: UserScript[]) {
  vi.resetModules();
  await fakeBrowser.storage.local.set({ userScripts: seeded });
  const storeMod = await import('../store');
  const compMod = await import('../components/ManageUserScriptsBlock.vue');
  await vi.waitFor(() => expect(storeMod.useUserScripts().scripts.value).toEqual(seeded));
  return {
    store: storeMod.useUserScripts(),
    ManageUserScriptsBlock: compMod.default,
  };
}

function script(over: Partial<UserScript>): UserScript {
  return {
    id: 'x',
    name: 'n',
    enabled: true,
    patterns: ['<all_urls>'],
    code: 'x()',
    runAt: 'document_idle',
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

describe('ManageUserScriptsBlock(管理区块)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('列表渲染:名称/启停/执行时机下拉;新建 → 行内编辑器', async () => {
    const a = script({ id: 'a', name: '去广告' });
    const { store, ManageUserScriptsBlock } = await freshFixture([a]);
    const wrapper = mount(ManageUserScriptsBlock);
    await flushPromises();

    expect(wrapper.text()).toContain('去广告');
    expect(wrapper.find('select').exists()).toBe(true);

    await wrapper.find('button[aria-label="编辑"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="user-script-editor"]').exists()).toBe(true);

    await wrapper.find('button[aria-label="返回清单"]').trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="user-script-editor"]').exists()).toBe(false);

    const createBtn = wrapper.findAll('button').find((b) => b.text() === '新建脚本')!;
    await createBtn.trigger('click');
    await flushPromises();
    expect(wrapper.find('[data-testid="user-script-editor"]').exists()).toBe(true);
    expect(store.scripts.value.length).toBe(2); // 新建追加
  });

  it('编辑器保存:改动落 storage(含 runAt);未保存标记随 dirty', async () => {
    const a = script({ id: 'a', name: '甲', code: 'old()' });
    const { ManageUserScriptsBlock } = await freshFixture([a]);
    const wrapper = mount(ManageUserScriptsBlock);
    await flushPromises();

    await wrapper.find('button[aria-label="编辑"]').trigger('click');
    await flushPromises();
    expect(wrapper.text()).not.toContain('未保存');

    const nameInput = wrapper.find('input[aria-label="脚本名称"]');
    await nameInput.setValue('乙');
    expect(wrapper.text()).toContain('未保存');

    const runAtSelect = wrapper.find('#user-script-runat');
    await runAtSelect.setValue('document_start');

    const save = wrapper.findAll('button').find((b) => b.text() === '保存')!;
    await save.trigger('click');
    await flushPromises();

    const stored = (await fakeBrowser.storage.local.get('userScripts')).userScripts as UserScript[];
    expect(stored[0]!.name).toBe('乙');
    expect(stored[0]!.runAt).toBe('document_start');
    expect(wrapper.text()).not.toContain('未保存');
  });

  it('删除:页内确认条;确认后落 storage,编辑中删除回清单', async () => {
    const a = script({ id: 'a', name: '甲' });
    const { store, ManageUserScriptsBlock } = await freshFixture([a]);
    const wrapper = mount(ManageUserScriptsBlock);
    await flushPromises();
    await store.setEditing(a.id);
    await flushPromises();
    expect(wrapper.find('[data-testid="user-script-editor"]').exists()).toBe(true);

    // 删除入口在清单视图;编辑器里先返回(无改动不弹确认)
    window.confirm = vi.fn().mockReturnValue(true);
    await wrapper.find('button[aria-label="返回清单"]').trigger('click');
    await flushPromises();

    await wrapper.find('button[aria-label="删除"]').trigger('click');
    expect(wrapper.find('[data-testid="confirm-banner"]').text()).toContain('删除「甲」?不可恢复。');
    await wrapper.findAll('button').find((b) => b.text() === '确认删除')!.trigger('click');
    await flushPromises();

    const stored = (await fakeBrowser.storage.local.get('userScripts')).userScripts;
    expect(stored).toEqual([]);
  });

  it('门禁 locked:显示开通指引横幅(Firefox 侧则显示启用按钮)', async () => {
    const stub = fakeBrowser as unknown as Record<string, unknown>;
    stub.userScripts = {
      getScripts: vi.fn().mockRejectedValue(new Error('denied')),
    };
    const { ManageUserScriptsBlock } = await freshFixture([script({ id: 'a' })]);
    const wrapper = mount(ManageUserScriptsBlock);
    await flushPromises();
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="gate-banner"]').exists()).toBe(true),
    );
    expect(wrapper.find('[data-testid="gate-banner"]').text()).toContain('允许用户脚本');
    delete stub.userScripts;
  });

  it('门禁 unavailable:横幅标注不支持,列表可见(jsdom UA 不含 chrome/firefox → 无能力平台)', async () => {
    const stub = fakeBrowser as unknown as Record<string, unknown>;
    const saved = stub.userScripts;
    stub.userScripts = undefined;
    const { ManageUserScriptsBlock } = await freshFixture([script({ id: 'a', name: '甲' })]);
    const wrapper = mount(ManageUserScriptsBlock);
    await flushPromises();
    await vi.waitFor(() =>
      expect(wrapper.find('[data-testid="gate-banner"]').text()).toContain('不支持用户脚本'),
    );
    expect(wrapper.text()).toContain('甲'); // 开通前列表可见但标注未生效
    stub.userScripts = saved;
  });

  it('启停与执行时机从列表直接改:落 storage', async () => {
    const a = script({ id: 'a', name: '甲', enabled: true, runAt: 'document_idle' });
    const { ManageUserScriptsBlock } = await freshFixture([a]);
    const wrapper = mount(ManageUserScriptsBlock);
    await flushPromises();

    const select = wrapper.find('select');
    await select.setValue('document_end');
    await flushPromises();
    const stored = (await fakeBrowser.storage.local.get('userScripts')).userScripts as UserScript[];
    expect(stored[0]!.runAt).toBe('document_end');
  });

  it('坏 pattern 拦截:带端口的裸主机 → 错误提示,保存禁用,storage 不动', async () => {
    const a = script({ id: 'a', name: '甲', patterns: ['*://example.com/*'] });
    const { ManageUserScriptsBlock } = await freshFixture([a]);
    const wrapper = mount(ManageUserScriptsBlock);
    await flushPromises();

    await wrapper.find('button[aria-label="编辑"]').trigger('click');
    await flushPromises();
    await wrapper.find('#user-script-patterns').setValue('127.0.0.1:8080');

    const err = wrapper.find('[data-testid="pattern-error"]');
    expect(err.exists()).toBe(true);
    expect(err.text()).toContain('127.0.0.1:8080');
    const save = wrapper.findAll('button').find((b) => b.text() === '保存')!;
    expect(save.attributes('disabled')).toBeDefined();

    await save.trigger('click');
    await flushPromises();
    const stored = (await fakeBrowser.storage.local.get('userScripts')).userScripts as UserScript[];
    expect(stored[0]!.patterns).toEqual(['*://example.com/*']); // 未被坏值覆盖
  });

  it('无端口 IP pattern(*://127.0.0.1/*)合法可保存——match pattern 无端口语义,匹配任意端口', async () => {
    const a = script({ id: 'a', name: '甲', patterns: [] });
    const { ManageUserScriptsBlock } = await freshFixture([a]);
    const wrapper = mount(ManageUserScriptsBlock);
    await flushPromises();

    await wrapper.find('button[aria-label="编辑"]').trigger('click');
    await flushPromises();
    await wrapper.find('#user-script-patterns').setValue('*://127.0.0.1/*');
    expect(wrapper.find('[data-testid="pattern-error"]').exists()).toBe(false);

    await wrapper.findAll('button').find((b) => b.text() === '保存')!.trigger('click');
    await flushPromises();
    const stored = (await fakeBrowser.storage.local.get('userScripts')).userScripts as UserScript[];
    expect(stored[0]!.patterns).toEqual(['*://127.0.0.1/*']);
  });
});
