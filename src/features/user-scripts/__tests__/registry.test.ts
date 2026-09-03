// src/features/user-scripts/__tests__/registry.test.ts
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserScript } from '../types';
import { deriveRegistrations, syncRegistry } from '../registry';

function script(over: Partial<UserScript>): UserScript {
  return {
    id: 'x',
    name: 'n',
    enabled: true,
    patterns: ['<all_urls>'],
    code: 'console.log(1)',
    runAt: 'document_idle',
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

describe('deriveRegistrations(storage → 注册项派生)', () => {
  it('启用 + 有 code + 有 patterns → 注册项:id/matches/js.code/runAt/world=MAIN', () => {
    const regs = deriveRegistrations([
      script({ id: 'a', patterns: ['*://github.com/*'], code: 'x()', runAt: 'document_start' }),
    ]);
    expect(regs).toEqual([
      {
        id: 'a',
        matches: ['*://github.com/*'],
        js: [{ code: 'x()' }],
        runAt: 'document_start',
        world: 'MAIN',
      },
    ]);
  });

  it('跳过未启用 / 空 code / 空 patterns(词汇表:空列表不参与注入)', () => {
    expect(deriveRegistrations([
      script({ id: 'off', enabled: false }),
      script({ id: 'empty-code', code: '' }),
      script({ id: 'empty-code-ws', code: '   ' }),
      script({ id: 'no-patterns', patterns: [] }),
    ])).toEqual([]);
  });

  it('顺序 = 列表顺序(执行顺序语义:靠后者后执行)', () => {
    const regs = deriveRegistrations([script({ id: 'a' }), script({ id: 'b' }), script({ id: 'c' })]);
    expect(regs.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('syncRegistry(全量重建,注册表纯派生态)', () => {
  const stub = fakeBrowser as unknown as {
    userScripts: {
      register: ReturnType<typeof vi.fn>;
      unregister: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    fakeBrowser.reset();
    stub.userScripts.register = vi.fn().mockResolvedValue(undefined);
    stub.userScripts.unregister = vi.fn().mockResolvedValue(undefined);
  });

  it('unregister 全量清 + register 派生项(顺序即执行顺序)', async () => {
    await syncRegistry([script({ id: 'a' }), script({ id: 'b' })]);

    expect(stub.userScripts.unregister).toHaveBeenCalledTimes(1);
    expect(stub.userScripts.register).toHaveBeenCalledTimes(1);
    const registered = stub.userScripts.register.mock.calls[0]![0];
    expect(registered.map((r: { id: string }) => r.id)).toEqual(['a', 'b']);
  });

  it('无可注册项:只 unregister,不 register(空列表不报错)', async () => {
    await syncRegistry([]);
    expect(stub.userScripts.unregister).toHaveBeenCalledTimes(1);
    expect(stub.userScripts.register).not.toHaveBeenCalled();
  });

  it('unregister 抛错(如 API 门禁未开)→ 不吞:向上抛给调用方决策', async () => {
    stub.userScripts.unregister = vi.fn().mockRejectedValue(new Error('not enabled'));
    await expect(syncRegistry([script({ id: 'a' })])).rejects.toThrow('not enabled');
    expect(stub.userScripts.register).not.toHaveBeenCalled();
  });
});
