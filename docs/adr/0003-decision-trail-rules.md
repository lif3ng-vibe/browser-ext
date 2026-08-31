---
status: accepted
---

# 决定留痕规则:三档

所有决定必须留痕,按可逆性分三档:功能级决定(做/不做/怎么做)开 GitHub issue,讨论与结论都在 issue 里;难逆转的技术决定(仓库形状级)issue + ADR 双写,ADR 为权威文本;琐碎决定(命名、小重构)commit message 即可。issue 标题正文用中文,代码标识符与命令保持英文。骨架阶段做出的决定以追认方式补开 issue。

## Consequences

- `/grill-with-docs` 等技能产出的决定按此规则分流。
- ADR 目录 `docs/adr/`,顺序编号,格式见 domain-modeling 技能。
- 首批追认:issue #1(技术选型)、issue #2(架构边界)。
