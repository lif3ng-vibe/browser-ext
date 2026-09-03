// src/features/user-scripts/registry.ts
import { browser, type Browser } from 'wxt/browser';
import type { UserScript } from './types';

/**
 * 平台 userScripts API 视图(词汇表「注册表」):WxtBrowser 类型上有,
 * 但 API 门禁未开时运行时为 undefined —— 视图统一窄化,消费方不散写。
 */
interface UserScriptsApi {
  register(scripts: Browser.userScripts.RegisteredUserScript[]): Promise<void>;
  unregister(): Promise<void>;
}
export const userScriptsApi = (): UserScriptsApi | undefined =>
  (browser as Partial<{ userScripts?: UserScriptsApi }>).userScripts;

/** 派生注册项:启用 + 有 code + 有 patterns 才参与;顺序 = 列表顺序(执行顺序) */
export function deriveRegistrations(
  scripts: UserScript[],
): Browser.userScripts.RegisteredUserScript[] {
  // 注:Chrome userScripts API 的注册项无 persistAcrossSessions 字段(实测拒绝多余
  // 属性;那是 scripting.RegisteredContentScript 的)。「注册表永不自持」由
  // backgroundWiring 的启动全量重建保证,与词汇表「注册表」语义一致
  return scripts
    .filter((s) => s.enabled && s.patterns.length > 0 && s.code.trim() !== '')
    .map((s) => ({
      id: s.id,
      matches: s.patterns,
      js: [{ code: s.code }],
      runAt: s.runAt,
      world: 'MAIN' as const,
    }));
}

/**
 * 全量重建注册表(storage 唯一事实源,#13 规格「注入机制」):
 * unregister 全量清 + register 派生项。注册表永远是派生态,随时可弃可重建。
 * 错误不吞:调用方(background 薄壳)决定门禁未开时的策略(静默等开通)。
 */
export async function syncRegistry(scripts: UserScript[]): Promise<void> {
  const api = userScriptsApi();
  if (!api) return; // API 不可用(门禁未开/浏览器不支持)→ 无从同步,等开通后 resync
  await api.unregister();
  const registrations = deriveRegistrations(scripts);
  if (registrations.length > 0) await api.register(registrations);
}
