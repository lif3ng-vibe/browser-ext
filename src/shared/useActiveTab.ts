// src/shared/useActiveTab.ts
import { ref, type Ref } from 'vue';
import type { Browser } from 'wxt/browser';

/** 侧边栏/面板类页面跟踪所在窗口的活动标签页(激活/URL 变化/关闭都重查)。
 *  custom-styles 先例下沉:多个 Feature 的面板视图都要按活动标签页过滤。 */
export function useActiveTab(): Ref<Browser.tabs.Tab | undefined> {
  const tab = ref<Browser.tabs.Tab>();
  const sync = async () => {
    const [active] = await browser.tabs.query({ active: true, currentWindow: true });
    tab.value = active;
  };
  void sync();
  browser.tabs.onActivated.addListener(() => void sync());
  browser.tabs.onUpdated.addListener(() => void sync());
  return tab;
}