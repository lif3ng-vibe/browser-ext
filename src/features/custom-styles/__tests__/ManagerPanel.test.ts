// src/features/custom-styles/__tests__/ManagerPanel.test.ts
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import type { CustomStyle } from '../types';

// 首个用例要支付一次性模块图编译开销(vi.resetModules 后动态导入组件树),
// 默认 5s 在高负载机器上偶发超时;仅本文件放宽到 15s
vi.setConfig({ testTimeout: 15_000 });

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
  let confirmSpy: MockInstance<typeof window.confirm>;

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
    const banner = wrapper.find('[data-testid="confirm-banner"]');
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
