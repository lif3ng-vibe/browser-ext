# browser-ext

个人浏览器插件工具箱:一批彼此独立的"自嗨"功能住在一个跨浏览器插件里,唯一用户是作者本人。

## Language

### 功能边界 / Feature

**Feature(功能)**:
一个自包含的产品能力,住在 `src/features/<名>/` 目录里,自带逻辑与 UI。目录即边界:删除目录(连同其 entrypoint 薄壳)等于干净移除该功能。
_Avoid_: 模块(太泛)、插件(指整个 browser-ext)

**Entrypoint 薄壳(Entrypoint Shell)**:
`src/entrypoints/<名>/` 下 10 行以内的注册文件(index.html + main.ts),只做 import 挂载,不含逻辑。WXT 只认单一 entrypoints 目录,Feature 的 UI 经薄壳接入。
_Avoid_: "Feature 自带 entrypoint"(WXT 不支持,构建魔法不做)

**Shared(共享层)**:
多个 Feature 复用的代码,住 `src/shared/`,必须浏览器无关。Feature 之间默认禁止互相 import;要共享就下沉到这里或合并 Feature。
_Avoid_: common、utils(不表边界语义)

### 平台

**浏览器矩阵(Browser Matrix)**:
本项目正式支持的浏览器集合:Chrome、Firefox、Edge。Safari 明确不在矩阵内,但矩阵是可扩展的。
_Avoid_: "所有浏览器"(从不是目标)

**差异封装(Divergence Encapsulation)**:
浏览器差异只能消化在 Feature 内部,永不进入 Shared。

### UI 与主题

**主题(Theme)**:
一套完整的视觉取值(色、圆角、字号密度),平铺模型:`data-theme="<名>"` 一个属性完全决定外观。主题名以 `-light`/`-dark` 结尾标明明暗倾向;`light`/`dark` 即默认主题对。
_Avoid_: "皮肤"(轻浮,不表整组取值)

**主题对(Theme Pair)**:
共享同一风格、仅明暗不同的两个主题(如 `vercel-light` / `vercel-dark`)。配对关系是注册表里的显式元数据,不靠名字后缀解析。
_Avoid_: 把配对当成命名约定的副作用

**跟随系统(Follow System)**:
设置里的独立复选框:开启时在当前主题对内按系统明暗选取对应主题。
_Avoid_: 把"跟随系统"当成主题清单里的一个主题

**主题解析值(Resolved Theme)**:
跟随系统开启时 = 当前主题对中与系统明暗匹配的那个;关闭时 = 所存选择本身。页面挂的永远是解析值。
_Avoid_: 混淆"选择"与"解析值"

**语义 token(Semantic Token)**:
带 `--lif3ng-` 前缀的 CSS 变量(`--lif3ng-primary`),UI 只准消费它,禁止原子色硬编码。前缀防注入宿主页面时变量双向穿透撞名。
_Avoid_: 原子色(`red-500`)、裸 hex/oklch 字面量进组件模板

**设置页(Settings)**:
完整设置的权威界面 = WXT options 页,由 entrypoint 薄壳聚合各 Feature 暴露的设置区块。`features/settings` 只是主题区块的贡献者,不再独占整页。popup 内只放主题快切与齿轮入口,不承载完整设置。
_Avoid_: popup 设置(它是入口不是载体)、把某个 Feature 当作 options 页的独占者

**设置区块(Settings Block)**:
Feature 暴露给 options 聚合页的自包含设置 UI 单元(`ThemeSettingsBlock`、`ManageStylesBlock`),跨 Feature 组合只发生在 options 薄壳,Feature 间仍禁止互相 import。
_Avoid_: 设置区块互相引用

### 自定义样式

**自定义样式(Custom Style)**:
一条命名的自包含用户 CSS,绑定一组作用域并带启用状态,住 `src/features/custom-styles/`。v1 只收 CSS,不收 JS。
_Avoid_: "皮肤"、主题(注入宿主页面的东西不是本插件的 Theme)

**作用域(Scope)**:
自定义样式的生效范围,用浏览器原生 match pattern 表达。UI 上可只填域名由界面展开成 pattern。
_Avoid_: 自造域名方言、正则匹配

**全局样式(Global Style)**:
作用域为 `<all_urls>` 的自定义样式,无特殊机制,只是取值上的特例。
_Avoid_: 把"全局"当一类 separate 渠道做双轨实现

**级联顺序(Cascade Order)**:
多个启用样式同时命中页面时全部注入,按管理列表顺序级联,列表靠后的覆盖靠前的;调整列表顺序即优先级。
_Avoid_: 优先级数值字段

**预览(Preview)**:
所见即所得编辑时,样式在当前标签页即时生效但不入 storage 的临时状态;保存才持久化。
_Avoid_: 把预览当成已保存、把已保存当成已预览

### 决策留痕

**功能级决定**:
做/不做/怎么做的决定,记录于 GitHub issue(标题正文中文)。
_Avoid_: 口头决定、只写代码不留 issue

**骨架决定**:
影响整个仓库形状的难逆转决定(框架、架构、留痕规则),issue + ADR 双写,ADR 为权威文本。
_Avoid_: 把 ADR 当 issue 用、或只有 issue 没有 ADR

**追认(Retrospective Filing)**:
拷问会话中做出的决定,会后补开 issue 留痕的行为。
