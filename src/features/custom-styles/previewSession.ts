// src/features/custom-styles/previewSession.ts
import { watch, type Ref } from 'vue';
import { browser } from 'wxt/browser';
import { PREVIEW_MSG, type PreviewMessage } from './messages';

/** side panel → content script 的传输:prod 用真 browser,测试注入 fake(两个 adapter = 真 seam) */
export interface PreviewTransport {
  send(to: number, what: 'preview' | 'clear', css?: string): Promise<void>;
}

/** 编辑器侧的草稿供给者:返回 undefined 表示无可预览草稿 */
export type DraftProvider = () => string | undefined;

/** http/https 才可预览(file/ftp 可匹配注入但不入预览 —— CONTEXT.md「预览」词条) */
export function isPreviewable(url: string | undefined): boolean {
  return /^https?:/.test(url ?? '');
}

/** 消息校验:手写 type guard,拒绝 as 强转(issue #16 Q6) */
export function isPreviewMessage(raw: unknown): raw is PreviewMessage {
  if (typeof raw !== 'object' || raw === null) return false;
  const msg = raw as Record<string, unknown>;
  if (msg.type === PREVIEW_MSG.PREVIEW) return typeof msg.css === 'string';
  return msg.type === PREVIEW_MSG.CLEAR;
}

/**
 * receiver 侧:校验后把 PREVIEW/CLEAR 翻译为 handler(css | undefined)。
 * 返回 listener,交由 browser.runtime.onMessage.addListener 挂载
 * (sender 形参仅为匹配 onMessage 回调形状,忽略不用)。
 */
export function onPreviewMessage(
  handler: (css: string | undefined) => void,
): (raw: unknown, sender: unknown) => void {
  return (raw: unknown) => {
    if (!isPreviewMessage(raw)) return;
    handler(raw.type === PREVIEW_MSG.PREVIEW ? raw.css : undefined);
  };
}

/** prod adapter:tab 定向 sendMessage */
function realBrowserTransport(): PreviewTransport {
  return {
    async send(to, what, css) {
      const msg: PreviewMessage =
        what === 'preview'
          ? { type: PREVIEW_MSG.PREVIEW, css: css ?? '' }
          : { type: PREVIEW_MSG.CLEAR };
      await browser.tabs.sendMessage(to, msg);
    },
  };
}

/**
 * 预览会话(CONTEXT.md「预览会话」词条):一次编辑期间预览的生命周期归属,租约式。
 *
 * 纪律全部在 implementation,调用方无法泄漏:
 * - renew():草稿且当前页可预览 → 发 PREVIEW;tab 已切换则旧 tab 先收 CLEAR
 * - release():当前 tab 收 CLEAR,会话结束;之后 renew 被忽略;幂等
 * - 目标页不可预览 / 无 id / 草稿为空 → 收走旧预览,不发新
 * - transport 抛错(受保护页无 content script)被吞,纪律照常推进
 * - 请求经队列串行 + 去重(同 tab 同 css 不重发),并发调用安全
 */
export function usePreviewSession(
  activeTab: Ref<{ id?: number; url?: string } | undefined>,
  getDraft: DraftProvider,
  transport: PreviewTransport = realBrowserTransport(),
) {
  let currentTabId: number | undefined; // 预览当前落在哪个 tab
  let lastSent: { tabId: number; css: string } | undefined;
  let alive = true;
  let queue: Promise<void> = Promise.resolve(); // 串行化并发 renew/release

  const send = async (to: number, what: 'preview' | 'clear', css?: string) => {
    try {
      await transport.send(to, what, css);
    } catch {
      /* 该页没有 content script(如受保护页面),忽略 —— 纪律照常推进 */
    }
  };

  const runRenew = async () => {
    if (!alive) return;
    const tab = activeTab.value;
    const draft = getDraft();
    const tabId = tab?.id;
    if (tabId === undefined || !isPreviewable(tab?.url) || draft === undefined) {
      // 无可预览对象(切到不可预览页 / 清空草稿):收走旧预览
      if (currentTabId !== undefined) {
        await send(currentTabId, 'clear');
        currentTabId = undefined;
        lastSent = undefined;
      }
      return;
    }
    if (currentTabId !== tabId) {
      if (currentTabId !== undefined) await send(currentTabId, 'clear');
      currentTabId = tabId;
      lastSent = undefined;
    }
    if (lastSent?.css !== draft) {
      await send(tabId, 'preview', draft);
      lastSent = { tabId, css: draft };
    }
  };

  const runRelease = async () => {
    const id = currentTabId;
    currentTabId = undefined;
    lastSent = undefined;
    if (id !== undefined) await send(id, 'clear');
  };

  const renew = () => {
    queue = queue.then(runRenew);
    return queue;
  };

  const release = () => {
    alive = false; // 同步置位:排队中的 renew 在执行时即被忽略
    queue = queue.then(runRelease);
    return queue;
  };

  // tab 切换/URL 变化:自动清旧续新 —— 纪律在 implementation,不靠调用方
  watch(activeTab, () => void renew());

  return { renew, release };
}
