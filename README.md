# browser-ext

个人浏览器插件工具箱——自嗨型功能,多浏览器支持。唯一用户是作者本人,需求持续到达,所有决定在 [Issues](https://github.com/lif3ng-vibe/browser-ext/issues) 留痕。

## 技术栈

- **[WXT](https://wxt.dev)** + Vue 3 + Vite + TypeScript
- 浏览器矩阵:Chrome / Firefox / Edge(见 [ADR-0001](docs/adr/0001-wxt-vue3-vite-ts.md))

## 架构

功能即目录:`src/features/<名>/` 是自包含边界,删目录 = 移功能。共享代码只进 `src/shared/`(浏览器无关)。见 [ADR-0002](docs/adr/0002-feature-isolation.md)。

## 开发

```bash
pnpm install        # 安装依赖
pnpm dev            # Chrome dev 模式
pnpm dev:firefox    # Firefox dev 模式
pnpm build          # 构建三浏览器产物
```

(脚手架初始化后可用;当前仓库处于骨架阶段。)

## 决策留痕

三档规则见 [ADR-0003](docs/adr/0003-decision-trail-rules.md):功能决定开 issue,难逆转决定 issue + ADR 双写,琐碎决定进 commit message。领域词汇见 [CONTEXT.md](CONTEXT.md)。
