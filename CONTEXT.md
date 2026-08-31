# browser-ext

个人浏览器插件工具箱:一批彼此独立的"自嗨"功能住在一个跨浏览器插件里,唯一用户是作者本人。

## Language

### 功能边界 / Feature

**Feature(功能)**:
一个自包含的产品能力,住在 `src/features/<名>/` 目录里,自带 entrypoint、逻辑与样式。目录即边界:删除目录等于干净移除该功能。
_Avoid_: 模块(太泛)、插件(指整个 browser-ext)

**Shared(共享层)**:
多个 Feature 复用的代码,住 `src/shared/`,必须浏览器无关。Feature 之间默认禁止互相 import;要共享就下沉到这里或合并 Feature。
_Avoid_: common、utils(不表边界语义)

### 平台

**浏览器矩阵(Browser Matrix)**:
本项目正式支持的浏览器集合:Chrome、Firefox、Edge。Safari 明确不在矩阵内,但矩阵是可扩展的。
_Avoid_: "所有浏览器"(从不是目标)

**差异封装(Divergence Encapsulation)**:
浏览器差异只能消化在 Feature 内部,永不进入 Shared。

### 决策留痕

**功能级决定**:
做/不做/怎么做的决定,记录于 GitHub issue(标题正文中文)。
_Avoid_: 口头决定、只写代码不留 issue

**骨架决定**:
影响整个仓库形状的难逆转决定(框架、架构、留痕规则),issue + ADR 双写,ADR 为权威文本。
_Avoid_: 把 ADR 当 issue 用、或只有 issue 没有 ADR

**追认(Retrospective Filing)**:
拷问会话中做出的决定,会后补开 issue 留痕的行为。
