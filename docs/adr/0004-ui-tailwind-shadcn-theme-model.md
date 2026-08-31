---
status: accepted
---

# UI 底座:Tailwind v4 + shadcn-vue 与平铺主题对模型

插件所有 UI 的样式底座定为 Tailwind v4(`@tailwindcss/vite`,WXT 官方路径;`wxt-module-tailwindcss` 已 404)+ shadcn-vue(组件源码复制进仓库,底层 reka-ui,住 `src/shared/ui/`)。备选 DaisyUI 5(组件观感锁死、语义槽位固定)与裸 reka-ui + 自研 token(对单人项目过度工程)被否,对比数据见 `docs/research/ui-theme-standards.md`。主题模型为**平铺 + 主题对**:每个主题一个 `[data-theme]` CSS 块整组换值,主题名以 `-light`/`-dark` 结尾标明倾向;「跟随系统」是独立复选框,开启时在所选主题对内按系统明暗解析,不是主题清单里的取值。语义 token 一律带 `--lif3ng-` 前缀(CSS 变量永远跨 shadow DOM 边界继承,通名会与宿主页面互相污染;`@theme inline` 映射层保持 shadcn 短名如 `bg-primary`,复制组件零改动)。shadcn-vue 默认值即 light/dark 主题对,vercel 对取 tweakcn vercel 预设;字体用系统栈不背字体包。规范与 lint 规则落 `docs/ui.md`;shadow DOM 完整方案(`@property` 剥离注入等)推迟到第一个带 content UI 的 feature 拷问时定。

## Consequences

- 主题系统(tokens/注册表/解析/storage/composable)住 `src/shared/theme/`,无头、浏览器无关;设置 UI(含 popup 快切组件)住 `src/features/settings/`,删除该目录 = 干净移除完整设置,主题系统存活。
- Feature 不再"自带 entrypoint":WXT 只认单一 entrypoints 目录,`src/entrypoints/<名>/` 下 10 行内薄壳注册(CONTEXT.md 词汇已修正)。
- lint 双管(ESLint 禁原子色 utility + Stylelint 禁 hex/oklch 字面量)CI 硬失败,豁免须 `/* tokens-ignore */` 带理由。
- 留痕:https://github.com/lif3ng-vibe/browser-ext/issues/6(伞)+ issues/4
