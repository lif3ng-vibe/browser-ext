// src/features/custom-styles/openManagerPanel.ts
import { browser } from 'wxt/browser';
import type { WxtBrowser } from 'wxt/browser';
import { storage } from 'wxt/utils/storage';

/** 面板存活心跳:Chromium 的 sidePanel 无查询 API,由面板页面自报(挂载置 true,pagehide 置 false) */
export const panelAliveItem = storage.defineItem<boolean>('session:customStyles/panelOpen', {
  fallback: false,
});

/** 侧边栏页面(ManagerPanel)setup 时调用一次:登记存活并在卸载时注销 */
export function trackPanelAlive(): void {
  void panelAliveItem.setValue(true);
  window.addEventListener('pagehide', () => {
    panelAliveItem.setValue(false).catch(() => {
      /* 浏览器整体关闭时写不进去,无妨 */
    });
  });
}

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

/** 侧边栏是否打开:Firefox 用平台查询;Chromium 读面板自报的心跳(session storage,浏览器重启自动清) */
export async function isManagerPanelOpen(): Promise<boolean | null> {
  const b = browser as Partial<WxtBrowser> & {
    sidebarAction?: { isOpen?: (o: { windowId?: number }) => Promise<boolean> };
  };
  try {
    if (b.sidebarAction?.isOpen) {
      const win = await browser.windows.getCurrent();
      return await b.sidebarAction.isOpen({ windowId: win.id! });
    }
    return await panelAliveItem.getValue();
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