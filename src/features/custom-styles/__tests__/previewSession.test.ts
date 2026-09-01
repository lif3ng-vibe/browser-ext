// src/features/custom-styles/__tests__/previewSession.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';
import {
  isPreviewMessage,
  onPreviewMessage,
  usePreviewSession,
} from '../previewSession';
import { PREVIEW_MSG } from '../messages';

/**
 * fake transport:记录调用序列的内存实现。
 * fakeBrowser 不模拟 tabs.sendMessage(抛 MockNotImplementedError),
 * 因此 previewSession 对 transport 依赖注入,两个 adapter:prod 真 browser / 测试此 fake。
 */
function fakeTransport() {
  const calls: Array<{ to: number; what: string; css?: string }> = [];
  return {
    calls,
    /** 模拟 sendMessage 抛错(如受保护页面无 content script) */
    failing: false,
    async send(to: number, what: 'preview' | 'clear', css?: string) {
      if (this.failing) throw new Error('no content script');
      calls.push({ to, what, css });
    },
  };
}

/** 挂载租约并返回操作句柄;activeTab 是 useActiveTab 的同形 ref */
function mountLease(getDraft: () => string | undefined = () => 'p{}') {
  const activeTab = ref<{ id?: number; url?: string } | undefined>({ id: 1, url: 'https://x.com/' });
  const transport = fakeTransport();
  const session = usePreviewSession(activeTab, getDraft, transport);
  return { activeTab, transport, session };
}

describe('isPreviewMessage(接收端 type guard)', () => {
  it('PREVIEW:合法形态通过,css 为 string', () => {
    expect(isPreviewMessage({ type: PREVIEW_MSG.PREVIEW, css: 'a{}' })).toBe(true);
  });

  it('CLEAR:合法形态通过', () => {
    expect(isPreviewMessage({ type: PREVIEW_MSG.CLEAR })).toBe(true);
  });

  it('拒收:非对象 / 未知 type / PREVIEW 缺 css / css 非字符串', () => {
    expect(isPreviewMessage(undefined)).toBe(false);
    expect(isPreviewMessage(null)).toBe(false);
    expect(isPreviewMessage('customStyles:preview')).toBe(false);
    expect(isPreviewMessage({ type: 'other:msg' })).toBe(false);
    expect(isPreviewMessage({ type: PREVIEW_MSG.PREVIEW })).toBe(false);
    expect(isPreviewMessage({ type: PREVIEW_MSG.PREVIEW, css: 42 })).toBe(false);
  });
});

describe('onPreviewMessage(接收端 dispatch)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('PREVIEW → handler 收到 css;CLEAR → handler 收到 undefined', () => {
    const onPreview = vi.fn();
    const listener = onPreviewMessage(onPreview);

    listener({ type: PREVIEW_MSG.PREVIEW, css: 'p{}' }, { tabId: 7 } as never);
    expect(onPreview).toHaveBeenCalledWith('p{}');

    listener({ type: PREVIEW_MSG.CLEAR }, { tabId: 7 } as never);
    expect(onPreview).toHaveBeenLastCalledWith(undefined);
  });

  it('非法消息静默丢弃,handler 不被调', () => {
    const onPreview = vi.fn();
    const listener = onPreviewMessage(onPreview);

    listener('garbage' as never, { tabId: 7 } as never);
    listener(undefined as never, { tabId: 7 } as never);
    expect(onPreview).not.toHaveBeenCalled();
  });
});

describe('usePreviewSession(租约纪律,fake transport)', () => {
  it('renew:草稿 + 可预览页 → 发 PREVIEW', async () => {
    const { transport, session } = mountLease(() => 'p{}');
    await session.renew();
    expect(transport.calls).toEqual([{ to: 1, what: 'preview', css: 'p{}' }]);
  });

  it('门控:非 http/https 页不发', async () => {
    const { activeTab, transport, session } = mountLease(() => 'p{}');
    activeTab.value = { id: 1, url: 'chrome://extensions/' };
    await session.renew();
    expect(transport.calls).toEqual([]);
  });

  it('门控:tab 无 id 不发', async () => {
    const { activeTab, transport, session } = mountLease(() => 'p{}');
    activeTab.value = { url: 'https://x.com/' };
    await session.renew();
    expect(transport.calls).toEqual([]);
  });

  it('空草稿不发 PREVIEW', async () => {
    const { transport, session } = mountLease(() => undefined);
    await session.renew();
    expect(transport.calls).toEqual([]);
  });

  it('切 tab:旧 tab 收 CLEAR,新 tab 续传 PREVIEW', async () => {
    const { activeTab, transport, session } = mountLease(() => 'p{}');
    await session.renew();

    activeTab.value = { id: 2, url: 'https://y.com/' };
    await nextTick();
    await session.renew();

    expect(transport.calls).toEqual([
      { to: 1, what: 'preview', css: 'p{}' },
      { to: 1, what: 'clear' },
      { to: 2, what: 'preview', css: 'p{}' },
    ]);
  });

  it('草稿清空:旧 tab 收 CLEAR', async () => {
    let draft: string | undefined = 'p{}';
    const { transport, session } = mountLease(() => draft);
    await session.renew();

    draft = undefined;
    await session.renew();

    expect(transport.calls).toEqual([
      { to: 1, what: 'preview', css: 'p{}' },
      { to: 1, what: 'clear' },
    ]);
  });

  it('同 tab 同 css 不重发(去重)', async () => {
    const { transport, session } = mountLease(() => 'p{}');
    await session.renew();
    await session.renew();
    expect(transport.calls).toEqual([{ to: 1, what: 'preview', css: 'p{}' }]);
  });

  it('释放:当前 tab 收 CLEAR,之后 renew 被忽略(会话已结束)', async () => {
    const { transport, session } = mountLease(() => 'p{}');
    await session.renew();
    await session.release();

    expect(transport.calls).toEqual([
      { to: 1, what: 'preview', css: 'p{}' },
      { to: 1, what: 'clear' },
    ]);

    await session.renew();
    expect(transport.calls).toHaveLength(2);
  });

  it('释放:从未 renew 过也安全(幂等)', async () => {
    const { transport, session } = mountLease();
    await session.release();
    expect(transport.calls).toEqual([]);
  });

  it('transport 抛错被吞:纪律照常推进(tab 记忆仍建立,旧 tab 仍收 CLEAR)', async () => {
    const { activeTab, transport, session } = mountLease(() => 'p{}');
    transport.failing = true;

    await session.renew(); // PREVIEW 抛错,但 tab 记忆仍应建立
    transport.failing = false;

    activeTab.value = { id: 2, url: 'https://y.com/' };
    await nextTick();
    await session.renew(); // 旧 tab(1)也该收到 CLEAR

    expect(transport.calls.map((c) => `${c.to}:${c.what}`)).toEqual(['1:clear', '2:preview']);
  });
});
