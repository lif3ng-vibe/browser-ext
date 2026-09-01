// src/features/custom-styles/openManagerPanel.ts
import { browser } from 'wxt/browser';
import { panelAliveItem, trackPanelAlive } from './panelAlive';

export { trackPanelAlive };

/**
 * Firefox sidebarAction 不在 WxtBrowser 类型上(chrome 类型无此 API)。
 * adapter 视图类型一处声明,三个函数共用(评审候选 2:窄化 3 份 → 1 份)。
 */
interface SidebarAction {
  open(): Promise<void>;
  isOpen?(o: { windowId?: number }): Promise<boolean>;
  close?(o: { windowId?: number }): Promise<void>;
}
const sidebarActionOf = (): SidebarAction | undefined =>
  (browser as Partial<{ sidebarAction?: SidebarAction }>).sidebarAction;

const currentWindowId = async (): Promise<number> => {
  const win = await browser.windows.getCurrent();
  return win.id!;
};

/** 以用户手势上下文打开侧边栏;打不开返回 false,由调用方提示手动打开 */
export async function openManagerPanel(): Promise<boolean> {
  try {
    if (browser.sidePanel) {
      const windowId = await currentWindowId();
      await browser.sidePanel.open({ windowId });
      return true;
    }
    const sidebarAction = sidebarActionOf();
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
  try {
    const sidebarAction = sidebarActionOf();
    if (sidebarAction?.isOpen) {
      return await sidebarAction.isOpen({ windowId: await currentWindowId() });
    }
    return await panelAliveItem.getValue();
  } catch {
    /* fallthrough */
  }
  return null;
}

/** 收起侧边栏;API 不支持(如 Chromium 的 sidePanel 无 close)→ false */
export async function closeManagerPanel(): Promise<boolean> {
  try {
    const sidebarAction = sidebarActionOf();
    if (sidebarAction?.close) {
      await sidebarAction.close({ windowId: await currentWindowId() });
      return true;
    }
  } catch {
    /* fallthrough */
  }
  return false;
}
