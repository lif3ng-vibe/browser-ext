// src/features/custom-styles/__tests__/openManagerPanel.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  closeManagerPanel,
  isManagerPanelOpen,
  openManagerPanel,
  trackPanelAlive,
} from '../openManagerPanel';
import { panelAliveItem } from '../panelAlive';
import { fakeBrowser } from 'wxt/testing/fake-browser';

describe('openManagerPanel(Firefox sidebarAction 路径)', () => {
  // 还原式 stub:测后恢复,不再裸改全局浏览器对象(跨测试污染)
  const sidebarAction = { open: vi.fn(), isOpen: vi.fn(), close: vi.fn() };
  const stub = fakeBrowser as unknown as Record<string, unknown>;
  const realSidebarAction = stub.sidebarAction;
  const realSidePanel = stub.sidePanel;
  const realWindows = stub.windows;

  afterEach(() => {
    vi.restoreAllMocks();
    stub.sidebarAction = realSidebarAction;
    stub.sidePanel = realSidePanel;
    stub.windows = realWindows;
  });

  /** Firefox 环境:无 sidePanel,仅 sidebarAction */
  function asFirefox() {
    stub.sidePanel = undefined;
    stub.sidebarAction = sidebarAction;
    stub.windows = { getCurrent: vi.fn().mockResolvedValue({ id: 42 }) };
  }

  it('open:sidebarAction.open 成功 → true', async () => {
    asFirefox();
    sidebarAction.open.mockResolvedValue(undefined);

    await expect(openManagerPanel()).resolves.toBe(true);
    expect(sidebarAction.open).toHaveBeenCalled();
  });

  it('open:sidebarAction.open 抛错 → false', async () => {
    asFirefox();
    sidebarAction.open.mockRejectedValue(new Error('no gesture'));

    await expect(openManagerPanel()).resolves.toBe(false);
  });

  it('isOpen:sidebarAction.isOpen 有查询 → 返回平台值', async () => {
    asFirefox();
    sidebarAction.isOpen.mockResolvedValue(true);

    await expect(isManagerPanelOpen()).resolves.toBe(true);
  });

  it('close:sidebarAction.close 存在 → 收起并返回 true', async () => {
    asFirefox();
    sidebarAction.close.mockResolvedValue(undefined);

    await expect(closeManagerPanel()).resolves.toBe(true);
  });

  it('close:sidebarAction 无 close 方法(仅 Firefox open/isOpen)→ false', async () => {
    stub.sidePanel = undefined;
    stub.sidebarAction = { open: vi.fn(), isOpen: vi.fn() };
    stub.windows = { getCurrent: vi.fn().mockResolvedValue({ id: 42 }) };

    await expect(closeManagerPanel()).resolves.toBe(false);
  });
});

describe('openManagerPanel(Chromium 心跳路径,经 fakeBrowser session storage)', () => {
  const stub = fakeBrowser as unknown as Record<string, unknown>;

  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('isOpen:无 sidebarAction → 读心跳(未登记 → false)', async () => {
    await expect(isManagerPanelOpen()).resolves.toBe(false);
  });

  it('trackPanelAlive:登记存活,pagehide 后心跳落 false', async () => {
    trackPanelAlive();
    await vi.waitFor(() => expect(panelAliveItem.getValue()).resolves.toBe(true));

    window.dispatchEvent(new Event('pagehide'));
    await vi.waitFor(() => expect(panelAliveItem.getValue()).resolves.toBe(false));
  });

  it('open:无 sidePanel 且无 sidebarAction → false,心跳不被写(单一写入者)', async () => {
    stub.sidePanel = undefined;
    stub.sidebarAction = undefined;

    await expect(openManagerPanel()).resolves.toBe(false);
    // 关键不变式:open 失败不产生任何心跳写入 —— 唯一写入者是 trackPanelAlive
    await expect(panelAliveItem.getValue()).resolves.toBe(false);
  });
});
