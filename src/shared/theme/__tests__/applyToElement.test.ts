// src/shared/theme/__tests__/applyToElement.test.ts
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** content UI 主题应用缝:目标元素吃解析值(data-theme + .dark),storage/系统变化实时跟随 */
async function freshModule() {
  vi.resetModules();
  return import('../applyToElement');
}

function target(): HTMLElement {
  const el = document.createElement('div');
  document.body.append(el);
  return el;
}

describe('applyThemeToElementTracked(shadow UI 主题应用)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
    document.body.innerHTML = '';
    // jsdom 无 matchMedia:桩成系统恒亮(带 addEventListener 空实现)
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
  });

  it('按 storage 的主题选择 + 跟随系统解析并应用:data-theme 与 .dark 都落目标元素', async () => {
    await fakeBrowser.storage.local.set({ 'lif3ng/theme': 'vercel-light', 'lif3ng/followSystem': false });
    const { applyThemeToElementTracked } = await freshModule();
    const el = target();

    const stop = applyThemeToElementTracked(el);
    await vi.waitFor(() => expect(el.dataset.theme).toBe('vercel-light'));
    expect(el.classList.contains('dark')).toBe(false);
    stop();
  });

  it('跟随系统开 + 暗系主题对:按系统明暗取配对主题', async () => {
    await fakeBrowser.storage.local.set({ 'lif3ng/theme': 'vercel-dark', 'lif3ng/followSystem': true });
    // jsdom prefers-color-scheme 默认 light → 解析到亮侧
    const { applyThemeToElementTracked } = await freshModule();
    const el = target();

    const stop = applyThemeToElementTracked(el);
    await vi.waitFor(() => expect(el.dataset.theme).toBe('vercel-light'));
    stop();
  });

  it('storage 变化实时跟随:换主题后目标元素重应用', async () => {
    const { applyThemeToElementTracked } = await freshModule();
    const el = target();

    const stop = applyThemeToElementTracked(el);
    await vi.waitFor(() => expect(el.dataset.theme).toBe('light'));

    await fakeBrowser.storage.local.set({ 'lif3ng/theme': 'dark', 'lif3ng/followSystem': false });
    await vi.waitFor(() => expect(el.dataset.theme).toBe('dark'));
    expect(el.classList.contains('dark')).toBe(true);
    stop();
  });

  it('停止跟随:storage 再变不再应用', async () => {
    const { applyThemeToElementTracked } = await freshModule();
    const el = target();

    const stop = applyThemeToElementTracked(el);
    await vi.waitFor(() => expect(el.dataset.theme).toBe('light'));
    stop();

    await fakeBrowser.storage.local.set({ 'lif3ng/theme': 'dark', 'lif3ng/followSystem': false });
    await new Promise((r) => setTimeout(r, 50));
    expect(el.dataset.theme).toBe('light');
  });
});