import { describe, it, expect, beforeAll, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import App from '../App.vue';

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

describe('popup App', () => {
  it('渲染标题与主题快切,齿轮可打开设置', async () => {
    const openOptionsPage = vi.fn().mockResolvedValue(undefined);
    (globalThis as Record<string, unknown>).browser = { runtime: { openOptionsPage } };

    const wrapper = mount(App);
    await flushPromises();

    expect(wrapper.find('h1').text()).toBe('browser-ext');
    expect(wrapper.find('[aria-label="打开设置"]').exists()).toBe(true);
    // ThemeQuickSwitch 四主题色块都渲染
    const swatches = wrapper.findAll('button[aria-pressed]');
    expect(swatches.length).toBe(4);
  });
});