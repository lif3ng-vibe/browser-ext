// src/features/custom-styles/openManagerPanel.ts
import { browser } from 'wxt/browser';
import type { WxtBrowser } from 'wxt/browser';

/** 以用户手势上下文打开侧边栏(选项页「编辑」按钮);打不开返回 false,由调用方提示手动打开 */
export async function openManagerPanel(): Promise<boolean> {
  try {
    if (browser.sidePanel) {
      const win = await browser.windows.getCurrent();
      await browser.sidePanel.open({ windowId: win.id! });
      return true;
    }
    // Firefox sidebarAction 不在 WxtBrowser 类型上(chrome 类型无此 API),此处窄化判定
    const sidebarAction = (browser as Partial<WxtBrowser> & {
      sidebarAction?: { open(): Promise<void> };
    }).sidebarAction;
    if (sidebarAction) {
      await sidebarAction.open();
      return true;
    }
  } catch {
    /* 打不开(权限/手势/无侧边栏)→ 调用方提示 */
  }
  return false;
}

/** 侧边栏是否打开;Chromium 无查询 API → null(未知) */
export async function isManagerPanelOpen(): Promise<boolean | null> {
  const b = browser as Partial<WxtBrowser> & {
    sidebarAction?: { isOpen?: (o: { windowId?: number }) => Promise<boolean> };
  };
  try {
    if (b.sidebarAction?.isOpen) {
      const win = await browser.windows.getCurrent();
      return await b.sidebarAction.isOpen({ windowId: win.id! });
    }
  } catch {
    /* fallthrough */
  }
  return null;
}

/** 收起侧边栏;API 不支持(如 Chromium 的 sidePanel 无 close)→ false */
export async function closeManagerPanel(): Promise<boolean> {
  const b = browser as Partial<WxtBrowser> & {
    sidebarAction?: { close?: (o: { windowId?: number }) => Promise<void> };
  };
  try {
    if (b.sidebarAction?.close) {
      const win = await browser.windows.getCurrent();
      await b.sidebarAction.close({ windowId: win.id! });
      return true;
    }
  } catch {
    /* fallthrough */
  }
  return false;
}