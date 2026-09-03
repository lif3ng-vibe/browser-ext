// src/features/user-scripts/__tests__/gate.test.ts
import { describe, expect, it, vi } from 'vitest';
import { checkGate, firefoxPermissionGranted } from '../gate';
import { fakeBrowser } from 'wxt/testing/fake-browser';

// platformHasUserScripts 按 UA 判定;jsdom 默认 UA 是 jsdom(不含 chrome/firefox)
// → 单测环境默认走「无能力」分支;用 vi.stubGlobal 固定 UA 控制分支
const UA_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const UA_SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';

function stubUa(ua: string | undefined) {
  vi.stubGlobal('navigator', { userAgent: ua ?? '' });
}
function stubUserScripts(api: object | undefined) {
  const stub = fakeBrowser as unknown as Record<string, unknown>;
  const saved = stub.userScripts;
  stub.userScripts = api;
  return () => {
    stub.userScripts = saved;
  };
}

describe('checkGate(平台门禁三态;实测:门禁未开 = 命名空间整体 undefined)', () => {
  it('命名空间在 + getScripts 成功 → available(门禁已开)', async () => {
    stubUa(UA_CHROME);
    const restore = stubUserScripts({ getScripts: vi.fn().mockResolvedValue([]) });
    await expect(checkGate()).resolves.toBe('available');
    restore();
  });

  it('命名空间在 + getScripts 抛错 → locked(开着后被撤回)', async () => {
    stubUa(UA_CHROME);
    const restore = stubUserScripts({ getScripts: vi.fn().mockRejectedValue(new Error('denied')) });
    await expect(checkGate()).resolves.toBe('locked');
    restore();
  });

  it('命名空间缺失 + Chrome/Firefox 平台 → locked(门禁未开的常态路径,引导开通)', async () => {
    stubUa(UA_CHROME);
    const restore = stubUserScripts(undefined);
    await expect(checkGate()).resolves.toBe('locked');
    restore();
  });

  it('命名空间缺失 + 无能力平台(矩阵外浏览器)→ unavailable', async () => {
    stubUa(UA_SAFARI);
    const restore = stubUserScripts(undefined);
    await expect(checkGate()).resolves.toBe('unavailable');
    restore();
  });
});

describe('firefoxPermissionGranted(Firefox optional 权限辅助查询)', () => {
  it('permissions.contains 可用 → 返回授权真值', async () => {
    const stub = fakeBrowser as unknown as Record<string, unknown>;
    const saved = stub.permissions;
    stub.permissions = { contains: vi.fn().mockResolvedValue(true) };
    await expect(firefoxPermissionGranted()).resolves.toBe(true);
    stub.permissions = saved;
  });

  it('permissions API 缺失 → null(未知)', async () => {
    const stub = fakeBrowser as unknown as Record<string, unknown>;
    const saved = stub.permissions;
    stub.permissions = undefined;
    await expect(firefoxPermissionGranted()).resolves.toBeNull();
    stub.permissions = saved;
  });
});
