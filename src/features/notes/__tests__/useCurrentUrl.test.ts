// src/features/notes/__tests__/useCurrentUrl.test.ts
import { describe, expect, it, vi } from 'vitest';
import { useCurrentUrl } from '../useCurrentUrl';

/** SPA 跟随来源(规格 #21):history API 补丁 + popstate/hashchange → currentUrl ref */
describe('useCurrentUrl(SPA 跟随来源)', () => {
  it('pushState/replaceState 更新 currentUrl', () => {
    const url = useCurrentUrl();
    const before = url.value;

    history.pushState(null, '', '/next?tab=1');
    expect(url.value).toBe(location.origin + '/next?tab=1');

    history.replaceState(null, '', '/replaced');
    expect(url.value).toBe(location.origin + '/replaced');

    history.replaceState(null, '', before);
  });

  it('popstate 更新 currentUrl', () => {
    const url = useCurrentUrl();
    const before = url.value;

    history.pushState(null, '', '/page-a');
    history.pushState(null, '', '/page-b');
    history.back();
    // back 是异步生效:等一拍再断言
    return new Promise<void>((resolve) => {
      window.addEventListener('popstate', () => {
        expect(url.value).toBe(location.origin + '/page-a');
        history.replaceState(null, '', before);
        resolve();
      }, { once: true });
    });
  });

  it('hash 变化不丢:currentUrl 跟随(归一化交给 store)', async () => {
    const url = useCurrentUrl();
    const before = url.value;

    location.hash = '#sec';
    await vi.waitFor(() => expect(url.value).toBe(location.origin + '/#sec'));

    history.replaceState(null, '', before);
    url.value = before; // 单例 ref 复位,防串测试
  });

  it('页面世界的 pushState(隔离世界补丁打不到)→ 轮询兜底跟上(#27 验收抓出)', async () => {
    // 先装一次补丁,再在 fresh 模块 install 前抓走当前 pushState 引用:此后调它 =
    // 模拟「页面世界的 pushState」——新模块的事件源(pushState 包装/popstate)全触不到
    const { useCurrentUrl: warmup } = await import('../useCurrentUrl');
    warmup();
    vi.resetModules();
    const pageWorldPush = history.pushState.bind(history); // 老包装:对新模块即页面世界
    const { useCurrentUrl: freshUseCurrentUrl } = await import('../useCurrentUrl');

    vi.useFakeTimers();
    try {
      const url = freshUseCurrentUrl();
      const before = url.value;

      pageWorldPush(null, '', '/page-world-route'); // 无事件,新模块 ref 不动
      expect(url.value).toBe(before);

      await vi.advanceTimersByTimeAsync(400); // 轮询兜底(300ms 周期)
      expect(url.value).toBe(location.origin + '/page-world-route');

      history.replaceState(null, '', before);
      url.value = before; // 单例 ref 复位,防串测试
    } finally {
      vi.useRealTimers();
    }
  });
});