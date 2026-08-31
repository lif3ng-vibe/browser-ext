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
完整设置的权威界面,住 `src/features/settings/`,经 entrypoint 薄壳成 WXT options 页。popup 内只放主题快切与齿轮入口,不承载完整设置。首版内容:主题选择 + 跟随系统复选框。
_Avoid_: popup 设置(它是入口不是载体)

### 决策留痕

**功能级决定**:
做/不做/怎么做的决定,记录于 GitHub issue(标题正文中文)。
_Avoid_: 口头决定、只写代码不留 issue

**骨架决定**:
影响整个仓库形状的难逆转决定(框架、架构、留痕规则),issue + ADR 双写,ADR 为权威文本。
_Avoid_: 把 ADR 当 issue 用、或只有 issue 没有 ADR

**追认(Retrospective Filing)**:
拷问会话中做出的决定,会后补开 issue 留痕的行为。
