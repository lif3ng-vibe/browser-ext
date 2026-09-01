// src/shared/theme/__tests__/drift-guard.test.ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { THEMES } from '../registry';

/**
 * 主题 id 清单漂移守卫(评审候选 4,issue #19):
 * registry.ts 是唯一事实源,镜像处(fouc.js 阻塞脚本、快切色卡)凭纪律手工同步,
 * 测试即 seam:任一镜像缺新主题 id → CI 硬失败,静默失败不再可能。
 */
const REGISTRY_IDS = new Set(THEMES.map((t) => t.id));

describe('主题 id 镜像漂移守卫(registry 是唯一事实源)', () => {
  it('theme-fouc.js 认得的 id 与注册表一致(新增主题忘改阻塞脚本 → 红)', () => {
    const fouc = readFileSync(resolve(__dirname, '../../../../public/theme-fouc.js'), 'utf-8');
    // 白名单 = 脚本里全部 `=== '字面量'` 比较(localStorage 校验行 + dark 类判定行)
    const foucIds = new Set([...fouc.matchAll(/===\s*'([^']+)'/g)].map((m) => m[1]));

    expect(foucIds, 'theme-fouc.js 的 id 清单与 registry 不一致').toEqual(REGISTRY_IDS);
  });

  it('ThemeQuickSwitch 色卡覆盖全部注册主题(新增主题忘加色卡 → 红)', () => {
    const quickSwitch = readFileSync(
      resolve(__dirname, '../../../features/settings/components/ThemeQuickSwitch.vue'),
      'utf-8',
    );
    // PREVIEW_COLORS 键:带引号后跟冒号的字符串字面量(light: / 'vercel-light':)
    const keys = [...quickSwitch.matchAll(/^\s*'?(?:([a-z0-9-]+))'?:\s*\{\s*bg:/gm)].map((m) => m[1]!);
    const colorIds = new Set(keys);

    expect(colorIds, 'PREVIEW_COLORS 的键与 registry 不一致').toEqual(REGISTRY_IDS);
  });
});
