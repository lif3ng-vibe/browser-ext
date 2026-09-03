// src/features/user-scripts/backgroundWiring.ts
import { browser } from 'wxt/browser';
import { storage } from 'wxt/utils/storage';
import { readScripts } from './store';
import { syncRegistry } from './registry';
import { isResyncMessage } from './messages';

/** storage watch:background 只读 storage 不动 Vue ref,直接 defineItem(同 key) */
const userScriptsItem = storage.defineItem('local:userScripts');

/**
 * 注册表同步布线(#13 规格「storage 唯一事实源 + 启动全量重建」)。
 *
 * 三条触发路径,全部收敛到「读 storage → 全量重建」:
 * 1. 挂载即重建(service worker 冷启动;persistAcrossSessions 不可依赖)
 * 2. runtime.onInstalled(扩展更新会清空注册表,官方文档要求在此补注册)
 * 3. storage 变更(任一端保存/启停/重排 → 注册表即时跟随)+ resync 消息
 *    (options 门禁开通后手动触发——API 门禁未开期间 syncRegistry 静默跳过,
 *    开通时机浏览器不通知,由 UI 发消息补一次)
 *
 * sync 失败不炸布线(API 门禁未开会抛错):等下一次触发。
 * events 依赖注入:测试喂 fake,prod 用 browser.runtime。
 */
interface WiringEvents {
  onInstalled: { addListener(fn: () => void): void };
  onMessage: { addListener(fn: (raw: unknown) => void): void };
}

export function setupRegistrySync(deps?: {
  events?: WiringEvents;
  readScripts?: typeof readScripts;
  sync?: typeof syncRegistry;
}): void {
  const events = deps?.events ?? browser.runtime;
  const read = deps?.readScripts ?? readScripts;
  const sync = deps?.sync ?? syncRegistry;

  // sync 失败不炸布线(门禁未开会抛错):console 留痕(spec:v1 无错误反馈通道,console 即 debug 台),等下一次触发
  const rebuild = () =>
    read()
      .then(sync)
      .catch((e) => console.warn('[user-scripts] 注册表重建失败:', e));
  void rebuild(); // 冷启动即重建
  events.onInstalled.addListener(() => void rebuild());
  events.onMessage.addListener((raw) => {
    if (isResyncMessage(raw)) void rebuild();
  });
  void userScriptsItem.watch(() => void rebuild());
}
