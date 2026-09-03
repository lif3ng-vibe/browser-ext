// src/entrypoints/sidepanel/__tests__/App.test.ts
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';

// 首个用例要支付一次性模块图编译开销(vi.resetModules 后动态导入两个 Feature 的组件树),
// 默认 5s 在高负载机器上偶发超时;仅本文件放宽到 15s
vi.setConfig({ testTimeout: 15_000 });

// jsdom 没有 matchMedia;useTheme 依赖它(解析 + 系统明暗监听)。
// 裸函数而非 vi.fn():afterEach 的 restoreAllMocks 会清 vi.fn 的实现,
// 多用例文件里第二个用例起 matchMedia 变 undefined(单用例先例文件无此暴露)
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

// 聚合壳与两个 Feature 的 store 共用同一份 fresh 模块注册表(vi.resetModules 后先后 import 即同一实例)
async function freshFixture() {
  vi.resetModules();
  const compMod = await import('../App.vue');
  return { App: compMod.default };
}

function tabButton(wrapper: VueWrapper, label: string) {
  const btn = wrapper.findAll('[role="tab"]').find((b) => b.text() === label);
  expect(btn, `tab「${label}」应存在`).toBeDefined();
  return btn!;
}

/** 样式 tab 的挂载内容(ManagerPanel 标题) */
function stylesContent(wrapper: VueWrapper) {
  return wrapper.find('h1');
}

/** 便签 tab 的挂载内容(NotesTab 标题) */
function notesContent(wrapper: VueWrapper) {
  return wrapper.find('[data-testid="notes-tab-content"]');
}

describe('sidepanel 聚合薄壳(issue #24)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('首开默认「样式」tab:ManagerPanel 可见,便签 tab 内容不占空间', async () => {
    const { App } = await freshFixture();
    const wrapper = mount(App);
    await flushPromises();

    expect(stylesContent(wrapper).text()).toBe('自定义样式');
    expect(tabButton(wrapper, '样式').attributes('aria-selected')).toBe('true');
    expect(tabButton(wrapper, '便签').attributes('aria-selected')).toBe('false');
    // tab 选择尚未落盘(没点过不该写 storage)
    expect((await fakeBrowser.storage.local.get('sidePanelTab')).sidePanelTab).toBeUndefined();
  });

  it('点击「便签」:内容切换 + tab 选择落 storage.local', async () => {
    const { App } = await freshFixture();
    const wrapper = mount(App);
    await flushPromises();

    await tabButton(wrapper, '便签').trigger('click');
    await flushPromises();

    expect(tabButton(wrapper, '便签').attributes('aria-selected')).toBe('true');
    expect(notesContent(wrapper).exists()).toBe(true);
    expect((await fakeBrowser.storage.local.get('sidePanelTab')).sidePanelTab).toBe('notes');
  });

  it('记忆恢复:storage 存 notes → 重开直接落便签 tab', async () => {
    await fakeBrowser.storage.local.set({ sidePanelTab: 'notes' });
    const { App } = await freshFixture();
    const wrapper = mount(App);
    await flushPromises();

    expect(tabButton(wrapper, '便签').attributes('aria-selected')).toBe('true');
    expect(notesContent(wrapper).exists()).toBe(true);
  });

  it('任意 tab 下面板心跳都登记(样式 tab 打开即 alive)', async () => {
    const { App } = await freshFixture();
    mount(App);
    await flushPromises();

    expect(await fakeBrowser.storage.session.get('customStyles/panelOpen')).toEqual({
      'customStyles/panelOpen': true,
    });
  });
});
