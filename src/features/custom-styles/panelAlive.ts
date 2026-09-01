// src/features/custom-styles/panelAlive.ts
import { storage } from 'wxt/utils/storage';

/**
 * 面板存活心跳(CONTEXT.md Q1 定稿:单一写入者)。
 * Chromium 的 sidePanel 无查询 API,由面板页面自报:trackPanelAlive 挂载置 true,
 * pagehide 置 false。唯一写入者是 trackPanelAlive —— open/close 不得触碰心跳。
 *
 * 私有 module:不导出给 Feature 外(心跳语义「面板活着」不再被调用方稀释)。
 */
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
