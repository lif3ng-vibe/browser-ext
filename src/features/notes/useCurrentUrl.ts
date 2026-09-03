// src/features/notes/useCurrentUrl.ts
import { ref } from 'vue';

/**
 * SPA 跟随的来源(规格 #21):持有可注入的 currentUrl ref,
 * pushState/replaceState 补丁 + popstate/hashchange + href 轮询兜底更新它;
 * 视图(圆点有无、便签内容)是 currentUrl 的纯派生。
 * 模块级单例 + 防重装标记:补丁只打一次,多处消费共享同一 ref。
 *
 * 隔离世界现实(#27 验收抓出):content script 的 history 补丁只改隔离世界自己的
 * 对象,页面路由器(页面世界的 pushState)无事件可听。location 跨世界共享,
 * 轮询比对是唯一零权限、跨浏览器、不受页面 CSP 制约的捕获面;popstate/hashchange
 * 仍是最快通道,轮询只兜漏网 + 自愈。
 */
const currentUrl = ref(location.href);

const POLL_MS = 300;

let installed = false;

function install() {
  if (installed) return;
  installed = true;

  const sync = () => {
    if (currentUrl.value !== location.href) currentUrl.value = location.href;
  };
  window.addEventListener('popstate', sync);
  window.addEventListener('hashchange', sync);
  setInterval(sync, POLL_MS); // 页面世界 pushState/replaceState 的兜底捕获面

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