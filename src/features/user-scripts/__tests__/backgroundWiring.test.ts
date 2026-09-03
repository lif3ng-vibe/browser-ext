// src/features/user-scripts/__tests__/backgroundWiring.test.ts
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * background 接线测试:setupRegistrySync() 是纯布线(事件订阅 + 全量重建),
 * 依赖注入 events(onInstalled / onMessage)+ readScripts,验证三条触发路径。
 */
import { setupRegistrySync } from '../backgroundWiring';
import type { UserScript } from '../types';

function script(over: Partial<UserScript>): UserScript {
  return {
    id: 'x',
    name: 'n',
    enabled: true,
    patterns: ['<all_urls>'],
    code: 'x()',
    runAt: 'document_idle',
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

function fakeEvents() {
  const listeners = {
    installed: new Set<(d: { reason: string }) => void>(),
    message: new Set<(raw: unknown) => void>(),
  };
  return {
    onInstalled: {
      addListener: (fn: (d: { reason: string }) => void) => void listeners.installed.add(fn),
    },
    onMessage: {
      addListener: (fn: (raw: unknown) => void) => void listeners.message.add(fn),
    },
    fireInstalled: (reason: string) => listeners.installed.forEach((fn) => fn({ reason })),
    fireMessage: (raw: unknown) => listeners.message.forEach((fn) => fn(raw)),
  };
}

describe('backgroundWiring(注册表同步布线)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('挂载即重建一次(service worker 冷启动即全量重注册)', async () => {
    const sync = vi.fn().mockResolvedValue(undefined);
    setupRegistrySync({
      events: fakeEvents(),
      readScripts: async () => [script({ id: 'a' })],
      sync,
    });
    await vi.waitFor(() => expect(sync).toHaveBeenCalledTimes(1));
    expect(sync).toHaveBeenCalledWith([script({ id: 'a' })]);
  });

  it('onInstalled(任意 reason)→ 重建(扩展更新清注册表,官方要求 onInstalled 补注册)', async () => {
    const events = fakeEvents();
    const sync = vi.fn().mockResolvedValue(undefined);
    setupRegistrySync({ events, readScripts: async () => [], sync });
    await vi.waitFor(() => expect(sync).toHaveBeenCalledTimes(1));

    events.fireInstalled('update');
    await vi.waitFor(() => expect(sync).toHaveBeenCalledTimes(2));
  });

  it('storage 变更(保存/启停/重排)→ 重建', async () => {
    const events = fakeEvents();
    const sync = vi.fn().mockResolvedValue(undefined);
    const seed = [script({ id: 'a' })];
    let current = seed;
    setupRegistrySync({ events, readScripts: async () => current, sync });
    await vi.waitFor(() => expect(sync).toHaveBeenCalledTimes(1));

    // storage.watch 由 defineItem 真实现驱动:直接写 fakeBrowser storage
    current = [...seed, script({ id: 'b' })];
    await fakeBrowser.storage.local.set({ userScripts: current });
    await vi.waitFor(() => expect(sync).toHaveBeenCalledTimes(2));
    expect(sync).toHaveBeenLastCalledWith(current);
  });

  it('resync 消息(门禁开通后 options 发来)→ 重建;其他消息忽略', async () => {
    const events = fakeEvents();
    const sync = vi.fn().mockResolvedValue(undefined);
    setupRegistrySync({ events, readScripts: async () => [], sync });
    await vi.waitFor(() => expect(sync).toHaveBeenCalledTimes(1));

    events.fireMessage({ type: '别的消息' });
    await new Promise((r) => setTimeout(r, 10));
    expect(sync).toHaveBeenCalledTimes(1);

    events.fireMessage({ type: 'userScripts:resync' });
    await vi.waitFor(() => expect(sync).toHaveBeenCalledTimes(2));
  });

  it('sync 失败(门禁未开 API 抛错)不炸布线,下次触发照常', async () => {
    const events = fakeEvents();
    let failing = true;
    // 失败/成功用闭包开关切换(避免 mockResolvedValue 与 never 类型的摩擦)
    const sync = vi.fn(async () => {
      if (failing) throw new Error('API 门禁未开');
    });
    setupRegistrySync({ events, readScripts: async () => [], sync });
    await new Promise((r) => setTimeout(r, 20));

    failing = false;
    events.fireMessage({ type: 'userScripts:resync' });
    await vi.waitFor(() => expect(sync).toHaveBeenCalledTimes(2));
  });
});
