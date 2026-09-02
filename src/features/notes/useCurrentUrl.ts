// src/features/notes/useCurrentUrl.ts
import { ref } from 'vue';

/**
 * SPA 跟随的来源(规格 #21):持有可注入的 currentUrl ref,
 * pushState/replaceState 补丁 + popstate/hashchange 更新它;
 * 视图(圆点有无、便签内容)是 currentUrl 的纯派生。
 * 模块级单例 + 防重装标记:补丁只打一次,多处消费共享同一 ref。
 */
const currentUrl = ref(location.href);

let installed = false;

function install() {
  if (installed) return;
  installed = true;

  const sync = () => {
    if (currentUrl.value !== location.href) currentUrl.value = location.href;
  };
  window.addEventListener('popstate', sync);
  window.addEventListener('hashchange', sync);

  // history.pushState 是重载,Parameters<> 取不成元组;显式签名
  type HistoryFn = (data: unknown, unused: string, url?: string | URL | null) => void;
  const wrap = (key: 'pushState' | 'replaceState') => {
    const original = history[key].bind(history) as HistoryFn;
    history[key] = (...args: Parameters<HistoryFn>) => {
      original(...args);
      sync();
    };
  };
  wrap('pushState');
  wrap('replaceState');
}

/** 取 SPA 跟随的 URL ref;首次调用安装历史 API 补丁 */
export function useCurrentUrl() {
  install();
  return currentUrl;
}