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