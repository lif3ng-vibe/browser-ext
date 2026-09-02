# 删除确认页内化设计(issue #14 后续缺陷修复)

日期:2026-09-02。背景:60c55cf 修复坐实嵌入式 options(chrome://extensions 卡片「选项」= chrome:// 页 iframe)中 `window.confirm`/`window.alert` 被 Chrome 静默抑制(不显示、返回 `false`、无提示)。导入流已页内化;本设计把剩余 dialog 调用点统一页内化,用户已拍板。

## 范围

| 调用点 | 页面 | 处理 |
|---|---|---|
| `ManageStylesBlock.vue` 删除样式确认 | options(抑制区) | → 页内确认条 |
| `ManagerPanel.vue` 删除样式确认 | sidepanel | → 页内确认条(与 options 统一) |
| `ManageStylesBlock.vue`「侧边栏唤起失败」alert | options(抑制区) | → 页内提示条 |
| `StyleEditor.vue:72`「放弃未保存修改」confirm | sidepanel | **保留不动**(顶层页,可用) |

## 交互

- **区块级确认条**:点删除后,列表与「新建样式」按钮之间出现确认条:`删除「XXX」?不可恢复。` + `确认删除` / `取消` 按钮。与导入确认条**互斥**——同一时刻最多一个确认条,新确认请求直接取代旧确认(含跨类型:导入确认待决时点删除 → 替换为删除确认,反之亦然)。
- **提示条**:导入失败/空文件提示与侧边栏唤起失败提示共用同一条提示条,新提示覆盖旧提示。
- 确认按钮文案:导入 `确认导入`,删除 `确认删除`。

## 实现

- `ManageStylesBlock.vue`:
  - `pendingImport: { msg; styles }` 泛化为 `pendingConfirm: { msg: string; confirmLabel: string; action: () => Promise<void> } | null`,导入确认与删除确认共用确认条渲染。
  - `importNotice` 改名 `notice: string | null`,承载导入报错与唤起失败提示。
  - `confirmRemove(id)` 拆为 `requestRemove(id)`(置确认状态)与 `confirmRemove()`(执行删除并收起确认条)。StyleList 仍 emit `remove`,父组件接 `requestRemove`,子组件接口不变。
  - 确认条按钮点击时清 `pendingConfirm`;确认执行后收起。
- `ManagerPanel.vue`:
  - 加同构 `pendingConfirm` 状态 + 区块级确认条模板(与 ManageStylesBlock 同模式)。
  - 不抽共享组件:两处各 ~20 行,抽象收益低于成本;未来第三处出现再下沉 `shared`。

## 测试

- `ManageStylesBlock.test.ts`:删除确认三态(出现/取消/确认后落 storage);删除与导入确认互斥(后到取代);唤起失败提示条;原导入 6 用例适配改名(`import-notice` 语义不变)。
- `ManagerPanel.test.ts`(新建):删除确认三态;确认删除含编辑中样式 → editingId 清空不变式。

## 不做

- 不新增 destructive button variant;不动 `StyleEditor`;不抽 shared 确认条组件;不做行内原位确认(已评估,区块级更小)。