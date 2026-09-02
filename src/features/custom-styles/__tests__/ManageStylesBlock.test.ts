// src/features/custom-styles/__tests__/ManageStylesBlock.test.ts
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
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

describe('ManageStylesBlock 导出/导入(issue #14)', () => {
  let alert: MockInstance<typeof window.alert>;
  let confirm: MockInstance<typeof window.confirm>;

  beforeEach(() => {
    fakeBrowser.reset();
    alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
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

  it('导入:解析→摘要 confirm(覆盖 1/新增 1)→合并入 storage', async () => {
    const a = style({ id: 'a', name: '甲' });
    const b = style({ id: 'b', name: '乙' });
    const { ManageStylesBlock } = await freshFixture([a]);

    const wrapper = mount(ManageStylesBlock);
    await flushPromises();
    await chooseFile(wrapper, backupOf([style({ id: 'a', name: '文件甲' }), b]));

    expect(alert).not.toHaveBeenCalled();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0]![0]).toContain('覆盖 1 条');
    expect(confirm.mock.calls[0]![0]).toContain('新增 1 条');

    const stored = (await fakeBrowser.storage.local.get('customStyles')).customStyles as CustomStyle[];
    expect(stored.map((s) => s.id)).toEqual(['a', 'b']);
    expect(stored[0]!.name).toBe('文件甲');
  });

  it('confirm 取消 / 空文件不入 storage', async () => {
    confirm.mockReturnValue(false);
    const a = style({ id: 'a' });
    const { ManageStylesBlock } = await freshFixture([a]);
    const wrapper = mount(ManageStylesBlock);
    await flushPromises();

    await chooseFile(wrapper, backupOf([style({ id: 'n1' })]));
    let stored = (await fakeBrowser.storage.local.get('customStyles')).customStyles as CustomStyle[];
    expect(stored.map((s) => s.id)).toEqual(['a']);

    // 空文件:解析合法但覆盖 0 新增 0 → alert 提示,confirm 不弹,storage 不动
    await chooseFile(wrapper, backupOf([]));
    expect(confirm).toHaveBeenCalledTimes(1); // 仍是上面取消那一次
    expect(alert).toHaveBeenCalledWith('备份文件没有样式,没有可导入的内容。');
    stored = (await fakeBrowser.storage.local.get('customStyles')).customStyles as CustomStyle[];
    expect(stored.map((s) => s.id)).toEqual(['a']);
  });

  it('导入:非法文件 → alert 报第一条错,storage 不动,不弹 confirm', async () => {
    const a = style({ id: 'a' });
    const { ManageStylesBlock } = await freshFixture([a]);
    const wrapper = mount(ManageStylesBlock);
    await flushPromises();

    await chooseFile(wrapper, backupOf([style({ id: 'a' }), style({ id: 'a', name: '重复' })]));

    expect(confirm).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert.mock.calls[0]![0]).toContain('导入失败');
    expect(alert.mock.calls[0]![0]).toContain('id 重复');
    const stored = (await fakeBrowser.storage.local.get('customStyles')).customStyles as CustomStyle[];
    expect(stored.map((s) => s.id)).toEqual(['a']);
  });

  it('导入含编辑中样式:confirm 文案提示编辑会话结束,导入后 editingId 清空', async () => {
    const a = style({ id: 'a' });
    const b = style({ id: 'b' });
    const { store, ManageStylesBlock } = await freshFixture([a, b]);
    const wrapper = mount(ManageStylesBlock);
    await flushPromises();
    await store.setEditing(b.id);

    await chooseFile(wrapper, backupOf([style({ id: 'b', name: '文件乙' })]));

    expect(confirm.mock.calls[0]![0]).toContain('编辑会话将结束');
    await flushPromises();
    expect(store.editingId.value).toBeNull();
  });
});
