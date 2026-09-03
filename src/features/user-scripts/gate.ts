// src/features/user-scripts/gate.ts
import { browser } from 'wxt/browser';

/**
 * 平台门禁(#13 规格「平台门禁引导」)三态:
 * - available:userScripts API 可用且门禁已开,注册表正常工作
 * - locked:浏览器有该 API 能力但门禁未开 —— Chrome「允许用户脚本」开关没开
 *   (<138 开发者模式 / ≥138 扩展详情页开关;实测:未开时命名空间整体 undefined)、
 *   Firefox 未授 optional 权限(同样 undefined)。UI 显示开通指引/启用按钮
 * - unavailable:浏览器不支持该 API(如 Edge 未跟进)→ UI 标注未生效
 */
export type GateStatus = 'available' | 'locked' | 'unavailable';

/**
 * 浏览器是否具备 userScripts API 能力(与门禁无关)。
 * 判据 = 平台 UA:Chrome/Chromium(edge 含 chrome 字样)与 Firefox 均有该 API 面
 * (Edge 是否跟进是 #13 验收首个检查项,缺则归此);Safari 等不在矩阵内。
 */
function platformHasUserScripts(): boolean {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  return /firefox|chrome|chromium|edg\//i.test(ua);
}

/**
 * 运行时探测:
 * - 命名空间在且 getScripts 可调 → available
 * - 命名空间在但调用抛错(开着后被用户撤回,Chrome 文档语义)→ locked
 * - 命名空间缺失:平台有能力(Chrome/Firefox)→ locked(门禁未开,这是常态路径);
 *   无能力 → unavailable
 */
export async function checkGate(): Promise<GateStatus> {
  const api = (browser as Partial<{ userScripts?: { getScripts?(): Promise<unknown> } }>).userScripts;
  if (api?.getScripts) {
    try {
      await api.getScripts();
      return 'available';
    } catch {
      return 'locked';
    }
  }
  return platformHasUserScripts() ? 'locked' : 'unavailable';
}

/** Firefox 授权路径:optional userScripts 权限是否已授(门禁判定的辅助查询) */
export async function firefoxPermissionGranted(): Promise<boolean | null> {
  const permissions = (browser as Partial<{ permissions?: { contains(p: { permissions: string[] }): Promise<boolean> } }>).permissions;
  if (!permissions?.contains) return null; // 非 Firefox / 权限 API 缺失
  try {
    return await permissions.contains({ permissions: ['userScripts'] });
  } catch {
    return null;
  }
}
