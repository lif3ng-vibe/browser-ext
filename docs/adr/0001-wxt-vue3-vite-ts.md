---
status: accepted
---

# 技术栈选 WXT + Vue 3 + Vite + TypeScript

跨浏览器插件框架选 WXT:一套代码出 Chrome/Firefox/Edge 的包,MV3 优先,entrypoint 自动发现正好支撑"功能目录即边界"的架构(ADR-0002)。UI 用 Vue 3(配 Vite),TS 为硬性要求。否掉 Plasmo(活跃度下滑)和 CRXJS(只覆盖 Chrome 系)。浏览器矩阵为 Chromium 系 + Firefox;Safari 因需苹果开发者账号打包而排除在矩阵外,但随时可加。

## Considered Options

- **WXT**(选定):开发体验与多浏览器产出最好,社区活跃。
- **Plasmo**:曾流行,活跃度下滑。
- **CRXJS**:只覆盖 Chrome 系,不满足矩阵。

## Consequences

- 版本单一来源 = git tag,CI 注入 manifest 版本,`package.json` 固定 `0.0.0`。
- CI:push main 跑 lint/typecheck/test + 三浏览器构建;打 tag 出 GitHub Release。不上架商店,dev 用 `wxt -b <browser>`。
- UI 组件不预建,按需实现,组件设计必须有 issue 跟踪。
- 留痕:https://github.com/lif3ng-vibe/browser-ext/issues/1
