# UI 规范:tokens、主题系统与组件纪律

> 本文是所有 feature UI 的硬规范。架构背景见 [ADR-0004](adr/0004-ui-tailwind-shadcn-theme-model.md);
> 方案选型数据见 [ui-theme-standards.md](research/ui-theme-standards.md)。
> 违反本文 = CI 红(§4 的 lint 规则落地于 `eslint.config.js` 与 `stylelint.config.js`)。

## 1. Token 分层与 `--lif3ng-` 前缀

三层结构,UI 代码只出现在第三层:

```
原始值(oklch 色值、字号、半径)        ← 只住在 src/shared/theme/tokens.css
语义 token(--lif3ng-primary 等)      ← 只映射进 tailwind.css 的 @theme inline
组件 utility(bg-primary、text-muted-foreground) ← 组件/feature 代码里唯一允许的写法
```

硬规则:

1. **前缀**:语义 CSS 变量一律 `--lif3ng-` 开头。CSS 变量永远跨 shadow DOM 边界继承(将来 content UI 注入宿主页面),通名会与页面互相污染,前缀是隔离带。
2. **唯一真源**:色值(oklch/hex)只准写在 `tokens.css`(stylelint 对其余 .css 强制 `color-no-hex`)。
3. **utility 短名**:`@theme inline` 把 `--color-primary: var(--lif3ng-primary)` 映射后,组件写短名 `bg-primary`。复制进来的 shadcn 组件零改动即兼容。
4. **加语义槽位**:先在 `tokens.css` 四个主题块各加一行(整组换值原则),再在 `tailwind.css` 的 `@theme inline` 加映射。没有 token 就没有新颜色。
5. `sidebar-*` 组 v1 未引入;第一个用侧栏的 feature 落地时再补。

## 2. 主题系统(消费端:useTheme)

主题 = 平铺主题对模型(词汇见 `CONTEXT.md`「UI 与主题」节):

- 四主题:`light` / `dark`(shadcn 默认值)、`vercel-light` / `vercel-dark`(tweakcn vercel 预设)。
- 「跟随系统」是独立布尔,开启时在所选主题的**主题对**内按系统明暗解析。不是主题清单里的取值。
- 挂载:`useTheme()` 的 `resolved` 写 `documentElement.dataset.theme`;解析值为暗系时补挂 `.dark` 类(shadcn 复制组件里的 `dark:` variant 依赖它)。

### 使用法

```ts
import { useTheme } from '@/shared/theme/useTheme';
const { choice, followSystem, resolved, setChoice, setFollowSystem } = useTheme();
```

每个扩展页面 setup 一次。存储(`wxt/utils/storage`,manifest 需 `storage` 权限,已声明)、跨页面同步(`storage.watch`)、FOUC 防护全部内建,**feature 代码不准自己读写 `lif3ng/*` storage 键**。

### FOUC(主题闪烁)

扩展页面的 `<head>` 引 `public/theme-fouc.js`(外链阻塞脚本):

```html
<script src="/theme-fouc.js"></script>
```

CSP 实测(2026-08-31):MV3 默认 CSP `script-src 'self'` 禁内联 `<script>`,外链允许。脚本同步读 `localStorage` 镜像挂 `data-theme`;`useTheme` 挂载后再以 storage 真值校正。

### 端到端验收

`scripts/acceptance.mjs`(真浏览器,Playwright chromium + `--headless=new`;stable Chrome 137+ 已移除 `--load-extension`):

```sh
pnpm build -b chrome && node scripts/acceptance.mjs
```

覆盖:#8 手动验收脚本全部条目(四主题选择、popup/options 跨页面同步、跟随系统 × 系统明暗、关跟随不跟随)+ 四主题 × 两页面截图(落 `.output/acceptance/`)。2026-08-31 首跑 10/10,并抓出 manifest 缺 `storage` 权限的真 bug(已修)。

### 手动加主题三步曲(新主题清单条目)

1. `tokens.css` 贴一个 `[data-theme='<id>']` 块,整组覆盖全部语义 token(tweakcn 调完导出即贴);
2. `registry.ts` 加一行元数据 `{ id, label, appearance, pair }`;
3. `registry.test.ts` 会自动守护一致性——单测红 = 有遗漏。
4. 新主题若有「-light/-dark」成对意图,name 后缀标明,pair 互指。

## 3. 组件规范

- **何时 add shadcn 组件**:某 UI 模式在 ≥2 处出现,或 reka-ui 原语有可访问性价值(焦点/键盘管理)时,`pnpm dlx shadcn-vue@latest add <组件>`。组件落 `src/shared/ui/`(components.json alias 已配),只准按需 add——不为想象中的组件立规矩。
- **何时 feature 私有**:单 feature 一次性 UI 直接写在该 feature 目录,不入 shared。
- **复制组件的类写法原样保留**;`src/shared/ui/**` 整体豁免 §4 的 token 禁令(上游 shadcn 仓库守护,我们不背它的规范债)。
- **feature 组件里的类**:只用语义 token 类;状态色用语义槽位(`destructive` 而不是 `red-500`)。
- 命名:组件文件 PascalCase 与 shadcn 现有结构一致。

## 4. Lint 强制面(违者 CI 红)

| 层 | 工具 | 管什么 |
|---|---|---|
| 组件/feature 源码 | ESLint `lif3ng/atomic-class`(本地自定义规则) | 模板静态 `class="..."` 与 TS/JS 字符串字面量里的原子色 utility(`text-red-500`、`hover:text-blue-300` 等) |
| .css 文件 | Stylelint | `color-no-hex` + 色彩属性值必须 `var(--lif3ng-*)`;`tokens.css` 全豁免 |

两个工具都进 `pnpm lint`(CI 硬失败)。注意:vue-eslint-parser 的 templateBody 不进 core 规则遍历,模板静态 class 是自研规则(见 `eslint.config.js` 头注),改配置时别删。

### 豁免协议

真绕不开时(预期消费者:#3 编辑器的语法高亮色板):

```
行内紧邻上一行注释写 tokens-ignore: <理由>(JS 用 /* tokens-ignore: ... */;模板/HTML 用 <!-- tokens-ignore: ... -->)
```

规则逐行匹配,注释只豁免紧随其后的那一处;`tokens-ignore` 不带 `: 理由` 不算豁免。token 真源 `tokens.css` 与 `tailwind.css` 天然在 stylelint override 里放行,不需要注释。

## 5. 暂缓(等第一个 content UI feature)

shadow DOM 完整方案(`@property` 剥离注入宿主、变量挂 shadow host、rem 基准修复)在第一个带 content UI 的 feature(大概率 #2/#3)拷问时定,届时补章。已预留:语义 token 的 `--lif3ng-` 前缀与 WXT `createShadowRootUi` + `cssInjectionMode: 'ui'` 的组合路径,见调研报告 §4。