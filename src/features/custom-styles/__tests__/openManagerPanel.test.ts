// src/features/custom-styles/__tests__/openManagerPanel.test.ts
import { describe, expect, it, vi } from 'vitest';
import { openManagerPanel } from '../openManagerPanel';
import { browser } from 'wxt/browser';

// 测试桩:wxt 类型不含 Firefox/实验 API 且方法集不全,用索引签名视图直接赋值桩
const stubBrowser = browser as unknown as Record<string, unknown>;

describe('openManagerPanel', () => {
  it('sidePanel.open 成功 → true', async () => {
    const open = vi.fn().mockResolvedValue(undefined);
    stubBrowser.sidePanel = { open };
    stubBrowser.windows = {
      getCurrent: vi.fn().mockResolvedValue({ id: 42 }),
    };
    await expect(openManagerPanel()).resolves.toBe(true);
    expect(open).toHaveBeenCalledWith({ windowId: 42 });
  });

  it('sidePanel.open 抛错 → false', async () => {
    stubBrowser.sidePanel = { open: vi.fn().mockRejectedValue(new Error('no gesture')) };
    stubBrowser.windows = {
      getCurrent: vi.fn().mockResolvedValue({ id: 42 }),
    };
    await expect(openManagerPanel()).resolves.toBe(false);
  });

  it('无 sidePanel 且无 sidebarAction → false', async () => {
    stubBrowser.sidePanel = undefined;
    stubBrowser.sidebarAction = undefined;
    await expect(openManagerPanel()).resolves.toBe(false);
  });
});