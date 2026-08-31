# 浏览器扩展（Vue 3 + WXT）UI 组件规范与多主题体系调研

> 调研日期：2026-08-31。所有版本号/日期为当日通过 npm registry、GitHub API、官方文档实测取得；结论附来源 URL。
> 本文档为调研留痕，供后续 issue / ADR 引用。

## TL;DR

- **多主题的事实标准做法**：语义化 CSS variables（`--color-primary` 这类语义 token，而非 `--color-blue-500` 原子色）+ 在 `[data-theme="xxx"]` 选择器下整组换值。换主题 = 换变量值，组件代码零改动。
- **Tailwind v4 是 2026 年 Vue 3 + WXT 生态的默认底座**：CSS-first 配置（`@theme`），`@theme inline` + 语义变量实现"编译期生成 utility、运行期换主题"，官方 WXT 示例即用 `@tailwindcss/vite`。
- **首选推荐：Tailwind v4 + shadcn-vue（基于 reka-ui）+ 语义 tokens + tweakcn 主题编辑器**。组件复制进仓库（不锁版本）、天然多主题、AI agent 可按 tokens 规范约束产出。
- **注意：`wxt-module-tailwindcss` 已消失**（GitHub 404、npm 404），WXT 官方路径是直接用 `@tailwindcss/vite` 插件；UnoCSS 则有官方模块 `@wxt-dev/unocss`。
- **Shadow DOM 两大坑**：Tailwind v4 依赖的 `@property` 在 shadow root 内无效（官方 issue 仍 Open）；CSS 变量会穿透 shadow 边界双向继承（页面变量污染你的 UI、你注入页面的变量污染页面）。

---

## 1. 现状速览（2026-08-31 实测）

| 方案 | 最新版本（发布时间） | 定位 | 多主题能力 | Vue 3 / WXT 兼容 |
|---|---|---|---|---|
| Tailwind CSS | 4.3.3（2026-08-14） | 原子 CSS 底座 | `@theme` + `@custom-variant` + CSS vars，需自建 token 体系 | 极佳（WXT 官方示例用 `@tailwindcss/vite`） |
| shadcn-vue | 2.8.2（2026-08-08，仓库 8-26 仍活跃，10.5k stars） | shadcn/ui 的 Vue 移植，组件复制模式 | oklch 语义 CSS vars，换值即换主题 | 极佳（Vue 3 / Nuxt 原生） |
| reka-ui | 2.10.4（2026-08-25，6.7k stars，月下载 290 万+） | 无样式 headless 组件库（radix-vue 后继） | 无样式，不管主题（正因如此与任何 token 体系兼容） | 极佳（Vue 3 原生） |
| radix-vue | 1.9.17（**2025-02-28 后停更**） | reka-ui 前身 | — | 已被 reka-ui 取代，勿再用 |
| Radix Colors | 3.0.0（2025-12-24） | 12 阶语义色阶系统（APCA、P3） | 亮暗同阶换值 + 别名重映射 | 框架无关（纯 CSS vars） |
| DaisyUI | 5.7.22（2026-08-24，42k stars） | CSS-only 语义组件库（Tailwind 插件） | **35 个内置主题** + `data-theme` 一键切换 + 自定义主题 | 极佳（CSS-only） |
| UnoCSS | 66.8.1（2026-08-21，19k stars） | 按需原子 CSS 引擎 | 无官方多主题 preset；社区 `unocss-preset-theme` 已停更（2024-10） | 佳（官方 `@wxt-dev/unocss`） |
| Style Dictionary | 5.5.2（2026-08-19） | token 构建管线（DTCG → 各平台） | 生成器（不直接管运行时主题） | 与框架无关，构建期工具 |
| W3C DTCG 格式 | 草案 2025.10（CG Report 2026-07-30） | token 交换格式标准 | 格式标准（非运行时方案） | 无关 |
| Tokens Studio | 平台化转型中 | 设计侧 token 管理平台 | 设计工具侧 | 通过 sd-transforms / Style Dictionary 接入 |
| WXT | 0.21.4（2026-08-11，10.4k stars） | 扩展框架 | —（提供 shadow DOM UI 与样式注入机制） | 本体 |

来源：
- https://github.com/unovue/shadcn-vue （10,521 stars，pushed 2026-08-26）
- https://github.com/unovue/reka-ui （6,758 stars，pushed 2026-08-30）
- https://github.com/saadeghi/daisyui （42,249 stars，pushed 2026-08-24）
- https://github.com/unocss/unocss （18,946 stars，pushed 2026-08-28）
- https://github.com/wxt-dev/wxt （10,428 stars，pushed 2026-08-22）
- https://github.com/style-dictionary/style-dictionary （4,792 stars，pushed 2026-08-22；仓库已从 amzn org 迁至独立 org）

---

## 2. Design Tokens 标准层

### 2.1 W3C Design Tokens Community Group（DTCG）

- 现状：**Draft Community Group Report**，版本 2025.10，2026-07-30 发布。分为三个模块：**Format、Color、Resolver**。明确不是 W3C Standard、不在 W3C 标准轨道上，官方自述"不要据此实现"。
- 意义：它是**交换格式**（JSON，`$value`/`$type`/别名引用），解决设计工具 ↔ 代码的互操作，不解决运行时主题切换。
- 对本项目的定位：如果将来引入 Figma 侧 token 管理（Tokens Studio/Penpot），按 DTCG 格式存 token；运行时仍落到 CSS variables。
- 来源：https://www.designtokens.org/TR/drafts/ 、https://github.com/design-tokens/community-group （2,106 stars，pushed 2026-08-09）

### 2.2 Style Dictionary（v5，活跃）

- v5.5.2（2026-08-19）。v5 对 **DTCG 2025.10 格式支持良好**：dimension 对象值（`{"value":1,"unit":"px"}`）、shadow 的 `inset`、typography/border 简写等；年内多次安全修复，维护活跃。
- 用法定位：构建期管线，把 DTCG JSON 编译成 CSS variables 文件（可按主题输出多份）。**小团队/纯代码项目可以不上**——手写 CSS variables + Tailwind `@theme` 已够；当 token 来源在设计侧或需多端（Web + 文档站）输出时才引入。
- 来源：https://github.com/style-dictionary/style-dictionary/releases

### 2.3 Tokens Studio（平台化转型）

- 已从"Figma token 插件"转型为设计系统平台（Studio Platform + Figma/Penpot/VS Code/Framer 插件 + CLI）；官网自称 open by default、无锁定、集成 Style Dictionary。
- GitHub org 活跃仓库：figma-plugin（2026-08-28 仍在更新）、tokenscript-interpreter、sd-transforms（Style Dictionary 桥，2025-12）、studio-cli-releases。原 `tokens-studio/kg` 仓库已不存在（404）。
- 结论：设计协作才需要；纯扩展项目不建议引入这条链路。
- 来源：https://tokens.studio/ 、https://github.com/tokens-studio （org 仓库列表，实测）

### 2.4 CSS variables + Tailwind v4 `@theme`：当前最佳实践

核心三件套（2026 年共识写法）：

```css
@import "tailwindcss";

/* 1) 运行期语义 token：定义在普通选择器下，可被任何主题块覆盖 */
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
}
[data-theme="nord"] { --background: oklch(0.98 0.01 250); /* …整组换值 */ }
.dark              { --background: oklch(0.145 0 0);     /* … */ }

/* 2) 编译期映射：@theme inline 让 utility 直接引用 var(--token) */
@theme inline {
  --color-background: var(--background);
  --color-primary: var(--primary);
  --radius-lg: var(--radius);
}

/* 3) dark: variant 重定向到类或 data-theme（v4 用 @custom-variant，取代 v3 的 darkMode 配置） */
@custom-variant dark (&:where(.dark, .dark *));
/* 或：@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *)); */
```

关键点（均出自官方文档）：
- `@theme` 的值是**编译期常量**且必须顶层；运行时换主题**不能**靠覆盖 `@theme`，而是靠"`@theme inline` 引用变量 + 主题选择器覆盖变量"。这是 shadcn 系的标准架构。
- `@theme static` 可强制所有变量输出（需要 JS 读变量时有用）；`@theme` 天然按命名空间生成 utility（`--color-*` → `bg-*`/`text-*`，`--radius-*` → `rounded-*` 等）。
- 语义 token（`--color-primary`）而非原子色（`--color-blue-500`）是多主题的前提：组件里永远写 `bg-primary text-primary-foreground`。
- 来源：https://tailwindcss.com/docs/theme 、https://tailwindcss.com/docs/dark-mode

---

## 3. 现成方案逐项分析

### 3.1 shadcn-vue（Unovue 出品，原名不变）

- **定位**：shadcn/ui 的 Vue 3 移植，unovue 组织维护。CLI 把组件源码复制进你的仓库（非 npm 依赖），底层是 reka-ui 的 headless 原语 + Tailwind 类。
- **多主题能力**：theming 官方方案就是上文"语义 CSS vars + `@theme inline`"架构：`:root` 定义 oklch token，`.dark` 覆盖同名 token，组件全部使用 `bg-background`/`text-foreground` 级语义类。官方文档未内建"第三主题"文档，但机制上任何 `[data-theme="x"]` 块覆盖同一组变量即是新主题——**多主题是该架构的天然能力**。
- **token 面**：background/foreground、card、popover、primary、secondary、muted、accent、destructive、border、input、ring、chart-1~5、sidebar-* 全套语义对（surface + `*-foreground` 前景配对）；radius 由单一 `--radius` 派生整档（`calc(var(--radius) * 0.6)` 等）。加自定义 token（如 `--warning`）文档有明确步骤。
- **活跃度**：v2.8.2（2026-08-08）发布，仓库 2026-08-26 仍在推进；React 本家 shadcn/ui 122k stars、2026-08-30 仍在更新，模式长期有效。
- **扩展自定义主题难度**：低。新增主题 = 新增一个 CSS 块；用 tweakcn 可视化调完导出即可。
- **对 AI agent 约束友好度**：高——组件代码在仓库内，agent 只需遵守"只用语义 token 类、禁止裸写原子色"这一条 lint 级规则。
- 来源：https://www.shadcn-vue.com/docs/theming 、https://www.shadcn-vue.com/docs/dark-mode 、https://github.com/unovue/shadcn-vue

### 3.2 reka-ui（radix-vue 后继）与 Radix Colors

- **reka-ui**：Vue 3 无样式 headless 组件库（40+ 原语，WAI-ARIA、焦点/键盘管理），**不提供任何样式和 token**——主题体系完全由你（或 shadcn-vue）决定。月下载 290 万+，v2.10.4（2026-08-25）。radix-vue 最后发布停在 2025-02-28，**勿再选用**。
- **Radix Colors**（@radix-ui/colors 3.0.0，2025-12-24）：约 30 个色系 × **12 阶语义色阶**，每阶有明确用途（1-2 背景、3-5 组件背景/hover、6-8 边框、9-10 实心强调、11-12 文本；APCA 对比保证）；暗色不是另一套色，而是**同阶号换值 + 别名重映射**（`AppBg` 之类 mutable alias）；输出为 CSS variables，框架无关，Vue 可直接用。
- **用法**：可单独引 Radix Colors 作为"色阶生成器"喂给你的语义 token（`--color-primary: var(--blue-9)`），shadcn-vue 体系内也可选装。WXT 项目里注意其变量挂载点（见第 4 节）。
- 来源：https://reka-ui.com/ 、https://github.com/unovue/reka-ui 、https://www.radix-ui.com/colors 、https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale

### 3.3 DaisyUI 5

- **定位**：CSS-only 语义组件库，以 Tailwind v4 插件形式集成（`@plugin "daisyui"`），无 JS、框架无关，Vue 3/WXT 直接可用。
- **多主题能力（同类最强开箱）**：**35 个内置主题**（light/dark/cupcake/synthwave/dracula/nord/cyberpunk…），`themes: light --default, dark --prefersdark` 声明启用，`<html data-theme="cupcake">` 切换，**可嵌套作用域**（子元素换主题）。自定义主题用 `@plugin "daisyui/theme"` 定义一整组语义变量（base-100/200/300 + primary/secondary/accent/neutral/info/success/warning/error 各配 `*-content`，外加 `--radius-selector/field/box`、`--size-*`、`--border`、`--depth`、`--noise`），并可直接按内置主题名覆盖继承。还可把 Tailwind 的 `dark:` variant 映射到任一 daisy 主题（`@custom-variant dark (&:where([data-theme=night], ...))`）。
- **扩展自定义主题难度**：低-中。加主题容易（一个 plugin 块）；但主题"风格自由度"受限于其固定语义变量集（想加 `--color-warning` 之外的新语义槽位需绕开它的体系）；组件外观可调半径/边框/阴影/噪点，但结构风格（Daisy 观感）不易彻底改变。
- **与 shadcn-vue 二选一的原因**：两者都消费 Tailwind；Daisy 组件类（`btn btn-primary`）与 shadcn 复制组件混用会双份样式体系，不建议叠加。
- 来源：https://daisyui.com/docs/themes/ 、https://daisyui.com/docs/colors/ 、https://github.com/saadeghi/daisyui

### 3.4 UnoCSS

- **定位**：按需原子 CSS 引擎，v66.8.1（2026-08-21）活跃。官方 preset 现为 `preset-wind3` / `preset-wind4`（Tailwind v3/v4 兼容），旧 `preset-uno`/`preset-wind` 已弃用。
- **主题能力**：`theme` 配置对象（colors/fonts/breakpoints，深合并），值里可写 `hsl(var(--x) …)` 实现运行时换值；`dark:` 的 class/media 策略在 preset 层配置。**没有官方多主题 preset**；社区 `unocss-preset-theme` 最后发布 2024-10-21，实质停更。
- **WXT 支持**：官方模块 `@wxt-dev/unocss`（WXT monorepo 内 `packages/unocss`，docs/unocss.md），`modules: ['@wxt-dev/unocss']` + `import 'virtual:uno.css'`，有 `excludeEntrypoints` 选项。
- **结论**：WXT 下可用且是一等公民，但"多主题 + 语义 token + 约束 AI"要全自建，约束生态（lint 规则、AI 训练先例、组件复制模板）远不如 Tailwind 系。除非全队已深度使用 Uno，否则本场景不占优。
- 来源：https://unocss.dev/presets/ 、https://unocss.dev/config/theme 、https://github.com/wxt-dev/wxt/tree/main/packages/unocss 、https://www.npmjs.com/package/unocss-preset-theme

### 3.5 WXT 对样式方案的内建支持（重要勘误）

- **`wxt-module-tailwindcss`（aklinker1）已不存在**：GitHub 与 npm 均 404（实测 2026-08-31）。**官方现行方案 = 直接用 `@tailwindcss/vite`**：WXT 官方 examples 的 `tailwindcss` 示例 devDependencies 即 `@tailwindcss/vite ^4.1.4 + tailwindcss ^4.0.9`，在 `wxt.config.ts` 里配置 Vite 插件（WXT 内部接管 Vite 配置）。
- **UnoCSS**：官方模块 `@wxt-dev/unocss`（见上）。
- **官方 examples 里还有 `react-shadcn`**（shadcn/ui 在 WXT 下的完整接入示例：Tailwind v4 + 别名配置 + shadcn CLI 使用的临时 vite.config.ts 技巧），证明 shadcn 模式在扩展场景被官方验证（Vue 同理，另有 `vue-overlay` 等示例）。
- 来源：https://github.com/wxt-dev/examples/tree/main/examples/tailwindcss （package.json 实测）、https://github.com/wxt-dev/examples/tree/main/examples/react-shadcn 、https://wxt.dev/

---

## 4. 浏览器扩展场景：Shadow DOM 与 MV3 注意事项

### 4.1 WXT 的三种 content script UI

`createIntegratedUi`（无样式隔离，继承页面样式）、`createShadowRootUi`（样式隔离 + 可选事件隔离，推荐）、`createIframeUi`（完全隔离 + HMR）。`createShadowRootUi` 要求：content script 顶部 import CSS + `defineContentScript` 设 `cssInjectionMode: 'ui'`（CSS 不进 manifest 的 `css` 数组，而是打进 shadow root 内）。另有 `all: initial` 重置继承样式，但**不重置 rem 基准**——宿主页改过 `<html>` 字号时你的 UI 会跟着缩放，FAQ 有修复方案。来源：https://wxt.dev/guide/essentials/content-scripts.html

### 4.2 CSS 变量穿透 shadow 边界（双向）

- `--` 定义的 custom property **永远继承**（MDN 原文："A custom property defined using two dashes `--` … always inherits the value of its parent"；`@property` 才可关掉继承）。Shadow tree 的"父"是 shadow host，于是：**宿主页面的同名变量会渗进你的 UI，你写在页面 `:root` 的变量也会污染页面**。
- 工程结论：
  1. content script UI 的主题变量**不要挂宿主页面的 `:root`**，挂在 shadow host 元素（如 `wxt-shadow-host[data-theme="nord"]`）或 shadow root 内部的包裹元素上；
  2. 给语义 token 加**项目前缀**（`--ext-background`）防与页面撞名；
  3. popup / options / sidepanel 是扩展自己的页面，正常用 `:root` + `data-theme` 即可。
- 来源：https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties 、https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM

### 4.3 Tailwind v4 在 shadow root 里的 `@property` 问题（官方 issue 仍 Open）

- v4 依赖 `@property` 给 `--tw-*` 自定义属性设默认值/类型，而 **shadow root 内的 `@property` 不生效**（规范层面禁止；Houdini 草案 w3c/css-houdini-drafts#1085 在讨论放开）。症状：渐变/透明度修饰等依赖注册变量的 utility 在 shadow DOM 内失灵。Tailwind 官方 issue #15005"@property isn't supported in shadow roots"，2024-11-14 提出，**至今 Open**（2026-03-30 仍更新）。
- 社区通行 workaround（issue 内给出）：把 Tailwind 输出中的 `@property` 声明**单独剥出一份 CSS 注入宿主 document**（并把 `inherits: false` 改为 `true`），其余样式照常进 shadow root。WXT 下可做成一个小入口（manifest `css` 注入 document）+ 主样式进 shadow root 的组合；若 UI 不用渐变/透明度修饰类，多数场景甚至感知不到此问题。
- 主题变量本身不受影响：变量继承（4.2）恰恰是它能跨边界工作的原因。
- 来源：https://github.com/tailwindlabs/tailwindcss/issues/15005 、https://github.com/tailwindlabs/tailwindcss/issues/17778

### 4.4 其他扩展场景要点

- **FOUC/闪烁**：popup 打开即渲染，主题切换逻辑要在挂载前同步确定（读 `browser.storage` 后再 mount，或先注入默认主题再异步校正）。
- **存储同步**：主题选择存 `storage.local`（`useColorMode` 的 `storageRef`/`storageKey` 可接自定义 storage 适配器）；多 context（popup/options/content script）用 WXT `storage.defineItem` 的 watch 保持一致。
- **prefers-color-scheme**：DaisyUI 用 `--prefersdark` 声明式处理；自建体系用 `useColorMode` 的 `initialValue: 'auto'`。

---

## 5. 明暗之外的"多主题"：语义 token 与工具链

- **语义分层是正解**：三层结构 `原子色阶（Radix Colors 12 阶 / Tailwind 默认调色板）→ 语义 token（`--primary`、`--background`）→ 组件 utility（`bg-primary`）`。主题 = 语义层的整组取值；"风格"差异（圆角、边框、阴影、字号密度）也 token 化（DaisyUI 的 `--radius-box/--depth/--noise`、shadcn 的 `--radius` 派生档是现成范本）。
- **主题切换器（Vue 侧）**：`@vueuse/core` 的 `useColorMode` 原生支持**多模式**（`modes: { dim: 'dim', cafe: 'cafe' }`），可配 `attribute: 'data-theme'`、`selector`、自定义 `storageRef`——即"多主题切换"不需要主题库，一个 composable + 变量块即可。来源：https://vueuse.org/core/useColorMode/
- **tweakcn**（现居 `jnsahaj/tweakcn`，10,327 stars，2026-08-17 活跃）：shadcn 主题可视化编辑器，调色/圆角/字体后**导出 CSS**（`:root` + `.dark` 块），可直接粘贴为项目的一个主题文件。适合给设计师或自己快速产出多套主题成品。来源：https://github.com/jnsahaj/tweakcn
- 围绕 tweakcn 已有主题切换 showcase（如 `heywinit/colorswitchcn` 等社区仓库）；shadcn/ui 官方站原 `/themes` 画廊已改版为项目页，不再作为主题分发口径。

---

## 6. 推荐组合（2-3 个，按取舍）

### 组合 A（首选）：Tailwind v4 + shadcn-vue + 语义 CSS vars + useColorMode/tweakcn

- **构成**：`@tailwindcss/vite`（WXT 官方路径）→ shadcn-vue CLI 复制组件（底层 reka-ui）→ `@theme inline` 映射语义 token → 每主题一个 `[data-theme="x"]` CSS 块 → `useColorMode` 切换 → tweakcn 出主题成品。
- **适合**：要完整组件库、要任意数量主题、要长期可维护、要给 AI agent 立"只准用语义 token"的硬规范。组件源码在仓库内，agent 改组件不会和上游库打架。
- **代价**：初始接入步骤多于 DaisyUI；shadow DOM 需按 4.2/4.3 处理变量作用域与 `@property`。
- **AI 约束落点**：lint 禁 `text-(red|blue|zinc)-\d` 等原子色类、禁十六进制/oklch 字面量出现在组件模板、新颜色必须先入 token 文件。

### 组合 B（最快出活）：Tailwind v4 + DaisyUI 5

- **构成**：一个 `@plugin "daisyui"` + `data-theme` 切换，35 个内置主题即拿即用；自定义主题一个 `@plugin "daisyui/theme"` 块搞定。
- **适合**：想立刻拥有"多主题切换"的产品演示；对组件观感统一性要求高于个性化；团队不想维护组件源码。
- **代价**：语义槽位固定（新语义色要绕体系）；组件风格=Daisy 风，深度定制结构不现实；与 shadcn-vue 互斥（二选一）。
- **AI 约束落点**：只用 Daisy 语义类（`btn-primary`、`bg-base-100`），禁止 Tailwind 原子色。

### 组合 C（最强管控）：Tailwind v4 + reka-ui 裸 headless + 自研 token 体系（可选 Style Dictionary/DTCG）

- **构成**：reka-ui 提供可访问性原语（无样式），token 全部自研（可用 Radix Colors 做色阶底座），`tokens.json`（DTCG 格式）经 Style Dictionary v5 编译成 CSS vars——设计侧将来可接 Tokens Studio/Penpot。
- **适合**：token 需要多端复用（扩展 + 官网 + 文档站）、或组织层面要管 design tokens 资产、或要绝对控制组件观感。
- **代价**：自建组件样式工作量最大；对"快速多主题演示"是过度工程。**若暂无设计侧协作，Style Dictionary 层可先不上**（手写 CSS vars 完全等价，后续随时可补编译管线）。

> 共同底座注意：无论哪个组合，content script 一律 `createShadowRootUi` + `cssInjectionMode:'ui'`，主题变量挂 shadow host 而非宿主 `:root`，token 加项目前缀；`@property` 剥离注入按需处理。

---

## 7. 附：本次实测的数据口径

- 版本/时间：`npm view <pkg> version time.modified`（2026-08-31）
- 仓库活跃度：GitHub REST/GraphQL API（`gh repo view --json`）
- 文档：各官方站点/仓库 raw 文件逐页抓取
- 搜索引擎额度当日耗尽，未使用二手转述；上文所有事实均来自上述一手来源，URL 已随文标注
