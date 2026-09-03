# browser-ext

个人浏览器插件工具箱——自嗨型功能,多浏览器支持。唯一用户是作者本人,需求持续到达,所有决定在 [Issues](https://github.com/lif3ng-vibe/browser-ext/issues) 留痕。

## 技术栈

- **[WXT](https://wxt.dev)** + Vue 3 + Vite + TypeScript
- 浏览器矩阵:Chrome / Firefox / Edge(见 [ADR-0001](docs/adr/0001-wxt-vue3-vite-ts.md))

## 架构

功能即目录:`src/features/<名>/` 是自包含边界,删目录 = 移功能。共享代码只进 `src/shared/`(浏览器无关)。见 [ADR-0002](docs/adr/0002-feature-isolation.md)。

```
src/
├─ entrypoints/     # WXT 入口(popup 等)
├─ features/        # 每个子目录一个功能,删目录即移除
└─ shared/          # 跨功能共享,必须浏览器无关
```

## 开发

```bash
pnpm install        # 安装依赖
pnpm dev            # Chrome dev 模式
pnpm dev:firefox    # Firefox dev 模式
pnpm dev:edge       # Edge dev 模式
pnpm build          # 构建三浏览器产物(chrome/firefox/edge)
pnpm zip            # 打包三浏览器 zip 到 .output/
pnpm lint           # ESLint
pnpm compile        # vue-tsc 类型检查
pnpm test           # Vitest
```

版本单一来源是 git tag(`v0.x.x`):CI 从 tag 注入 manifest 版本,`package.json` 固定 `0.0.0`(见 [ADR-0001](docs/adr/0001-wxt-vue3-vite-ts.md))。

## 功能清单

- **主题系统**:四主题(light/dark/vercel-light/vercel-dark)+ 跟随系统,popup 快切,所有扩展页面统一换肤
- **自定义样式**(类 Stylish):按域名/全局注入用户 CSS,侧栏所见即所得编辑 + 预览,导入导出备份
- **便签**:全局便签随处可记;页面便签绑精确 URL 随页浮现(悬浮卡片,SPA 跟随);侧栏聚合视图 + 便签板独立小窗;设置页总开关(关闭只停页面浮现,数据保留)

## 决策留痕

三档规则见 [ADR-0003](docs/adr/0003-decision-trail-rules.md):功能决定开 issue,难逆转决定 issue + ADR 双写,琐碎决定进 commit message。领域词汇见 [CONTEXT.md](CONTEXT.md)。
